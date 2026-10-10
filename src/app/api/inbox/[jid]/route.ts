import { NextResponse } from "next/server";
import { requireAuthAndTenant } from "@/lib/auth";
import { db } from "@/db";
import { messages } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";

export async function GET(req: Request, { params }: { params: { jid: string } }) {
  try {
    const authHeader = req.headers.get("Authorization");
    const { tenantId } = await requireAuthAndTenant(authHeader);
    const jid = params.jid;

    const chatMessages = await db.query.messages.findMany({
      where: and(
        eq(messages.tenantId, tenantId),
        eq(messages.remoteJid, jid)
      ),
      orderBy: [asc(messages.createdAt)],
      limit: 100, // Last 100 messages for this chat
    });

    const formatted = chatMessages.map(m => ({
      id: m.id,
      from: m.isFromMe ? "us" : "them",
      text: m.messageText,
      time: m.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: m.status,
    }));

    // Optionally mark them as read here, but skipping for simplicity
    
    return NextResponse.json({ messages: formatted });

  } catch (error: any) {
    console.error("Inbox Messages GET Error:", error);
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}
