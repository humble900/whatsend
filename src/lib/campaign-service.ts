import { z } from "zod";
import { db } from "@/db";
import { campaigns, campaignAccounts, campaignLeads, outboundMessages, whatsappInstances } from "@/db/schema";
import { and, eq, inArray, sql, asc } from "drizzle-orm";
import { MessagingError, createOutbound } from "./outbound-service";
import { outboundPayloadSchema, phoneSchema, payloadPreview, type OutboundPayload } from "./messaging-contracts";
import { createHash } from 'node:crypto';
import {sharedCampaignMediaReady,storeCampaignAsset,type StoredPayload} from './campaign-assets';
import { injectVariables, parseSpintax } from "./spintax";
import { leadVariables, missingVariables } from './campaign-personalization';
import { assertCampaignWorkerAvailable } from "./queue";
import { senderIdsSchema, prepareCampaignPlan, campaignAllowance, type RotationVariant } from './campaign-rotation';
import {campaignSenderUsage} from './campaign-usage';

function setupSignature(campaign: unknown, leads: { id: string }[], links: { instanceId: string }[]) {
  return createHash('sha256').update(JSON.stringify({campaign,leads:[...leads].sort((a,b)=>a.id.localeCompare(b.id)),accounts:links.map(link=>link.instanceId).sort()})).digest('hex');
}

export async function insertCampaignOutbox(transaction:Pick<typeof db,'execute'>,prepared:{inst:{id:string};lead:{phone:string};payload:StoredPayload}[],context:{tenantId:string;campaignId:string;userId?:string}){
 let batch:{instance_id:string;remote_jid:string;request_key:string;request_hash:string;payload:StoredPayload;message_text:string;campaign_sequence:number}[]=[];let bytes=0;
 const flush=async()=>{
  if(!batch.length)return;
  await transaction.execute(sql`insert into outbound_messages (tenant_id,instance_id,campaign_id,request_key,request_hash,remote_jid,payload,message_text,consent_confirmed_by,campaign_sequence)
    select ${context.tenantId}::uuid,x.instance_id,${context.campaignId}::uuid,x.request_key,x.request_hash,x.remote_jid,x.payload,x.message_text,${context.userId||null}::uuid,x.campaign_sequence
    from jsonb_to_recordset(${JSON.stringify(batch)}::jsonb) as x(instance_id uuid,remote_jid text,request_key text,request_hash text,payload jsonb,message_text text,campaign_sequence integer)
    on conflict do nothing`);batch=[];bytes=0;
 };
 for(let index=0;index<prepared.length;index++){
  const item=prepared[index],serialized=JSON.stringify(item.payload),size=Buffer.byteLength(serialized)+Buffer.byteLength(JSON.stringify(payloadPreview(item.payload)))+500;
  if(batch.length&&(batch.length>=1000||bytes+size>4*1024*1024))await flush();
  batch.push({instance_id:item.inst.id,remote_jid:item.lead.phone+'@s.whatsapp.net',request_key:'campaign-'+context.campaignId+'-'+item.lead.phone,request_hash:createHash('sha256').update(serialized).digest('hex'),payload:item.payload,message_text:payloadPreview(item.payload),campaign_sequence:index});bytes+=size;
 }
 await flush();
}

