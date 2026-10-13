import { NextResponse } from 'next/server';
import { db } from '@/db';
import { campaignLeads } from '@/db/schema';
import { and, eq, sql, asc } from 'drizzle-orm';
import { requireAuthAndTenant } from '@/lib/auth';
import { authenticationError } from '@/lib/api-error';
import { getCampaignContext } from '@/lib/campaign-service';
import { leadVariables } from '@/lib/campaign-personalization';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await requireAuthAndTenant(req.headers.get('Authorization'));
    const { id } = await params;
    await getCampaignContext(id, tenantId);
    const [keys, leads] = await Promise.all([
      db.execute(sql`select distinct k.key from campaign_leads l cross join lateral jsonb_object_keys(coalesce(l.variables,'{}'::jsonb)) k(key) where l.tenant_id=${tenantId} and l.campaign_id=${id} order by k.key`),
      db.query.campaignLeads.findMany({ where: and(eq(campaignLeads.tenantId, tenantId), eq(campaignLeads.campaignId, id)), columns: { id: true, name: true, phone: true, variables: true }, orderBy: [asc(campaignLeads.createdAt), asc(campaignLeads.id)], limit: 10 }),
    ]);
    return NextResponse.json({ variables: [...new Set(['name', 'first_name', 'last_name', 'phone', ...keys.map(row => String(row.key).trim()).filter(key => key && !key.startsWith('_'))])], samples: leads.map(lead => ({ id: lead.id, name: lead.name, values: leadVariables({ ...lead, variables: lead.variables as Record<string, string> }) })) });
  } catch (error) {
    return authenticationError(error) || NextResponse.json({ error: 'Could not load campaign variables.' }, { status: 500 });
  }
}
