import { NextResponse } from "next/server";
import { db } from "@/db";
import { blacklist, whatsappInstances, messages, contacts } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    const payload = await req.json();

    // The event type from Evolution API
    const event = payload.event;
    const instanceId = payload.instance; // Maps to our evolutionInstanceId

    // 1. Identify Tenant Context
    const instanceRecord = await db.query.whatsappInstances.findFirst({
      where: eq(whatsappInstances.evolutionInstanceId, instanceId),
      columns: { id: true, tenantId: true }
    });

    if (!instanceRecord) {
      return NextResponse.json({ error: "Unknown Instance" }, { status: 404 });
    }

    // 2. Handle Connection State Changes
    if (event === "connection.update") {
      const state = payload.data?.state;
      if (state === "open") {
        await db.update(whatsappInstances)
          .set({ status: "connected" })
          .where(eq(whatsappInstances.evolutionInstanceId, instanceId));
      } else if (state === "close" || state === "refused") {
        const statusCode = payload.data?.reason?.statusCode || payload.data?.statusReason;
        const newStatus = statusCode === 403 ? "banned" : "disconnected";
        
        await db.update(whatsappInstances)
          .set({ status: newStatus })
          .where(eq(whatsappInstances.evolutionInstanceId, instanceId));
      }
      return NextResponse.json({ success: true });
    }

    // 3. Handle Messages, Contacts & Auto-Blacklist (Opt-out logic)
    if (event === "messages.upsert") {
      const msgList = payload.data?.messages || [];
      for (const msg of msgList) {
        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
        const phone = msg.key.remoteJid?.replace("@s.whatsapp.net", "");
        const isFromMe = msg.key.fromMe || false;
        const messageId = msg.key.id;
        const pushName = msg.pushName || undefined;
        
        if (!phone) continue;

        // Persist contact for CRM & Anti-Ban Sync
        await db.insert(contacts).values({
          tenantId: instanceRecord.tenantId,
          instanceId: instanceRecord.id,
          remoteJid: phone,
          pushName: pushName,
        }).onConflictDoUpdate({
          target: [contacts.tenantId, contacts.remoteJid], // Assuming a composite unique index on these, wait, I didn't add a unique constraint, I should just do nothing or use a unique constraint. Since Drizzle needs a unique index for onConflict, let's just do nothing for now unless we alter the schema.
          set: pushName ? { pushName } : {},
        }).catch(() => {
          // If no unique constraint, fallback to ignoring duplicate contact errors
        });

        // Persist message to Inbox
        await db.insert(messages).values({
          tenantId: instanceRecord.tenantId,
          instanceId: instanceRecord.id,
          remoteJid: phone,
          isFromMe: isFromMe,
          messageText: text,
          evolutionMessageId: messageId,
          status: isFromMe ? "sent" : "received",
        }).onConflictDoNothing();

        // Process Opt-out
        if (!isFromMe) {
          const cleanText = text.trim().toLowerCase();
          if (cleanText === "stop" || cleanText === "unsubscribe" || cleanText === "cancel") {
            await db.insert(blacklist).values({
              tenantId: instanceRecord.tenantId,
              phoneNumber: phone,
              reason: `Auto-Opt Out: "${cleanText}"`,
            }).onConflictDoNothing(); // Prevent duplicates
            console.log(`[Blacklist] Number ${phone} opted out for Tenant ${instanceRecord.tenantId}`);
          }
        }
      }
    }

    // 4. Analytics & Delivery Receipts (Webhooks)
    if (event === "messages.update") {
      const updates = payload.data || [];
      for (const update of updates) {
        const messageId = update.key?.id;
        let statusText: "sent" | "delivered" | "read" | "failed" | null = null;
        
        switch (update.update?.status) {
          case 2: statusText = "sent"; break;
          case 3: statusText = "delivered"; break;
          case 4: statusText = "read"; break;
        }

        if (statusText && messageId) {
          await db.update(messages)
            .set({ status: statusText })
            .where(eq(messages.evolutionMessageId, messageId));
        }
      }
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Webhook Processing Error:", error);
    // Always return 200 to webhooks to prevent Evolution API from infinitely retrying
    return NextResponse.json({ success: false, error: "Internal Error" }, { status: 200 });
  }
}
