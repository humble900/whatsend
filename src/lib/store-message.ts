import { db } from "@/db";
import { messages, messageReceipts, outboundMessages } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { advanceReceipt } from "./messaging-contracts";

export async function storeMessage(values: typeof messages.$inferInsert) {
  return db.transaction(async tx => {
    if (values.evolutionMessageId) {
      const key = `${values.tenantId}:${values.instanceId}:${values.evolutionMessageId}`;
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`);
      const scope = and(eq(messages.tenantId, values.tenantId), eq(messages.instanceId, values.instanceId), eq(messages.evolutionMessageId, values.evolutionMessageId));
      const existing = await tx.query.messages.findFirst({ where: scope });
      if (existing) {
        // A SEND_MESSAGE webhook can arrive before the send response. Preserve
        // the verified target key when the webhook did not contain it.
        const payload=values.payload as {key?:{id?:string}}|null;
        if(existing.messageType==='reaction'&&values.messageType==='reaction'&&payload?.key?.id){
          const [enriched]=await tx.update(messages).set({payload:{...(existing.payload as object||{}),...(values.payload as object)},messageText:values.messageText}).where(scope).returning();
          return enriched;
        }
        return existing;
      }
      const receipt = await tx.query.messageReceipts.findFirst({ where: and(eq(messageReceipts.tenantId, values.tenantId), eq(messageReceipts.instanceId, values.instanceId), eq(messageReceipts.evolutionMessageId, values.evolutionMessageId)) });
      if (receipt && values.isFromMe) values.status = advanceReceipt(values.status || "sent", receipt.status);
    }
    const [stored] = await tx.insert(messages).values(values).returning();
    return stored;
  });
}
export async function storeReceipt(tenantId: string, instanceId: string, messageId: string, status: string) {
  await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`${tenantId}:${instanceId}:${messageId}`}))`);
    const scope = and(eq(messageReceipts.tenantId, tenantId), eq(messageReceipts.instanceId, instanceId), eq(messageReceipts.evolutionMessageId, messageId));
    const existing = await tx.query.messageReceipts.findFirst({ where: scope });
    const next = advanceReceipt(existing?.status || "sent", status);
    await tx.insert(messageReceipts).values({ tenantId, instanceId, evolutionMessageId: messageId, status: next }).onConflictDoUpdate({ target: [messageReceipts.tenantId, messageReceipts.instanceId, messageReceipts.evolutionMessageId], set: { status: next, updatedAt: new Date() } });
    const messageScope = and(eq(messages.tenantId, tenantId), eq(messages.instanceId, instanceId), eq(messages.evolutionMessageId, messageId), eq(messages.isFromMe, true));
    const stored = await tx.query.messages.findFirst({ where: messageScope });
    if (stored) await tx.update(messages).set({ status: advanceReceipt(stored.status, next) }).where(messageScope);
    const requestScope = and(eq(outboundMessages.tenantId, tenantId), eq(outboundMessages.instanceId, instanceId), eq(outboundMessages.evolutionMessageId, messageId));
    const request = await tx.query.outboundMessages.findFirst({ where: requestScope });
    if (request) await tx.update(outboundMessages).set({ status: advanceReceipt(request.status, next), updatedAt: new Date() }).where(requestScope);
  });
}
