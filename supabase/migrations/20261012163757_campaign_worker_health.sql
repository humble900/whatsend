create table public.campaign_worker_health (
 id uuid primary key,
 last_seen_at timestamp not null default now()
);
create index campaign_worker_health_seen on public.campaign_worker_health(last_seen_at);
alter table public.campaign_worker_health enable row level security;
revoke all on public.campaign_worker_health from anon, authenticated;
