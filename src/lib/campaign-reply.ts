import { db } from '@/db';
import { messages } from '@/db/schema';
import { and, eq, gte, ne, sql } from 'drizzle-orm';
export async function campaignReplyExists(tenantId: string, campaignId: string, jid: string, since: Date, database: Pick<typeof db,'query'> = db) {
  return Boolean(await database.query.messages.findFirst({ where: and(eq(messages.tenantId,tenantId),eq(messages.remoteJid,jid),eq(messages.isFromMe,false),ne(messages.messageType,'reaction'),gte(messages.createdAt,since),sql`${messages.instanceId} in (select instance_id from campaign_accounts where campaign_id=${campaignId})`),columns:{id:true} }));
}
