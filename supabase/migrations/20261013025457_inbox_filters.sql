-- Tenant first: per-account conversations and campaign membership, without truncating history.
create index if not exists messages_inbox_latest on public.messages(tenant_id,instance_id,remote_jid,created_at desc,id desc);
create index if not exists messages_inbox_unread on public.messages(tenant_id,instance_id,remote_jid) where is_from_me=false and status<>'read';
create index if not exists outbound_inbox_campaign on public.outbound_messages(tenant_id,campaign_id,instance_id,remote_jid);
create index if not exists outbound_inbox_pending on public.outbound_messages(tenant_id,instance_id,remote_jid,created_at desc) where status in ('queued','sending','uncertain','failed');
