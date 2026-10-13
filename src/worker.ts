import { DelayedError, Worker, type Job } from "bullmq";
import { db } from "./db";
import { outboundMessages, campaigns, whatsappInstances, blacklist, campaignWorkerHealth, messages, campaignAccounts } from "./db/schema";
import { randomUUID } from "node:crypto";
import { and, eq, sql, asc, gt, or, isNull } from "drizzle-orm";
import { CAMPAIGN_QUEUE, createQueueRedis, getCampaignQueue } from "./lib/queue";
import { dispatchOutbound } from "./lib/outbound-service";
import { refreshCampaignProgress } from "./lib/campaign-service";
import {recoverQueuedJobs} from './lib/queue-recovery';
import { isWithinSendingWindow, nextSendingWindow, campaignPacingMs, type SendingWindow } from "./lib/campaign-policy";
import { campaignSenderUsage } from './lib/campaign-usage';
import {hasEarlierCampaignRequest} from "./lib/campaign-order";
import {campaignReplyExists} from "./lib/campaign-reply";
import { campaignAllowance } from './lib/campaign-rotation';

const redis = createQueueRedis();
const workerId = randomUUID();
async function delayJob(job: Job, timestamp: number, token?: string): Promise<never> { await job.moveToDelayed(timestamp, token); throw new DelayedError(); }
async function processCampaign(job: Job, token?: string) {
  if (typeof job.data.outboundId !== "string") return { ignored: "legacy_job_without_delivery_record" };
  const row = await db.query.outboundMessages.findFirst({ where: eq(outboundMessages.id, job.data.outboundId) });
  if (!row?.campaignId || row.status !== "queued") return { ignored: true };
  const campaign = await db.query.campaigns.findFirst({ where: and(eq(campaigns.id, row.campaignId), eq(campaigns.tenantId, row.tenantId)),columns:{id:true,status:true,sendingWindows:true,timezone:true,stopOnReply:true,startedAt:true,dailyLimitPerAccount:true,delayMode:true,customDelayMin:true,customDelayMax:true} });
  if (!campaign || campaign.status === "cancelled") { await db.update(outboundMessages).set({ status: "cancelled", updatedAt: new Date() }).where(eq(outboundMessages.id, row.id)); return; }
  if (!["running", "queued"].includes(campaign.status)) return delayJob(job, Date.now() + 30000, token);
  const windows = campaign.sendingWindows as SendingWindow[];
  if (!isWithinSendingWindow(windows, campaign.timezone)) return delayJob(job, nextSendingWindow(windows, campaign.timezone), token);
  const instance = await db.query.whatsappInstances.findFirst({ where: and(eq(whatsappInstances.id, row.instanceId), eq(whatsappInstances.tenantId, row.tenantId)) });
  if (!instance || instance.status !== "connected") return delayJob(job, Date.now() + 60000, token);
  const blocked = await db.query.blacklist.findFirst({ where: and(eq(blacklist.tenantId, row.tenantId), eq(blacklist.phoneNumber, row.remoteJid)) });
  if (blocked) { await db.update(outboundMessages).set({ status: "skipped", lastError: "Recipient opted out", updatedAt: new Date() }).where(eq(outboundMessages.id, row.id)); await refreshCampaignProgress(campaign.id, row.tenantId); return { skipped: true }; }
  const lockKey = `whatsend:campaign-instance:${instance.id}`;
  const leaseId = randomUUID();
  const acquired = await redis.set(lockKey, leaseId, "PX", 300000, "NX");
  if (!acquired) return delayJob(job, Date.now() + 1000, token);
  const renewLease=setInterval(()=>void redis.eval("if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('pexpire',KEYS[1],ARGV[2]) else return 0 end",1,lockKey,leaseId,300000).catch(()=>console.error('Campaign account lease renewal failed.')),30000);
  try {
    if(row.campaignSequence!==null&&await hasEarlierCampaignRequest(row.tenantId,campaign.id,instance.id,row.campaignSequence))return delayJob(job,Date.now()+1000,token);
    const nextAt = Number(await redis.get(`whatsend:campaign-next:${instance.id}`) || 0);
    if (nextAt > Date.now()) return delayJob(job, nextAt, token);
    const usage=(await campaignSenderUsage(row.tenantId,campaign.id,campaign.timezone,instance.id)).get(instance.id)||{accountUsed:0,campaignUsed:0};
    if (!campaignAllowance(instance.dailyLimit,campaign.dailyLimitPerAccount,usage.accountUsed,usage.campaignUsed)) return delayJob(job, Date.now() + 15 * 60000, token);
    if(campaign.stopOnReply&&campaign.startedAt){
      const reply=await campaignReplyExists(row.tenantId,campaign.id,row.remoteJid,campaign.startedAt);
      if(reply){await db.update(outboundMessages).set({status:'skipped',lastError:'Recipient replied after this campaign started',updatedAt:new Date()}).where(and(eq(outboundMessages.id,row.id),eq(outboundMessages.status,'queued')));await refreshCampaignProgress(campaign.id,row.tenantId);return {skipped:true};}
    }
    const current = await db.query.campaigns.findFirst({ where: eq(campaigns.id, campaign.id), columns: { status: true } });
    if (current?.status !== "running") return delayJob(job, Date.now() + 30000, token);
    if(await redis.get(lockKey)!==leaseId)return delayJob(job,Date.now()+1000,token);
    await dispatchOutbound(row.id, row.tenantId);
    await redis.set(`whatsend:campaign-next:${instance.id}`, String(Date.now() + campaignPacingMs(campaign.delayMode, campaign.customDelayMin, campaign.customDelayMax)), "PX", 600000);
    await refreshCampaignProgress(campaign.id, row.tenantId);
    return { sent: true };
  } catch (error) {
    if (!(error instanceof DelayedError)) await refreshCampaignProgress(campaign.id, row.tenantId);
    throw error;
  } finally { clearInterval(renewLease); await redis.eval("if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end", 1, lockKey, leaseId); }
}
const configuredConcurrency=Number(process.env.CAMPAIGN_CONCURRENCY||8);
const concurrency=Number.isInteger(configuredConcurrency)?Math.max(1,Math.min(configuredConcurrency,32)):8;
const worker = new Worker(CAMPAIGN_QUEUE, processCampaign, { connection: redis, concurrency });
worker.on("failed", (_job, error) => console.error("Campaign job failed:", error.message));
worker.on("error", error => console.error("Campaign worker error:", error.message));
let pumping = false;
let ready = false;
let recoveryCursor:{createdAt:Date;id:string;sequence:number|null}|undefined;
async function pumpOutbox() {
  if (pumping) return; pumping = true;
  try {
    // A stopped worker cannot safely retry a request already marked sending.
    const stale = await db.update(outboundMessages).set({ status: "uncertain", lastError: "Worker stopped during sending; inspect provider history before retrying.", updatedAt: new Date() }).where(and(eq(outboundMessages.status, "sending"), sql`${outboundMessages.updatedAt} < now() - interval '5 minutes'`, sql`${outboundMessages.campaignId} is not null`)).returning({ campaignId: outboundMessages.campaignId, tenantId: outboundMessages.tenantId });
    for (const row of new Map(stale.filter(row=>row.campaignId).map(row=>[row.campaignId,row])).values()) await refreshCampaignProgress(row.campaignId!, row.tenantId);
    const queue = getCampaignQueue();
    // Keep scanning past delayed/disconnected accounts instead of revisiting only the first 500 rows.
    for(let page=0;page<10;page++){
      const cursor=recoveryCursor;
      const afterCursor=cursor?or(gt(outboundMessages.createdAt,cursor.createdAt),and(eq(outboundMessages.createdAt,cursor.createdAt),cursor.sequence===null?and(isNull(outboundMessages.campaignSequence),gt(outboundMessages.id,cursor.id)):or(gt(outboundMessages.campaignSequence,cursor.sequence),isNull(outboundMessages.campaignSequence),and(eq(outboundMessages.campaignSequence,cursor.sequence),gt(outboundMessages.id,cursor.id))))):undefined;
      const rows=await db.select({id:outboundMessages.id,createdAt:outboundMessages.createdAt,sequence:outboundMessages.campaignSequence}).from(outboundMessages).innerJoin(campaigns,eq(outboundMessages.campaignId,campaigns.id)).where(and(eq(outboundMessages.status,'queued'),eq(campaigns.status,'running'),afterCursor)).orderBy(asc(outboundMessages.createdAt),asc(outboundMessages.campaignSequence),asc(outboundMessages.id)).limit(500);
      if(!rows.length){recoveryCursor=undefined;break;}
      await recoverQueuedJobs(queue,rows.map(row=>row.id));
      recoveryCursor=rows[rows.length-1];
      if(rows.length<500){recoveryCursor=undefined;break;}
    }

  } catch (error) {
    ready = false;
    await redis.del("whatsend:campaign-worker:heartbeat").catch(() => undefined);
    await db.delete(campaignWorkerHealth).where(eq(campaignWorkerHealth.id,workerId)).catch(()=>undefined);
    const cause = (error as {cause?: {code?: string}})?.cause;
    console.error("Campaign outbox recovery failed:", cause?.code || "database_or_queue_unavailable");
  }
  finally { pumping = false; }
}
let heartbeating=false;
async function heartbeat(){
 if(heartbeating)return;heartbeating=true;
 try{
  await redis.ping();
  await db.insert(campaignWorkerHealth).values({id:workerId,lastSeenAt:new Date(),sharedMediaReady:true,rotationReady:true}).onConflictDoUpdate({target:campaignWorkerHealth.id,set:{lastSeenAt:new Date(),sharedMediaReady:true,rotationReady:true}});
  await redis.set("whatsend:campaign-worker:heartbeat",String(Date.now()),"EX",30);
  if(!ready)console.log("Campaign worker ready: database and private Redis verified.");ready=true;
 }catch{ready=false;await db.delete(campaignWorkerHealth).where(eq(campaignWorkerHealth.id,workerId)).catch(()=>undefined);console.error("Campaign worker heartbeat failed.");}
 finally{heartbeating=false;}
}
const heartbeatInterval=setInterval(()=>void heartbeat(),10000);
void heartbeat();
const interval = setInterval(() => void pumpOutbox(), 10000);
void pumpOutbox();
console.log("Campaign worker started. Direct inbox replies use a separate path.");
async function shutdown() { clearInterval(interval); clearInterval(heartbeatInterval); await worker.close(); await db.delete(campaignWorkerHealth).where(eq(campaignWorkerHealth.id,workerId)); await getCampaignQueue().close(); redis.disconnect(); process.exit(0); }
process.on("SIGTERM", () => void shutdown()); process.on("SIGINT", () => void shutdown());
