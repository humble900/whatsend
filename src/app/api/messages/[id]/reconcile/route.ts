import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthAndTenant } from "@/lib/auth";
import { authenticationError } from "@/lib/api-error";
import { db } from "@/db";
import { outboundMessages, whatsappInstances } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { evolutionApi } from "@/lib/evolution";
import { receiveEvolutionMessage } from "@/lib/inbound-message";
import { storeReceipt } from "@/lib/store-message";
import { receiptStatus } from "@/lib/evolution-events";
import { refreshCampaignProgress } from "@/lib/campaign-service";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await requireAuthAndTenant(req.headers.get("Authorization"));
    const { id } = await params; z.uuid().parse(id);
    const request = await db.query.outboundMessages.findFirst({ where: and(eq(outboundMessages.id, id), eq(outboundMessages.tenantId, tenantId)) });
    if (!request) return NextResponse.json({ error: "Message request not found." }, { status: 404 });
    if (!request.evolutionMessageId) return NextResponse.json({ error: "Evolution returned no message ID. Sync this conversation from WhatsApp and check with the recipient before sending a new message." }, { status: 409 });
    const instance = await db.query.whatsappInstances.findFirst({ where: and(eq(whatsappInstances.id, request.instanceId), eq(whatsappInstances.tenantId, tenantId)) });
    if (!instance) return NextResponse.json({ error: "Connection not found." }, { status: 404 });
    const data = await evolutionApi(instance.evolutionServerUrl, `/chat/findMessages/${encodeURIComponent(instance.evolutionInstanceId)}`, "POST", { where: { key: { id: request.evolutionMessageId, remoteJid: request.remoteJid } }, page: 1, offset: 1 });
    const message = data?.messages?.records?.find((item: any) => item.key?.id === request.evolutionMessageId && item.key?.fromMe === true);
    if (!message) return NextResponse.json({ error: "The provider has not confirmed this message in history. No resend was attempted." }, { status: 409 });
    await receiveEvolutionMessage(tenantId, instance.id, message);
    await storeReceipt(tenantId, instance.id, request.evolutionMessageId, receiptStatus(message) || "sent");
    if (request.campaignId) await refreshCampaignProgress(request.campaignId, tenantId);
    const result = await db.query.outboundMessages.findFirst({ where: eq(outboundMessages.id, id) });
    return NextResponse.json({ status: result?.status, messageId: request.evolutionMessageId });
  } catch (error) {
    const auth = authenticationError(error); if (auth) return auth;
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 });
    return NextResponse.json({ error: "Provider history could not be checked. No resend was attempted." }, { status: 502 });
  }
}
