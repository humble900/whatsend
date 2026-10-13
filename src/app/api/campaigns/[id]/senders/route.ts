import { NextResponse } from 'next/server';
import { db } from '@/db';
import { whatsappInstances } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import { requireAuthAndTenant } from '@/lib/auth';
import { authenticationError } from '@/lib/api-error';
import { getCampaignContext } from '@/lib/campaign-service';
import { campaignSenderUsage } from '@/lib/campaign-usage';
import { MessagingError } from '@/lib/outbound-service';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await requireAuthAndTenant(req.headers.get('Authorization'));
    const campaign = await getCampaignContext((await params).id, tenantId);
    const [accounts, usage] = await Promise.all([
      db.query.whatsappInstances.findMany({ where: eq(whatsappInstances.tenantId, tenantId), columns: { id: true, name: true, phoneNumber: true, status: true, dailyLimit: true }, orderBy: [asc(whatsappInstances.name), asc(whatsappInstances.id)] }),
      campaignSenderUsage(tenantId, campaign.id, campaign.timezone),
    ]);
    return NextResponse.json({ accounts: accounts.map(account => ({ ...account, ...(usage.get(account.id) || { accountUsed: 0, campaignUsed: 0 }) })) });
  } catch (error) { return authenticationError(error) || NextResponse.json({ error: error instanceof MessagingError ? error.message : 'Could not load sending accounts.' }, { status: error instanceof MessagingError ? error.status : 500 }); }
}
