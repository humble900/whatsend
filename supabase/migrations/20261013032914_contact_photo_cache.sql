create table public.contact_photos (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id) on delete cascade,
 instance_id uuid not null references public.whatsapp_instances(id) on delete cascade,
 remote_jid varchar(50) not null,url text,
 checked_at timestamp not null default now(),expires_at timestamp not null,
 constraint contact_photos_account_recipient unique(tenant_id,instance_id,remote_jid)
);
alter table public.contact_photos enable row level security;
revoke all on public.contact_photos from anon,authenticated;
