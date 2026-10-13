import { sql } from 'drizzle-orm';
import { db } from '@/db';
export type SenderUsage = { accountUsed: number; campaignUsed: number };
export async function campaignSenderUsage(tenantId: string, campaignId: string, timezone: string, instanceId?: string, database: Pick<typeof db,'execute'> = db): Promise<Map<string, SenderUsage>> {
  const rows = await database.execute(sql`with bounds as (
    select date_trunc('day', now() at time zone 'UTC') as account_start,
      (date_trunc('day', now() at time zone ${timezone}) at time zone ${timezone}) at time zone 'UTC' as campaign_start
  ) select o.instance_id,
    count(*) filter(where coalesce(o.sent_at,o.updated_at) >= bounds.account_start)::int as account_used,
    count(*) filter(where o.campaign_id=${campaignId} and coalesce(o.sent_at,o.updated_at) >= bounds.campaign_start)::int as campaign_used
    from outbound_messages o cross join bounds
    where o.tenant_id=${tenantId} and o.campaign_id is not null and o.status in ('sending','uncertain','sent','delivered','read')
      and coalesce(o.sent_at,o.updated_at) >= least(bounds.account_start,bounds.campaign_start)
      ${instanceId ? sql`and o.instance_id=${instanceId}` : sql``}
    group by o.instance_id`);
  return new Map(rows.map(row => [String(row.instance_id), { accountUsed: Number(row.account_used), campaignUsed: Number(row.campaign_used) }]));
}
