import { createClient } from "@clickhouse/client";

// High-speed columnar database for billions of delivery receipts
const clickhouseUrl = process.env.CLICKHOUSE_URL || "http://localhost:8123";
const clickhouseUser = process.env.CLICKHOUSE_USER || "default";
const clickhousePassword = process.env.CLICKHOUSE_PASSWORD || "";

export const clickhouse = createClient({
  url: clickhouseUrl,
  username: clickhouseUser,
  password: clickhousePassword,
});

/**
 * ClickHouse Analytics Table Setup (To be run on initialization or migrations).
 * This table is strictly append-only. No UPDATEs or DELETEs.
 */
export async function setupClickHouseTables() {
  await clickhouse.exec({
    query: `
      CREATE TABLE IF NOT EXISTS message_analytics (
        tenant_id UUID,
        campaign_id UUID,
        evolution_instance_id String,
        target_phone String,
        status Enum8('sent' = 1, 'delivered' = 2, 'read' = 3, 'failed' = 4),
        timestamp DateTime,
        latency_ms UInt32
      ) ENGINE = MergeTree()
      ORDER BY (tenant_id, campaign_id, timestamp);
    `
  });
}

export async function logMessageStatus(payload: {
  tenantId: string;
  campaignId: string;
  evolutionInstanceId: string;
  targetPhone: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
}) {
  await clickhouse.insert({
    table: 'message_analytics',
    values: [
      {
        tenant_id: payload.tenantId,
        campaign_id: payload.campaignId,
        evolution_instance_id: payload.evolutionInstanceId,
        target_phone: payload.targetPhone,
        status: payload.status,
        timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
        latency_ms: 0, // Calculate later based on job queue time if needed
      }
    ],
    format: 'JSONEachRow',
  });
}
