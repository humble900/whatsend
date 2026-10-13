import { authenticationError } from "@/lib/api-error";
import { NextResponse } from "next/server";
import { requireAuthAndTenant } from "@/lib/auth";
import { db } from "@/db";
import { messages, whatsappInstances } from "@/db/schema";
import { eq, and, ne, desc, lte } from "drizzle-orm";
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

    const instance = await db.query.whatsappInstances.findFirst({ where: and(eq(whatsappInstances.id, instanceId), eq(whatsappInstances.tenantId, tenantId)) });
    if (!instance) return NextResponse.json({ error: "Connection not found" }, { status: 403 });
    // 1. Find all unread messages from them
    const latestUnread = await db.query.messages.findFirst({
      where: and(
        eq(messages.tenantId, tenantId),
        eq(messages.remoteJid, jid),
        eq(messages.instanceId, instanceId),
        eq(messages.isFromMe, false),
        ne(messages.status, "read")
      ), columns:{id:true,evolutionMessageId:true,createdAt:true}, orderBy: [desc(messages.createdAt)]
    });

    if (!latestUnread) {
      return NextResponse.json({ success: true, count: 0 });
    }

    // 2. We only need to mark the most recent message or all of them depending on Evolution API logic.
    // Usually marking the latest message marks all previous ones read on WhatsApp.

    
    if (latestUnread.evolutionMessageId) {
      await markEvolutionMessageAsRead(instance.evolutionInstanceId, jid, latestUnread.evolutionMessageId);
    }

    // 3. Update DB
    const updated = await db.update(messages)
      .set({ status: "read" })
      .where(and(
        eq(messages.tenantId, tenantId),
        eq(messages.remoteJid, jid),
        eq(messages.instanceId, instanceId),
        eq(messages.isFromMe, false),
        ne(messages.status, "read"),
        lte(messages.createdAt, latestUnread.createdAt)
      )).returning({ id: messages.id });

    return NextResponse.json({ success: true, count: updated.length });

  } catch (error: any) {
    const authFailure = authenticationError(error);
    if (authFailure) return authFailure;
    console.error("Mark Read Error:", error);
    return NextResponse.json({ error: "Failed to mark as read" }, { status: 500 });
  }
}
