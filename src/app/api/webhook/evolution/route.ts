import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { db } from "@/db";
import { contacts, whatsappInstances } from "@/db/schema";
import { saveContactPhoto } from "@/lib/contact-photo";
import { eq } from "drizzle-orm";
import { eventItems, phoneJid, receiptStatus } from "@/lib/evolution-events";
import { receiveEvolutionMessage } from "@/lib/inbound-message";
import { storeReceipt } from "@/lib/store-message";

export async function POST(req: Request) {
  const expected = process.env.EVOLUTION_WEBHOOK_SECRET;
  if (!expected) return NextResponse.json({ error: "Webhook is not configured." }, { status: 503 });
  const supplied = req.headers.get("x-whatsend-webhook-secret") || "";
  if (Buffer.byteLength(supplied) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return NextResponse.json({ error: "Unauthorized webhook." }, { status: 401 });
  try {
    const payload = await req.json();
    if (typeof payload.instance !== "string" || typeof payload.event !== "string") return NextResponse.json({ error: "Invalid webhook." }, { status: 400 });
    const instance = await db.query.whatsappInstances.findFirst({ where: eq(whatsappInstances.evolutionInstanceId, payload.instance) });
    if (!instance) return NextResponse.json({ ignored: "unknown_instance" });
    const event = payload.event.replace(/[.-]/g, "_").toUpperCase();
    if (event === "CONNECTION_UPDATE") {
      const state = payload.data?.state === "refused" ? "close" : payload.data?.state;
      if (["open", "close", "connecting"].includes(state)) await db.update(whatsappInstances).set({ status: state === "open" ? "connected" : state === "connecting" ? "connecting" : "disconnected", ...(payload.data?.wuid ? { phoneNumber: String(payload.data.wuid).split("@")[0].split(":")[0] } : {}) }).where(eq(whatsappInstances.id, instance.id));
    } else if (["MESSAGES_UPSERT", "SEND_MESSAGE"].includes(event)) {
      for (const msg of eventItems(payload.data)) await receiveEvolutionMessage(instance.tenantId, instance.id, msg);
    } else if (event === "MESSAGES_UPDATE") {
      for (const update of eventItems(payload.data)) {
        const status = receiptStatus(update); const id = update.key?.id || update.keyId;
        if (status && typeof id === "string") await storeReceipt(instance.tenantId, instance.id, id, status);
      }
    } else if (["CONTACTS_UPSERT", "CONTACTS_UPDATE"].includes(event)) {
      for (const contact of eventItems(payload.data)) {
        const jid = phoneJid({ remoteJid: contact.remoteJid || contact.id });
        if (!jid) continue;
        const pushName = contact.pushName || contact.notify;
        if(Object.prototype.hasOwnProperty.call(contact,"profilePicUrl"))await saveContactPhoto(instance.tenantId,instance.id,jid,contact.profilePicUrl);
        await db.insert(contacts).values({ tenantId: instance.tenantId, instanceId: instance.id, remoteJid: jid, pushName: typeof pushName === "string" ? pushName.slice(0,255) : null }).onConflictDoUpdate({ target: [contacts.tenantId, contacts.remoteJid], set: { remoteJid: jid, ...(typeof pushName === "string" ? { pushName: pushName.slice(0,255) } : {}) } });
      }
    }
    return NextResponse.json({ success: true });
  } catch { console.error("Evolution webhook persistence failed"); return NextResponse.json({ error: "Webhook could not be persisted. Retry the event." }, { status: 500 }); }
}
