create table if not exists public.message_assets (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id) on delete cascade,
 content_hash varchar(64) not null, data text not null,
 created_at timestamp not null default now(), unique(tenant_id,content_hash)
);
alter table public.message_assets enable row level security;
revoke all on public.message_assets from anon,authenticated;
alter table public.campaign_worker_health add column if not exists shared_media_ready boolean not null default false;
