import { db } from "@/db";
import { blacklist, contacts } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { storeMessage } from "./store-message";
import { phoneJid } from "./evolution-events";
import { isOptOut } from "./messaging-contracts";

export async function receiveEvolutionMessage(tenantId: string, instanceId: string, msg: any) {
  const jid = phoneJid(msg.key);
  if (!jid || typeof msg.key?.id !== "string" || !msg.message) return;
  let content = msg.message;
  for (let depth = 0; depth < 5; depth++) {
    const nested = content.ephemeralMessage?.message || content.viewOnceMessage?.message || content.viewOnceMessageV2?.message || content.documentWithCaptionMessage?.message;
    if (!nested) break; content = nested;
  }
  const poll = content.pollCreationMessage || content.pollCreationMessageV2 || content.pollCreationMessageV3;
  const type = content.imageMessage ? "image" : content.videoMessage || content.ptvMessage ? "video" : content.audioMessage ? "audio" : content.documentMessage ? "document" : content.stickerMessage ? "sticker" : content.reactionMessage ? "reaction" : content.locationMessage ? "location" : content.contactMessage || content.contactsArrayMessage ? "contacts" : poll ? "poll" : "text";
  const text = content.conversation || content.extendedTextMessage?.text || content.imageMessage?.caption || content.videoMessage?.caption || content.documentMessage?.caption || content.buttonsResponseMessage?.selectedDisplayText || content.listResponseMessage?.title || content.templateButtonReplyMessage?.selectedDisplayText || poll?.name || content.contactMessage?.displayName || (content.locationMessage ? `${content.locationMessage.name || "Location"}\n${content.locationMessage.address || ""}\n${content.locationMessage.degreesLatitude}, ${content.locationMessage.degreesLongitude}` : type === "reaction" ? content.reactionMessage.text : type !== "text" ? `[${type}]` : "[Unsupported message]");
  if (typeof text !== "string") return;
  // On outgoing messages pushName names the sender, not the customer.
  const pushName = !msg.key.fromMe && typeof msg.pushName === "string" ? msg.pushName.slice(0, 255) : undefined;
  await db.insert(contacts).values({ tenantId, instanceId, remoteJid: jid, pushName }).onConflictDoUpdate({ target: [contacts.tenantId, contacts.remoteJid], set: { remoteJid: jid, ...(pushName ? { pushName } : {}) } });
  const timestamp = Number(msg.messageTimestamp);
  const createdAt = Number.isFinite(timestamp) && timestamp > 0 && timestamp < Date.now() / 1000 + 300 ? new Date(timestamp * 1000) : new Date();
  await storeMessage({ tenantId, instanceId, remoteJid: jid, isFromMe: msg.key.fromMe === true, messageText: text, messageType: type, payload: { type, text, ...(content.reactionMessage ? {key:content.reactionMessage.key,reaction:content.reactionMessage.text||'',actor:msg.key.participant||jid} : {}), ...(content.documentMessage?.fileName ? { fileName: content.documentMessage.fileName } : {}) }, evolutionMessageId: msg.key.id, status: msg.key.fromMe ? "sent" : "received", createdAt });
  if (!msg.key.fromMe && isOptOut(text)) {
    const existing = await db.query.blacklist.findFirst({ where: and(eq(blacklist.tenantId, tenantId), eq(blacklist.phoneNumber, jid)) });
    if (!existing) await db.insert(blacklist).values({ tenantId, phoneNumber: jid, reason: "Recipient opted out via WhatsApp" });
  }
}
