import {db} from '@/db';
import {sql} from 'drizzle-orm';
export async function campaignLeadOverview(tenantId:string,campaignId:string){
 const rows=await db.execute(sql`select l.*,
   case when exists(select 1 from blacklist b where b.tenant_id=${tenantId} and b.phone_number=l.phone||'@s.whatsapp.net') then 'lost'
    when o.sent_at is not null and exists(select 1 from messages m where m.tenant_id=${tenantId} and m.instance_id=o.instance_id and m.remote_jid=o.remote_jid and m.is_from_me=false and m.message_type<>'reaction' and m.created_at>o.sent_at) then 'replied' else 'new' end as lead_status,
   o.status as message_status
   from campaign_leads l left join lateral (
    select status,instance_id,remote_jid,sent_at from outbound_messages
    where tenant_id=${tenantId} and campaign_id=${campaignId} and remote_jid=l.phone||'@s.whatsapp.net' order by created_at desc limit 1
   ) o on true where l.tenant_id=${tenantId} and l.campaign_id=${campaignId} order by l.created_at,l.id`);
 return rows.map(row=>({id:row.id,tenantId:row.tenant_id,campaignId:row.campaign_id,phone:row.phone,name:row.name,variables:row.variables,createdAt:row.created_at,source:'Campaign',leadStatus:row.lead_status,waVerified:'unverified',messageStatus:row.message_status}));
}
