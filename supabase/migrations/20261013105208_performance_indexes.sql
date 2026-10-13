-- Match tenant-scoped dashboard, pagination, quota and queue access paths.
create index if not exists messages_dashboard_activity on public.messages(tenant_id,created_at desc) include(status) where is_from_me=true;
create index if not exists contacts_tenant_created on public.contacts(tenant_id,created_at desc,id);
create index if not exists contacts_tenant_list_created on public.contacts(tenant_id,(metadata->>'_listName'),created_at desc,id);
create index if not exists campaigns_tenant_created on public.campaigns(tenant_id,created_at desc,id);
create index if not exists outbound_account_daily_sent on public.outbound_messages(tenant_id,instance_id,sent_at desc) where campaign_id is not null and status in ('sent','delivered','read');
create index if not exists outbound_queue_recovery on public.outbound_messages(created_at,id,campaign_id) where status='queued' and campaign_id is not null;
create index if not exists messages_reaction_target on public.messages(tenant_id,instance_id,remote_jid,(payload->'key'->>'id'),created_at desc) where message_type='reaction';
create index if not exists outbound_campaign_contact on public.outbound_messages(tenant_id,campaign_id,remote_jid,created_at desc) include(status,instance_id,sent_at);
