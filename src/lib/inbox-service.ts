import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export const inboxFilterSchema = z.object({
  campaignId: z.uuid().optional(), instanceId: z.uuid().optional(),
  q: z.string().trim().max(120).default(""), unread: z.enum(["true", "false"]).default("false"),
  offset: z.coerce.number().int().min(0).max(1000000).default(0),
});
export const inboxOptionSchema = z.object({
  kind: z.enum(["campaign", "account"]), campaignId: z.uuid().optional(),
  q: z.string().trim().max(120).default(""), offset: z.coerce.number().int().min(0).max(1000000).default(0),
});
const pageSize = 50;
const searchPattern = (value: string) => `%${value.replace(/[\\%_]/g, "\\$&")}%`;
const phoneSearchPattern = (value: string) => searchPattern(value.replace(/[+()\s-]/g,"") || value);

export async function listInbox(tenantId: string, filters: z.infer<typeof inboxFilterSchema>) {
  const scope = sql`r.tenant_id=${tenantId}
    ${filters.instanceId ? sql`and r.instance_id=${filters.instanceId}` : sql``}
    ${filters.campaignId ? sql`and exists (
      select 1 from outbound_messages campaign_send
      where campaign_send.tenant_id=${tenantId} and campaign_send.campaign_id=${filters.campaignId}
        and campaign_send.instance_id=r.instance_id and campaign_send.remote_jid=r.remote_jid
    )` : sql``}`;
  const rows = await db.execute(sql`
    with latest_messages as (
      select distinct on (r.instance_id,r.remote_jid) r.instance_id,r.remote_jid,r.message_text,r.created_at
      from messages r where ${scope} and r.message_type<>'reaction'
      order by r.instance_id,r.remote_jid,r.created_at desc,r.id desc
    ), latest_pending as (
      select distinct on (r.instance_id,r.remote_jid) r.instance_id,r.remote_jid,r.message_text,r.created_at
      from outbound_messages r where ${scope} and r.status in ('queued','sending','uncertain','failed') and r.payload->>'type'<>'reaction'
      order by r.instance_id,r.remote_jid,r.created_at desc,r.id desc
    ), latest as (
      select distinct on (instance_id,remote_jid) * from (
        select * from latest_messages union all select * from latest_pending
      ) combined order by instance_id,remote_jid,created_at desc
    )
    select l.instance_id,l.remote_jid,l.message_text,l.created_at at time zone 'UTC' as time,
      coalesce(nullif(c.push_name,''),'+'||replace(l.remote_jid,'@s.whatsapp.net','')) as name,
      w.name as account_name,w.phone_number as account_phone,p.url as photo_url,
      (select count(*)::int from messages u where u.tenant_id=${tenantId} and u.instance_id=l.instance_id
        and u.remote_jid=l.remote_jid and u.is_from_me=false and u.status<>'read') as unread
    from latest l join whatsapp_instances w on w.id=l.instance_id and w.tenant_id=${tenantId}
    left join contacts c on c.tenant_id=${tenantId} and c.remote_jid=l.remote_jid
    left join contact_photos p on p.tenant_id=${tenantId} and p.instance_id=l.instance_id and p.remote_jid=l.remote_jid and p.expires_at>now()
    where true
      ${filters.q ? sql`and (coalesce(c.push_name,'') ilike ${searchPattern(filters.q)} or l.remote_jid ilike ${phoneSearchPattern(filters.q)})` : sql``}
      ${filters.unread === "true" ? sql`and exists (select 1 from messages u where u.tenant_id=${tenantId} and u.instance_id=l.instance_id and u.remote_jid=l.remote_jid and u.is_from_me=false and u.status<>'read')` : sql``}
    order by l.created_at desc,l.instance_id,l.remote_jid limit ${pageSize+1} offset ${filters.offset}
  `);
  return { conversations: rows.slice(0,pageSize).map(row => ({
    id: String(row.remote_jid), instanceId: String(row.instance_id),
    phone: String(row.remote_jid).replace("@s.whatsapp.net", ""), name: String(row.name),
    lastMessage: String(row.message_text || ""), time: new Date(row.time as string).toISOString(),
    unread: Number(row.unread), accountName: String(row.account_name), accountPhone: row.account_phone,photoUrl:row.photo_url,
  })), hasMore: rows.length>pageSize, pageSize };
}

export async function listInboxOptions(tenantId: string, filters: z.infer<typeof inboxOptionSchema>) {
  const rows = filters.kind === "campaign" ? await db.execute(sql`
    select id,name,status from campaigns where tenant_id=${tenantId}
      ${filters.q ? sql`and name ilike ${searchPattern(filters.q)}` : sql``}
    order by created_at desc,id limit ${pageSize+1} offset ${filters.offset}
  `) : await db.execute(sql`
    select w.id,w.name,w.status,w.phone_number from whatsapp_instances w where w.tenant_id=${tenantId}
      ${filters.campaignId ? sql`and (exists (select 1 from campaign_accounts a join campaigns c on c.id=a.campaign_id where a.instance_id=w.id and a.campaign_id=${filters.campaignId} and c.tenant_id=${tenantId}) or exists (select 1 from outbound_messages o where o.tenant_id=${tenantId} and o.campaign_id=${filters.campaignId} and o.instance_id=w.id))` : sql``}
      ${filters.q ? sql`and (w.name ilike ${searchPattern(filters.q)} or coalesce(w.phone_number,'') ilike ${phoneSearchPattern(filters.q)})` : sql``}
    order by w.name,w.id limit ${pageSize+1} offset ${filters.offset}
  `);
  return { options: rows.slice(0,pageSize).map(row=>({id:String(row.id),name:String(row.name),detail:filters.kind === "account" ? [row.phone_number ? `+${row.phone_number}` : null,row.status].filter(Boolean).join(" · ") : String(row.status)})),hasMore:rows.length>pageSize };
}
