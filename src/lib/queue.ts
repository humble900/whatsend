import { Queue, Worker, QueueEvents } from "bullmq";
import Redis from "ioredis";

// Use an external Redis cluster (Upstash/Railway) for job queues. 
// Do NOT use the same Redis used by Evolution API to prevent cache eviction cross-contamination.
const REDIS_QUEUE_URL = process.env.REDIS_QUEUE_URL!;

export const redisConnection = new Redis(REDIS_QUEUE_URL, {
  maxRetriesPerRequest: null,
});

// The main high-throughput queue for sending WhatsApp messages
export const campaignQueue = new Queue("whatsapp-campaign-dispatch", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3, // Retry if network fails
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: true, // Keep Redis memory clean
  },
});

// Events listener for tracking dashboard stats
export const campaignQueueEvents = new QueueEvents("whatsapp-campaign-dispatch", {
  connection: redisConnection,
});
