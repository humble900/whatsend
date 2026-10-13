-- Browser clients use authenticated Next.js routes. Only the server database
-- role may access workspace records and provider credentials directly.
alter table public.tenants enable row level security;
alter table public.users enable row level security;
alter table public.proxies enable row level security;
alter table public.whatsapp_instances enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_accounts enable row level security;
alter table public.blacklist enable row level security;
alter table public.messages enable row level security;
alter table public.contacts enable row level security;
revoke all on public.tenants, public.users, public.proxies,
 public.whatsapp_instances, public.campaigns, public.campaign_accounts,
 public.blacklist, public.messages, public.contacts from anon, authenticated;
