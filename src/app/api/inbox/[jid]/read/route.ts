import { NextResponse } from "next/server";
import { requireAuthAndTenant } from "@/lib/auth";
import { db } from "@/db";
import { messages } from "@/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { markEvolutionMessageAsRead } from "@/lib/evolution";

export async function POST(req: Request, { params }: { params: Promise<{ jid: string }> }) {
  try {
    const authHeader = req.headers.get("Authorization");
    const { tenantId } = await requireAuthAndTenant(authHeader);
    const { jid } = await params;

    const body = await req.json();
    const instanceId = body.instanceId;

    if (!instanceId) {
      return NextResponse.json({ error: "Missing instanceId" }, { status: 400 });
    }

    // 1. Find all unread messages from them
    const unreadMessages = await db.query.messages.findMany({
      where: and(
        eq(messages.tenantId, tenantId),
        eq(messages.remoteJid, jid),
        eq(messages.isFromMe, false),
        ne(messages.status, "read")
      )
    });

    if (unreadMessages.length === 0) {
      return NextResponse.json({ success: true, count: 0 });
    }

    // 2. We only need to mark the most recent message or all of them depending on Evolution API logic.
    // Usually marking the latest message marks all previous ones read on WhatsApp.
    const latestUnread = unreadMessages[unreadMessages.length - 1];
    
    if (latestUnread.evolutionMessageId) {
      await markEvolutionMessageAsRead(instanceId, jid, latestUnread.evolutionMessageId);
    }

    // 3. Update DB
    await db.update(messages)
      .set({ status: "read" })
      .where(and(
        eq(messages.tenantId, tenantId),
        eq(messages.remoteJid, jid),
        eq(messages.isFromMe, false)
      ));

    return NextResponse.json({ success: true, count: unreadMessages.length });

  } catch (error: any) {
    console.error("Mark Read Error:", error);
    return NextResponse.json({ error: "Failed to mark as read" }, { status: 500 });
  }
}
