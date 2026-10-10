import { NextResponse } from "next/server";
import { requireAuthAndTenant } from "@/lib/auth";
import { db } from "@/db";
import { contacts, messages, whatsappInstances } from "@/db/schema";
import { eq, desc, inArray, sql } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    const { tenantId } = await requireAuthAndTenant(authHeader);

    // Fetch all contacts for this tenant
    // In a massive scale setup, we'd paginate this and only fetch contacts with recent messages
    const tenantContacts = await db.query.contacts.findMany({
      where: eq(contacts.tenantId, tenantId),
      orderBy: [desc(contacts.createdAt)],
      limit: 100
    });

    if (tenantContacts.length === 0) {
      return NextResponse.json({ conversations: [] });
    }

    // Get the latest message for each contact to populate the inbox preview
    const jids = tenantContacts.map(c => c.remoteJid);
    const recentMessages = await db.query.messages.findMany({
      where: inArray(messages.remoteJid, jids),
      orderBy: [desc(messages.createdAt)],
    });

    // Grouping
    const conversations = tenantContacts.map(contact => {
      const contactMsgs = recentMessages.filter(m => m.remoteJid === contact.remoteJid);
      const lastMessage = contactMsgs[0];
      const unread = contactMsgs.filter(m => !m.isFromMe && m.status !== "read").length;

      return {
        id: contact.remoteJid,
        name: contact.pushName || "Unknown Contact",
        phone: contact.remoteJid,
        lastMessage: lastMessage?.messageText || "",
        time: lastMessage?.createdAt?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || "",
        unread,
        instanceId: contact.instanceId,
      };
    });

    return NextResponse.json({ conversations });

  } catch (error: any) {
    console.error("Inbox GET Error:", error);
    return NextResponse.json({ error: "Failed to fetch conversations" }, { status: 500 });
  }
}
