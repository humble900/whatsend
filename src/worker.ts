import { Worker } from "bullmq";
import Redis from "ioredis";
import { db } from "./db";
import { blacklist, messages, campaigns, contacts, whatsappInstances } from "./db/schema";
import { eq, and } from "drizzle-orm";
import { sendEvolutionMessage } from "./lib/evolution";
import { parseSpintax, injectVariables, getRandomDelay } from "./lib/spintax";

const REDIS_QUEUE_URL = process.env.REDIS_QUEUE_URL || "redis://localhost:6379";

const redisConnection = new Redis(REDIS_QUEUE_URL, {
  maxRetriesPerRequest: null,
});

console.log("🚀 Starting BullMQ Dispatch Worker for WhatsApp Enterprise Scale...");

const dispatchWorker = new Worker(
  "whatsapp-campaign-dispatch",
  async (job) => {
    const { tenantId, campaignId, evolutionInstanceId, targetPhone, spintaxTemplate, variables } = job.data;

    console.log(`[Job ${job.id}] Processing message for ${targetPhone} via Instance ${evolutionInstanceId}`);

    try {
      // 1. Check Global Blacklist
      const isBlacklisted = await db.query.blacklist.findFirst({
        where: and(eq(blacklist.tenantId, tenantId), eq(blacklist.phoneNumber, targetPhone))
      });

      if (isBlacklisted) {
        console.log(`[Job ${job.id}] Skipped: Number ${targetPhone} is blacklisted.`);
        return { skipped: true, reason: "blacklisted" };
      }

      // 1.5 Auto-Upsert Contact to CRM with Metadata
      const instance = await db.query.whatsappInstances.findFirst({
        where: eq(whatsappInstances.evolutionInstanceId, evolutionInstanceId)
      });
      
      if (instance) {
        const remoteJid = `${targetPhone}@s.whatsapp.net`;
        await db.insert(contacts).values({
          tenantId,
          instanceId: instance.id,
          remoteJid,
          metadata: variables || {}
        }).onConflictDoUpdate({
          target: [contacts.tenantId, contacts.remoteJid],
          set: {
            metadata: variables || {}
          }
        });
      }

      // 2. Parse Spintax & Variables
      let finalMessage = injectVariables(spintaxTemplate, variables || {});
      finalMessage = parseSpintax(finalMessage);

      // 3. Human Simulation Jitter (15s to 60s)
      // Note: In production at 10M scale, this jitter shouldn't block the worker completely.
      // BullMQ supports delayed jobs if we want non-blocking, but for strict sequential anti-ban per queue, this is okay.
      const delayMs = getRandomDelay(15, 60);
      console.log(`[Job ${job.id}] Human Simulation: Waiting ${delayMs / 1000}s before sending...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));

      // 4. Dispatch to Evolution API
      // sendEvolutionMessage already triggers "presence: composing" for 1 second.
      const result = await sendEvolutionMessage(evolutionInstanceId, targetPhone, finalMessage);

      // 5. Update Campaign Progress
      // Using raw SQL or a transaction is better for counters, but Drizzle supports simple updates.
      // In a real 10M scenario, we'd batch these updates.
      const campaign = await db.query.campaigns.findFirst({ where: eq(campaigns.id, campaignId) });
      if (campaign) {
        await db.update(campaigns)
          .set({ contactsProcessed: campaign.contactsProcessed + 1 })
          .where(eq(campaigns.id, campaignId));
      }

      console.log(`[Job ${job.id}] Success: Message sent to ${targetPhone}`);
      return { success: true, messageId: result?.key?.id };

    } catch (error: any) {
      console.error(`[Job ${job.id}] Failed:`, error.message);
      throw error; // Let BullMQ retry engine handle it
    }
  },
  {
    connection: redisConnection,
    concurrency: 50, // Process 50 jobs concurrently (Sharded across instances)
  }
);

dispatchWorker.on("completed", (job) => {
  console.log(`✅ Job ${job.id} completed!`);
});

dispatchWorker.on("failed", (job, err) => {
  console.log(`❌ Job ${job?.id} failed with ${err.message}`);
});
