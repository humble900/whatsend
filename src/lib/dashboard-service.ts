import {db} from '@/db';
import {campaigns} from '@/db/schema';
import {eq,desc,sql} from 'drizzle-orm';
export async function dashboardSummary(tenantId:string,now=new Date()) {
 const since=new Date(now.getTime()-24*3600000);
 const [summary,recent]=await Promise.all([
  db.execute(sql`with instance_stats as (
    select count(*)::int as total_instances,count(*) filter(where status='connected')::int as active_instances,
      coalesce(sum(daily_limit),0) as daily_capacity,coalesce(sum(messages_sent_today),0) as daily_used
    from whatsapp_instances where tenant_id=${tenantId}
  ), campaign_stats as (
    select count(*) filter(where status='running')::int as running_campaigns,coalesce(sum(contacts_processed),0) as total_messages_sent
    from campaigns where tenant_id=${tenantId}
  ), activity as (
    select floor(extract(epoch from (created_at-${since.toISOString()}::timestamptz))/3600)::int as hour,
      count(*)::int as count,count(*) filter(where status in ('delivered','read'))::int as delivered,
      count(*) filter(where status='failed')::int as failed
    from messages where tenant_id=${tenantId} and is_from_me=true and created_at>=${since.toISOString()}::timestamptz group by 1
  ) select instance_stats.*,campaign_stats.*,
    (select count(*)::int from contacts where tenant_id=${tenantId}) as total_contacts,
    coalesce((select sum(count) from activity),0) as messages_sent_24h,
    coalesce((select sum(delivered) from activity),0) as delivered_24h,
    coalesce((select sum(failed) from activity),0) as failed_24h,
    coalesce((select json_agg(json_build_object('hour',hour,'count',count)) from activity),'[]'::json) as hours
    from instance_stats cross join campaign_stats`),
  db.query.campaigns.findMany({where:eq(campaigns.tenantId,tenantId),orderBy:[desc(campaigns.createdAt)],limit:5,columns:{id:true,name:true,status:true,totalContacts:true,contactsProcessed:true,createdAt:true}}),
 ]);
 const row=summary[0];const total=Number(row.messages_sent_24h);
 const hours=new Map((row.hours as {hour:number;count:number}[]).map(item=>[item.hour,item.count]));
 return {hourlyActivity:Array.from({length:24},(_,hour)=>({timestamp:new Date(since.getTime()+hour*3600000).toISOString(),count:hours.get(hour)||0})),stats:{activeInstances:Number(row.active_instances),totalInstances:Number(row.total_instances),messagesSent24h:total,deliveryRate:total?`${(Number(row.delivered_24h)/total*100).toFixed(1)}%`:'—',failed24h:Number(row.failed_24h),runningCampaigns:Number(row.running_campaigns),totalContacts:Number(row.total_contacts),dailyCapacity:Number(row.daily_capacity),dailyUsed:Number(row.daily_used),totalMessagesSent:Number(row.total_messages_sent)},recentCampaigns:recent.map(campaign=>({...campaign,progress:campaign.totalContacts?Math.round(campaign.contactsProcessed/campaign.totalContacts*100):0}))};
}