const windowSchema = z.object({ start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) }).refine(value => value.start !== value.end, "A sending window must have a duration.");
export const campaignEditSchema = z.object({ name: z.string().trim().min(1).max(120).optional(), spintaxTemplate: z.string().max(4096).optional(), payload: outboundPayloadSchema.optional(), instanceIds: senderIdsSchema.optional(), stopOnReply: z.boolean().optional(), dailyLimitPerAccount: z.number().int().min(1).max(1000).optional(), delayMode: z.enum(["smart", "custom"]).optional(), customDelayMin: z.number().min(1).max(300).optional(), customDelayMax: z.number().min(1).max(300).optional(), sendingWindows: z.array(windowSchema).min(1).max(10).optional(), timezone: z.string().refine(value => { try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; } }, "Choose a valid timezone.").optional(), status: z.enum(["paused", "running", "cancelled"]).optional(), variants: z.array(z.object({ id: z.string().min(1).max(100), label: z.string().min(1).max(100), enabled: z.boolean().optional(), spintaxTemplate: z.string().max(4096), weight: z.number().int().min(1).max(100), payload: z.union([outboundPayloadSchema,z.object({type:z.literal("text"),text:z.string().max(4096)})]).optional() })).max(20).refine(variants=>new Set(variants.map(variant=>variant.id)).size===variants.length,"Variant IDs must be unique.").optional(), variantMode: z.enum(["round_robin", "weighted", "account_locked"]).optional() });
export const campaignLeadSchema = z.object({ contacts: z.array(z.object({ phone: phoneSchema, name: z.string().max(255).optional(), variables: z.record(z.string(), z.string().max(4096)).optional() })).min(1).max(10000) });
export async function getCampaign(id: string, tenantId: string, database: Pick<typeof db,'query'> = db) {
  z.uuid().parse(id);
  const campaign = await database.query.campaigns.findFirst({ where: and(eq(campaigns.id, id), eq(campaigns.tenantId, tenantId)) });
  if (!campaign) throw new MessagingError("Campaign was not found.", 404);
  return campaign;
}
export async function getCampaignContext(id:string,tenantId:string){
 z.uuid().parse(id);
 const campaign=await db.query.campaigns.findFirst({where:and(eq(campaigns.id,id),eq(campaigns.tenantId,tenantId)),columns:{id:true,timezone:true}});
 if(!campaign)throw new MessagingError('Campaign was not found.',404);return campaign;
}
export async function campaignAnalytics(id: string, tenantId: string, database: Pick<typeof db,'select'> = db) {
  const rows = await database.select({ status: outboundMessages.status, count: sql<number>`count(*)::int` }).from(outboundMessages).where(and(eq(outboundMessages.campaignId, id), eq(outboundMessages.tenantId, tenantId))).groupBy(outboundMessages.status);
  const counts = Object.fromEntries(rows.map(row => [row.status, row.count]));
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const sent = (counts.sent || 0) + (counts.delivered || 0) + (counts.read || 0);
  const processed = sent + (counts.failed || 0) + (counts.skipped || 0) + (counts.cancelled || 0);
  return { total, sent, failed: counts.failed || 0, skipped: counts.skipped || 0, uncertain: counts.uncertain || 0, delivered: (counts.delivered || 0) + (counts.read || 0), read: counts.read || 0, queued: (counts.queued || 0) + (counts.sending || 0), processed, progress: total ? Math.round(processed / total * 100) : 0 };
}
export async function refreshCampaignProgress(id: string, tenantId: string) {
  await db.transaction(async tx=>{
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${id}))`);
    const campaign=await tx.query.campaigns.findFirst({where:and(eq(campaigns.id,id),eq(campaigns.tenantId,tenantId)),columns:{status:true}});
    if(!campaign)throw new MessagingError('Campaign was not found.',404);
    const analytics=await campaignAnalytics(id,tenantId,tx);
    await tx.update(campaigns).set({contactsProcessed:analytics.processed,...(analytics.uncertain&&campaign.status==='running'?{status:'paused'}:analytics.total&&analytics.processed===analytics.total&&campaign.status!=='cancelled'?{status:'completed',completedAt:new Date()}:{})}).where(and(eq(campaigns.id,id),eq(campaigns.tenantId,tenantId)));
  });
}
export async function launchCampaign(id: string, tenantId: string, userId: string, consent: boolean) {
  if (!consent) throw new MessagingError("Confirm that every recipient opted in before launching.");
  const campaign = await getCampaign(id, tenantId);
  if (campaign.status !== "draft") throw new MessagingError("Only a draft campaign can be launched.", 409);
  const leads = await db.query.campaignLeads.findMany({ where: and(eq(campaignLeads.campaignId, id), eq(campaignLeads.tenantId, tenantId)),orderBy:[asc(campaignLeads.createdAt),asc(campaignLeads.id)] });
  if (!leads.length) throw new MessagingError("Add recipients before launching.");
  const links = await db.query.campaignAccounts.findMany({ where: eq(campaignAccounts.campaignId, id) });
  const instances = links.length ? await db.query.whatsappInstances.findMany({ where: and(eq(whatsappInstances.tenantId, tenantId), eq(whatsappInstances.status, "connected"), inArray(whatsappInstances.id, links.map(link => link.instanceId))) }) : [];
  if (instances.length !== links.length || !instances.length) throw new MessagingError("Choose connected WhatsApp accounts before launching.");
  if (campaign.customDelayMin > campaign.customDelayMax) throw new MessagingError("Minimum pacing cannot exceed maximum pacing.");
  const signature = setupSignature(campaign, leads, links);
  const usage=await campaignSenderUsage(tenantId,id,campaign.timezone);
  const orderedInstances = [...instances].sort((a,b)=>a.id.localeCompare(b.id)).map(instance=>{const used=usage.get(instance.id)||{accountUsed:0,campaignUsed:0};return {...instance,availableToday:campaignAllowance(instance.dailyLimit,campaign.dailyLimitPerAccount,used.accountUsed,used.campaignUsed)};});
  let prepared;
  try { prepared = prepareCampaignPlan(orderedInstances, leads.map(lead=>({...lead,variables:lead.variables as Record<string,string>})), campaign.variants as RotationVariant[], campaign.variantMode, campaign.spintaxTemplate).map(item=>({...item,payload:{...item.payload,_variantId:item.variantId} as StoredPayload})); }
  catch(error){throw new MessagingError(error instanceof Error?error.message:'Could not prepare campaign.');}
  await assertCampaignWorkerAvailable(true);
  if(await sharedCampaignMediaReady()){
    const assets=new Map<string,string>();
    for(const item of prepared){
      const field=item.payload.type==='media'?'media':item.payload.type==='audio'?'audio':item.payload.type==='sticker'?'sticker':null;
      if(!field)continue;const data=(item.payload as unknown as Record<string,string>)[field];
      if(data.startsWith('https://')||data.length<4096)continue;
      let assetId=assets.get(data);
      if(!assetId){const stored=await storeCampaignAsset(tenantId,item.payload);assetId=stored._assetId!;assets.set(data,assetId);}
      item.payload={...item.payload,[field]:`asset:${assetId}`,_assetId:assetId};
    }
  }
  await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${id}))`);
    const current = await tx.query.campaigns.findFirst({ where: eq(campaigns.id, id) });
    if (current?.status !== "draft") throw new MessagingError("Campaign is already launched.", 409);
    const [currentLeads,currentLinks]=await Promise.all([
      tx.query.campaignLeads.findMany({where:and(eq(campaignLeads.campaignId,id),eq(campaignLeads.tenantId,tenantId))}),
      tx.query.campaignAccounts.findMany({where:eq(campaignAccounts.campaignId,id)}),
    ]);
    if(setupSignature(current,currentLeads,currentLinks)!==signature)throw new MessagingError('Campaign setup changed while launching. Review the latest setup and launch again.',409);
    // Outbox rows are prepared before running; the worker recovers queue interruptions.
    await insertCampaignOutbox(tx,prepared,{tenantId,campaignId:id,userId});
    await tx.update(campaigns).set({ status: "running", startedAt: new Date(), consentConfirmedAt: new Date(), totalContacts: leads.length }).where(eq(campaigns.id, id));
  });
  const outbound = await db.query.outboundMessages.findMany({ where: and(eq(outboundMessages.campaignId, id), eq(outboundMessages.tenantId, tenantId), eq(outboundMessages.status, "queued")), columns: { id: true } });
  // The cloud worker claims these durable rows; local web servers need no
  // network access to Railway's private Redis and cannot lose a launch on exit.
  return { campaignId: id, queuedContacts: outbound.length };
}
