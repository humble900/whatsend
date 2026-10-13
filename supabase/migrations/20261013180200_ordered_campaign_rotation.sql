alter table public.outbound_messages add column if not exists campaign_sequence integer;
alter table public.campaign_worker_health add column if not exists rotation_ready boolean not null default false;
create index if not exists idx_outbound_account_sequence
  on public.outbound_messages (tenant_id,campaign_id,instance_id,campaign_sequence)
  where status in ('queued','sending');
create index if not exists idx_outbound_ordered_recovery
  on public.outbound_messages (created_at,campaign_sequence,id)
  where status='queued' and campaign_id is not null;
