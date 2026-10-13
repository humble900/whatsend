drop index if exists public.idx_outbound_account_sequence;
create index idx_outbound_account_sequence
  on public.outbound_messages (tenant_id,campaign_id,instance_id,campaign_sequence)
  where status in ('queued','sending','uncertain');
