import { Queue } from "bullmq";
import Redis from "ioredis";
import { db } from "@/db";
import { campaignWorkerHealth } from "@/db/schema";
import { sql } from "drizzle-orm";
export const CAMPAIGN_QUEUE = "whatsapp-campaign-dispatch";
export function createQueueRedis() {
  const url = process.env.REDIS_QUEUE_URL || process.env.REDIS_URL;
  if (!url) throw new Error("Campaign queue is not configured. Direct replies remain available.");
  const connection = new Redis(url, { maxRetriesPerRequest: null, connectTimeout: 10000, retryStrategy: attempts => Math.min(1000 * attempts, 10000) });
  connection.on("error", () => console.error("Campaign Redis connection unavailable"));
  return connection;
}
let connection: Redis | undefined;
let queue: Queue | undefined;
export function getCampaignQueue() {
  connection ||= createQueueRedis();
  queue ||= new Queue(CAMPAIGN_QUEUE, { connection, defaultJobOptions: { attempts: 1, removeOnComplete: { count: 1000 }, removeOnFail: { count: 1000 } } });
  return queue;
}
export async function assertCampaignWorkerAvailable(requireRotation = false) {
  const workers = await db.query.campaignWorkerHealth.findMany({ where: sql`${campaignWorkerHealth.lastSeenAt} > now() - interval '30 seconds'`, columns:{rotationReady:true} });
  if (!workers.length) throw new Error("Campaign worker is offline. Start the worker before launching. Direct replies remain available.");
  if(requireRotation&&workers.some(worker=>!worker.rotationReady))throw new Error('The campaign sending service needs an update before launch. Direct replies remain available.');
}
export async function enqueueOutbound(id: string) { return getCampaignQueue().add("dispatch-message", { outboundId: id }, { jobId: id }); }
