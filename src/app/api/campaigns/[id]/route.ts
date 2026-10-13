import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthAndTenant } from "@/lib/auth";
import { authenticationError } from "@/lib/api-error";
import { db } from "@/db";
import { campaigns, campaignAccounts, campaignLeads, outboundMessages, whatsappInstances, messages, blacklist } from "@/db/schema";
import { and, eq, inArray, desc, sql } from "drizzle-orm";
import { campaignAnalytics, campaignEditSchema, getCampaign } from "@/lib/campaign-service";
import {campaignLeadOverview} from "@/lib/campaign-lead-query";
import { MessagingError } from "@/lib/outbound-service";
function failure(error: unknown) { const auth = authenticationError(error); if (auth) return auth; if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 }); if (error instanceof MessagingError) return NextResponse.json({ error: error.message }, { status: error.status }); return NextResponse.json({ error: "Could not update the campaign." }, { status: 500 }); }
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await requireAuthAndTenant(req.headers.get("Authorization")); const { id } = await params;
    const campaign = await getCampaign(id, tenantId);
    const includeLeads=new URL(req.url).searchParams.get('includeLeads')!=='false';
    const links = await db.query.campaignAccounts.findMany({ where: eq(campaignAccounts.campaignId, id) });
    const [assignedAccounts,leads,analytics]=await Promise.all([
      links.length?db.query.whatsappInstances.findMany({where:and(eq(whatsappInstances.tenantId,tenantId),inArray(whatsappInstances.id,links.map(link=>link.instanceId)))}):Promise.resolve([]),
      includeLeads?campaignLeadOverview(tenantId,id):Promise.resolve([]),campaignAnalytics(id,tenantId),
    ]);
    return NextResponse.json({campaign:{...campaign,assignedAccounts,analytics:{...analytics,total:analytics.total||campaign.totalContacts,queued:campaign.status==='draft'?campaign.totalContacts:analytics.queued}},leads});
  } catch (error) { return failure(error); }
}
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await requireAuthAndTenant(req.headers.get("Authorization")); const { id } = await params;
    const campaign = await getCampaign(id, tenantId); const input = campaignEditSchema.parse(await req.json());
    const { instanceIds, payload, ...update } = input;
    if (campaign.status !== "draft" && Object.keys(update).some(key => !["name", "status"].includes(key))) throw new MessagingError("Pause or finish this campaign; message and recipient changes belong in a new draft.", 409);
    if (input.status === "paused" && campaign.status !== "running") throw new MessagingError("Only a running campaign can be paused.", 409);
    if (input.status === "running" && !["paused", "running"].includes(campaign.status)) throw new MessagingError("Launch this draft after completing its setup.", 409);
    if (input.status === "running") { const uncertain = await db.query.outboundMessages.findFirst({ where: and(eq(outboundMessages.campaignId, id), eq(outboundMessages.status, "uncertain")) }); if (uncertain) throw new MessagingError("Review uncertain deliveries before resuming this campaign.", 409); }
    if ((input.customDelayMin ?? campaign.customDelayMin) > (input.customDelayMax ?? campaign.customDelayMax)) throw new MessagingError("Minimum pacing cannot exceed maximum pacing.");
    if (instanceIds && campaign.status !== "draft") throw new MessagingError("Sending accounts can only be changed in a draft.", 409);
    const instances = instanceIds?.length ? await db.query.whatsappInstances.findMany({ where: and(eq(whatsappInstances.tenantId, tenantId), inArray(whatsappInstances.id, instanceIds)) }) : [];
    if (instanceIds && instances.length !== new Set(instanceIds).size) throw new MessagingError("One or more accounts are unavailable.", 404);
    await db.transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${id}))`);
      const fresh=await tx.query.campaigns.findFirst({where:and(eq(campaigns.id,id),eq(campaigns.tenantId,tenantId))});
      if(!fresh||fresh.status!==campaign.status)throw new MessagingError('Campaign state changed. Reload before saving.',409);
      if((input.customDelayMin??fresh.customDelayMin)>(input.customDelayMax??fresh.customDelayMax))throw new MessagingError('Minimum pacing cannot exceed maximum pacing.');
      await tx.update(campaigns).set({ ...update, ...(payload ? { variants: [{ id: "default", label: "Default", weight: 100, spintaxTemplate: payload.type === "text" ? payload.text : "", payload }] } : {}) }).where(and(eq(campaigns.id, id), eq(campaigns.tenantId, tenantId)));
      if (instanceIds) { await tx.delete(campaignAccounts).where(eq(campaignAccounts.campaignId, id)); if(instanceIds.length)await tx.insert(campaignAccounts).values(instanceIds.map(instanceId => ({ campaignId: id, instanceId }))); }
      if (input.status === "cancelled") await tx.update(outboundMessages).set({ status: "cancelled", updatedAt: new Date() }).where(and(eq(outboundMessages.campaignId, id), eq(outboundMessages.status, "queued")));
    });
    return NextResponse.json({ success: true });
  } catch (error) { return failure(error); }
}

export async function DELETE(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const {tenantId,role}=await requireAuthAndTenant(req.headers.get('Authorization'));
  if(role!=='admin')return NextResponse.json({error:'Only admins can delete campaigns.'},{status:403});
  const {id}=await params;await getCampaign(id,tenantId);
  await db.transaction(async tx=>{
   await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${id}))`);
   const campaign=await tx.query.campaigns.findFirst({where:and(eq(campaigns.id,id),eq(campaigns.tenantId,tenantId))});
   if(!campaign)throw new MessagingError('Campaign was not found.',404);
   if(['running','queued','paused'].includes(campaign.status))throw new MessagingError('Cancel this campaign before deleting it.',409);
   const pending=await tx.query.outboundMessages.findFirst({where:and(eq(outboundMessages.campaignId,id),eq(outboundMessages.status,'sending')),columns:{id:true}});
   if(pending)throw new MessagingError('A send is still in progress. Wait for its result before deleting.',409);
   await tx.delete(campaigns).where(and(eq(campaigns.id,id),eq(campaigns.tenantId,tenantId)));
  });return NextResponse.json({success:true});
 }catch(error){return failure(error);}
}
