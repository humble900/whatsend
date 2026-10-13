alter table public.campaigns add column if not exists stop_on_reply boolean not null default true;
create index if not exists idx_messages_campaign_reply
  on public.messages (tenant_id, remote_jid, created_at desc, instance_id)
  where is_from_me=false and message_type<>'reaction';
