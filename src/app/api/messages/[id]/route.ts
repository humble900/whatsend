import { NextResponse } from "next/server";
import { requireAuthAndTenant } from "@/lib/auth";
import { authenticationError } from "@/lib/api-error";
import { db } from "@/db";
import { outboundMessages } from "@/db/schema";
import { and, eq } from "drizzle-orm";
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const { tenantId } = await requireAuthAndTenant(req.headers.get("Authorization")); const { id } = await params;
    const request = await db.query.outboundMessages.findFirst({ where: and(eq(outboundMessages.id, id), eq(outboundMessages.tenantId, tenantId)) });
    if (!request) return NextResponse.json({ error: "Message request not found." }, { status: 404 });
    return NextResponse.json({ id: request.id, status: request.status, messageId: request.evolutionMessageId, error: request.lastError, sentAt: request.sentAt });
  } catch (error) { const auth = authenticationError(error); return auth || NextResponse.json({ error: "Could not load message status." }, { status: 500 }); }
}
