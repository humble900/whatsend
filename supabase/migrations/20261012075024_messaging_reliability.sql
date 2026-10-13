-- Additive migration. All messaging tables are server-only and tenant-scoped.
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS official_api_credentials jsonb;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS timezone varchar(100) NOT NULL DEFAULT 'UTC';
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS consent_confirmed_at timestamp;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS message_type varchar(30) NOT NULL DEFAULT 'text';
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS payload jsonb;

CREATE TABLE IF NOT EXISTS public.campaign_leads (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
 phone varchar(20) NOT NULL, name varchar(255), variables jsonb NOT NULL DEFAULT '{}',
 created_at timestamp NOT NULL DEFAULT now(), UNIQUE(campaign_id, phone)
);
CREATE INDEX IF NOT EXISTS campaign_leads_tenant_campaign ON public.campaign_leads(tenant_id,campaign_id);
CREATE TABLE IF NOT EXISTS public.outbound_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 instance_id uuid NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
 campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE,
 request_key varchar(255) NOT NULL, request_hash varchar(64) NOT NULL,
 remote_jid varchar(50) NOT NULL, payload jsonb NOT NULL, message_text text NOT NULL,
 status varchar(30) NOT NULL DEFAULT 'queued', evolution_message_id varchar(255),
 attempts integer NOT NULL DEFAULT 0, last_error text, consent_confirmed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
 created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now(), sent_at timestamp,
 UNIQUE(tenant_id,request_key)
);
CREATE INDEX IF NOT EXISTS outbound_campaign_status ON public.outbound_messages(tenant_id,campaign_id,status);
CREATE INDEX IF NOT EXISTS outbound_provider_message ON public.outbound_messages(tenant_id,instance_id,evolution_message_id);
CREATE TABLE IF NOT EXISTS public.message_receipts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 instance_id uuid NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
 evolution_message_id varchar(255) NOT NULL, status varchar(30) NOT NULL,
 updated_at timestamp NOT NULL DEFAULT now(), UNIQUE(tenant_id,instance_id,evolution_message_id)
);
ALTER TABLE public.campaign_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbound_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.campaign_leads, public.outbound_messages, public.message_receipts FROM anon, authenticated;
