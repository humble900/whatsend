create index if not exists idx_outbound_campaign_quota_usage
  on public.outbound_messages (tenant_id, instance_id, (coalesce(sent_at,updated_at)))
  where campaign_id is not null and status in ('sending','uncertain','sent','delivered','read');
