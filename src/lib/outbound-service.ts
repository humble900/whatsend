import { createHash } from "node:crypto";
import { db } from "@/db";
import { outboundMessages, whatsappInstances, messages, blacklist, contacts } from "@/db/schema";
import { and, eq, desc, sql } from "drizzle-orm";
import { outboundPayloadSchema, payloadPreview, phoneSchema, isOptOut, type OutboundPayload } from "./messaging-contracts";
import { EvolutionError, sendEvolutionPayload } from "./evolution";
import { storeMessage, storeReceipt } from "./store-message";

export class MessagingError extends Error { constructor(message: string, public status = 400, public outboundId?: string) { super(message); } }
export async function createOutbound(input: { tenantId: string; instanceId: string; campaignId?: string; requestKey: string; phone: string; payload: OutboundPayload; userId?: string }) {
  const payload = outboundPayloadSchema.parse(input.payload);
  const remoteJid = `${phoneSchema.parse(input.phone)}@s.whatsapp.net`;
  const hash = createHash("sha256").update(JSON.stringify({ instanceId: input.instanceId, remoteJid, payload })).digest("hex");
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`${input.tenantId}:${input.requestKey}`}))`);
    const existing = await tx.query.outboundMessages.findFirst({ where: and(eq(outboundMessages.tenantId, input.tenantId), eq(outboundMessages.requestKey, input.requestKey)) });
    if (existing) { if (existing.requestHash !== hash) throw new MessagingError("This request ID was already used for a different message.", 409); return existing; }
    const instance = await tx.query.whatsappInstances.findFirst({ where: and(eq(whatsappInstances.id, input.instanceId), eq(whatsappInstances.tenantId, input.tenantId)) });
    if (!instance) throw new MessagingError("WhatsApp connection was not found.", 404);
    const [row] = await tx.insert(outboundMessages).values({ tenantId: input.tenantId, instanceId: input.instanceId, campaignId: input.campaignId, requestKey: input.requestKey, requestHash: hash, remoteJid, payload, messageText: payloadPreview(payload), consentConfirmedBy: input.userId }).returning();
    return row;
  });
}
export async function assertReplyAllowed(tenantId: string, instanceId: string, jid: string) {
  const optedOut = await db.query.blacklist.findFirst({ where: and(eq(blacklist.tenantId, tenantId), eq(blacklist.phoneNumber, jid)), orderBy: [desc(blacklist.createdAt)] });
  if (!optedOut) return;
  const inbound = await db.query.messages.findFirst({ where: and(eq(messages.tenantId, tenantId), eq(messages.instanceId, instanceId), eq(messages.remoteJid, jid), eq(messages.isFromMe, false)), orderBy: [desc(messages.createdAt)] });
  if (!inbound || inbound.createdAt <= optedOut.createdAt || isOptOut(inbound.messageText || "")) throw new MessagingError("This customer opted out. They must request a new conversation before you can reply.", 409);
}
export async function dispatchOutbound(id: string, tenantId: string) {
  const row = await db.transaction(async tx => {
    const [current] = await tx.select().from(outboundMessages).where(and(eq(outboundMessages.id, id), eq(outboundMessages.tenantId, tenantId))).for("update");
    if (!current) throw new MessagingError("Message request was not found.", 404);
    if (["sent", "delivered", "read"].includes(current.status)) return current;
    if (current.status !== "queued") throw new MessagingError(current.status === "uncertain" ? "Delivery is uncertain. Check message history before sending again." : current.status === "sending" ? "This message is already being sent." : current.lastError || "This message is not ready to send.", 409, current.id);
    const [claimed] = await tx.update(outboundMessages).set({ status: "sending", attempts: sql`${outboundMessages.attempts} + 1`, updatedAt: new Date() }).where(eq(outboundMessages.id, id)).returning();
    return claimed;
  });
  if (["sent", "delivered", "read"].includes(row.status)) return row;
  try {
    const instance = await db.query.whatsappInstances.findFirst({ where: and(eq(whatsappInstances.id, row.instanceId), eq(whatsappInstances.tenantId, tenantId)) });
    if (!instance || instance.status !== "connected") throw new EvolutionError("WhatsApp connection is not connected.", 409);
    const result = await sendEvolutionPayload(instance.evolutionInstanceId, row.remoteJid, row.payload as OutboundPayload);
    await db.update(outboundMessages).set({ evolutionMessageId: result.key.id, sentAt: new Date() }).where(eq(outboundMessages.id, id));
    await db.insert(contacts).values({ tenantId, instanceId: row.instanceId, remoteJid: row.remoteJid }).onConflictDoUpdate({ target: [contacts.tenantId, contacts.remoteJid], set: { remoteJid: row.remoteJid } });
    const stored = await storeMessage({ tenantId, instanceId: row.instanceId, remoteJid: row.remoteJid, isFromMe: true, messageText: row.messageText, messageType: (row.payload as OutboundPayload).type, payload: row.payload, evolutionMessageId: result.key.id, status: "sent" });
    // Receipt persistence uses the same message lock and cannot regress a newer acknowledgement.
    await storeReceipt(tenantId, row.instanceId, result.key.id, stored.status);
    await db.update(outboundMessages).set({ updatedAt: new Date(), lastError: null }).where(eq(outboundMessages.id, id));
    return (await db.query.outboundMessages.findFirst({ where: and(eq(outboundMessages.id, id), eq(outboundMessages.tenantId, tenantId)) }))!;
  } catch (cause) {
    const uncertain = !(cause instanceof EvolutionError) || cause.uncertain;
    const error = cause instanceof Error ? cause.message : "Sending failed.";
    await db.update(outboundMessages).set({ status: sql`case when ${outboundMessages.status} in ('sent','delivered','read') then ${outboundMessages.status} else ${uncertain ? "uncertain" : "failed"} end`, lastError: error.slice(0,500), updatedAt: new Date() }).where(eq(outboundMessages.id, id));
    throw new MessagingError(uncertain ? "Delivery could not be confirmed. Check message history before retrying." : error, uncertain ? 504 : 422, id);
  }
}
