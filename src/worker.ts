import { DelayedError, Worker, type Job } from "bullmq";
import { db } from "./db";
import { outboundMessages, campaigns, whatsappInstances, blacklist, campaignWorkerHealth } from "./db/schema";
import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql, asc } from "drizzle-orm";
import { CAMPAIGN_QUEUE, createQueueRedis, getCampaignQueue } from "./lib/queue";
import { dispatchOutbound } from "./lib/outbound-service";
import { refreshCampaignProgress } from "./lib/campaign-service";
import { isWithinSendingWindow, nextSendingWindow, campaignPacingMs, type SendingWindow } from "./lib/campaign-policy";

const redis = createQueueRedis();
const workerId = randomUUID();
async function delayJob(job: Job, timestamp: number, token?: string): Promise<never> { await job.moveToDelayed(timestamp, token); throw new DelayedError(); }
async function processCampaign(job: Job, token?: string) {
  if (typeof job.data.outboundId !== "string") return { ignored: "legacy_job_without_delivery_record" };
  const row = await db.query.outboundMessages.findFirst({ where: eq(outboundMessages.id, job.data.outboundId) });
  if (!row?.campaignId || row.status !== "queued") return { ignored: true };
  const campaign = await db.query.campaigns.findFirst({ where: and(eq(campaigns.id, row.campaignId), eq(campaigns.tenantId, row.tenantId)) });
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
  const acquired = await redis.set(lockKey, leaseId, "PX", 120000, "NX");
  if (!acquired) return delayJob(job, Date.now() + 1000, token);
  try {
    const nextAt = Number(await redis.get(`whatsend:campaign-next:${instance.id}`) || 0);
    if (nextAt > Date.now()) return delayJob(job, nextAt, token);
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(outboundMessages).where(and(eq(outboundMessages.instanceId, instance.id), eq(outboundMessages.tenantId, row.tenantId), inArray(outboundMessages.status, ["sent", "delivered", "read"]), sql`${outboundMessages.campaignId} is not null`, sql`${outboundMessages.sentAt} >= (date_trunc('day', now() at time zone ${campaign.timezone}) at time zone ${campaign.timezone})`));
    if (count >= Math.min(instance.dailyLimit, campaign.dailyLimitPerAccount)) return delayJob(job, Date.now() + 15 * 60000, token);
    const current = await db.query.campaigns.findFirst({ where: eq(campaigns.id, campaign.id), columns: { status: true } });
    if (current?.status !== "running") return delayJob(job, Date.now() + 30000, token);
    await dispatchOutbound(row.id, row.tenantId);
    await redis.set(`whatsend:campaign-next:${instance.id}`, String(Date.now() + campaignPacingMs(campaign.delayMode, campaign.customDelayMin, campaign.customDelayMax)), "PX", 600000);
    await refreshCampaignProgress(campaign.id, row.tenantId);
    return { sent: true };
  } catch (error) {
    if (!(error instanceof DelayedError)) await refreshCampaignProgress(campaign.id, row.tenantId);
    throw error;
  } finally { await redis.eval("if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end", 1, lockKey, leaseId); }
}
const worker = new Worker(CAMPAIGN_QUEUE, processCampaign, { connection: redis, concurrency: 4 });
worker.on("failed", (_job, error) => console.error("Campaign job failed:", error.message));
worker.on("error", error => console.error("Campaign worker error:", error.message));
let pumping = false;
let ready = false;
async function pumpOutbox() {
  if (pumping) return; pumping = true;
  try {
    // A stopped worker cannot safely retry a request already marked sending.
    const stale = await db.update(outboundMessages).set({ status: "uncertain", lastError: "Worker stopped during sending; inspect provider history before retrying.", updatedAt: new Date() }).where(and(eq(outboundMessages.status, "sending"), sql`${outboundMessages.updatedAt} < now() - interval '5 minutes'`, sql`${outboundMessages.campaignId} is not null`)).returning({ campaignId: outboundMessages.campaignId, tenantId: outboundMessages.tenantId });
    for (const row of stale) if (row.campaignId) await refreshCampaignProgress(row.campaignId, row.tenantId);
    const rows = await db.select({ id: outboundMessages.id }).from(outboundMessages).innerJoin(campaigns, eq(outboundMessages.campaignId, campaigns.id)).where(and(eq(outboundMessages.status, "queued"), eq(campaigns.status, "running"))).orderBy(asc(outboundMessages.createdAt)).limit(500);
    const queue = getCampaignQueue();
    for (const row of rows) {
      const existing = await queue.getJob(row.id);
      if (existing && await existing.getState() === "failed") await existing.retry();
      else if (!existing) await queue.add("dispatch-message", { outboundId: row.id }, { jobId: row.id });
    }
    await redis.set("whatsend:campaign-worker:heartbeat", String(Date.now()), "EX", 30);
    await db.insert(campaignWorkerHealth).values({id:workerId,lastSeenAt:new Date()}).onConflictDoUpdate({target:campaignWorkerHealth.id,set:{lastSeenAt:new Date()}});
    if (!ready) console.log("Campaign worker ready: database and private Redis verified.");
    ready = true;
  } catch (error) {
    ready = false;
    await redis.del("whatsend:campaign-worker:heartbeat").catch(() => undefined);
    await db.delete(campaignWorkerHealth).where(eq(campaignWorkerHealth.id,workerId)).catch(()=>undefined);
    const cause = (error as {cause?: {code?: string}})?.cause;
    console.error("Campaign outbox recovery failed:", cause?.code || "database_or_queue_unavailable");
  }
  finally { pumping = false; }
}
const interval = setInterval(() => void pumpOutbox(), 10000);
void pumpOutbox();
console.log("Campaign worker started. Direct inbox replies use a separate path.");
async function shutdown() { clearInterval(interval); await worker.close(); await db.delete(campaignWorkerHealth).where(eq(campaignWorkerHealth.id,workerId)); await getCampaignQueue().close(); redis.disconnect(); process.exit(0); }
process.on("SIGTERM", () => void shutdown()); process.on("SIGINT", () => void shutdown());
