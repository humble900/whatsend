import { Worker } from "bullmq";
import { redisConnection } from "../lib/queue";
import { parseSpintax, getRandomDelay } from "../lib/spintax";
import { db } from "../db";
import { whatsappInstances, blacklist } from "../db/schema";
import { eq, and } from "drizzle-orm";

const EVOLUTION_GLOBAL_API_KEY = process.env.EVOLUTION_GLOBAL_API_KEY!;

interface DispatchJobPayload {
  tenantId: string;
  campaignId: string;
  evolutionInstanceId: string;
  targetPhone: string;
  spintaxTemplate: string;
  variables: Record<string, string>; // Injected CSV Variables
}

// Ensure execution delay mechanism
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const campaignWorker = new Worker<DispatchJobPayload>(
  "whatsapp-campaign-dispatch",
  async (job) => {
    const { tenantId, evolutionInstanceId, targetPhone, spintaxTemplate, variables } = job.data;

    // 1. Blacklist Check (Anti-Spam compliance)
    const isBlacklisted = await db.query.blacklist.findFirst({
      where: and(eq(blacklist.tenantId, tenantId), eq(blacklist.phoneNumber, targetPhone))
    });

    if (isBlacklisted) {
      console.log(`[Job ${job.id}] Skipped: Number ${targetPhone} is blacklisted.`);
      return { status: "skipped_blacklisted" };
    }

    // 2. Fetch Instance to get the Evolution API Pod URL
    const instanceRecord = await db.query.whatsappInstances.findFirst({
      where: eq(whatsappInstances.evolutionInstanceId, evolutionInstanceId)
    });

    if (!instanceRecord || instanceRecord.status !== "connected") {
      throw new Error(`Instance ${evolutionInstanceId} is not connected or does not exist.`);
    }

    // 3. Resolve Spintax Template & Variables
    // Inject CSV variables first (e.g. {{name}})
    const { injectVariables, parseSpintax, getRandomDelay } = require("../lib/spintax");
    const templatedMessage = injectVariables(spintaxTemplate, variables || {});
    // Then resolve spintax (e.g. {Hi|Hello})
    const finalMessage = parseSpintax(templatedMessage);

    // 4. Human Simulation Logic (Crucial for Anti-Ban)
    const serverUrl = instanceRecord.evolutionServerUrl;

    // A. Send "Composing" presence
    await fetch(`${serverUrl}/chat/sendPresence/${evolutionInstanceId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": EVOLUTION_GLOBAL_API_KEY },
      body: JSON.stringify({ number: targetPhone, delay: 1000, presence: "composing" }),
    });

    // B. Wait dynamically based on text length (assume 3 chars per second)
    const typingDelay = Math.max(2000, (finalMessage.length / 3) * 1000); 
    // Add jitter
    const jitteredDelay = typingDelay + getRandomDelay(1, 3);
    await sleep(Math.min(jitteredDelay, 15000)); // Cap at 15s to not block workers too long

    // 5. Dispatch Message
    const response = await fetch(`${serverUrl}/message/sendText/${evolutionInstanceId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": EVOLUTION_GLOBAL_API_KEY },
      body: JSON.stringify({
        number: targetPhone,
        text: finalMessage,
        delay: 500, // Native evolution api small delay
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to send message: ${errorText}`);
    }

    // 6. Update Analytics / Delivery Rate (Clickhouse in later phase, Postgres for MVP)
    // Here we'd update campaigns.contactsProcessed + 1
    // (omitted the DB update here to keep worker fast, usually handled by Evolution Webhooks)

    return { status: "sent", targetPhone };
  },
  {
    connection: redisConnection,
    concurrency: 50, // Process 50 messages simultaneously per Node process
  }
);

campaignWorker.on("completed", (job) => {
  console.log(`[Job ${job.id}] Successfully completed.`);
});

campaignWorker.on("failed", (job, err) => {
  console.error(`[Job ${job?.id}] Failed with error:`, err.message);
});
