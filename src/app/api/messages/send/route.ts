import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthAndTenant } from "@/lib/auth";
import { authenticationError } from "@/lib/api-error";
import { db } from "@/db";
import { messages, whatsappInstances } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { phoneSchema, outboundPayloadSchema } from "@/lib/messaging-contracts";
import { assertReplyAllowed, createOutbound, dispatchOutbound, MessagingError } from "@/lib/outbound-service";
import { getEvolutionState, EvolutionError } from "@/lib/evolution";

const schema = z.object({ requestId: z.uuid(), instanceId: z.uuid(), targetPhone: phoneSchema, messageText: z.string().min(1).max(4096).optional(), payload: outboundPayloadSchema.optional() }).refine(body => body.payload || body.messageText, "Choose a message to send.");
export async function POST(req: Request) {
  try {
    const { tenantId, userId } = await requireAuthAndTenant(req.headers.get("Authorization"));
    const input = schema.parse(await req.json());
    const instance = await db.query.whatsappInstances.findFirst({ where: and(eq(whatsappInstances.tenantId, tenantId), eq(whatsappInstances.id, input.instanceId)) });
    if (!instance) throw new MessagingError("Connection not found.", 404);
    if(instance.status!=='connected'){
    const liveState = await getEvolutionState(instance.evolutionServerUrl,instance.evolutionInstanceId);
    if (liveState !== "open") {
      await db.update(whatsappInstances).set({status:liveState === "connecting" ? "connecting" : "disconnected"}).where(eq(whatsappInstances.id,instance.id));
      throw new MessagingError("Connect your WhatsApp number before sending.", 409);
    }
    if(instance.status !== "connected") await db.update(whatsappInstances).set({status:"connected"}).where(eq(whatsappInstances.id,instance.id));
    }
    const jid = `${input.targetPhone}@s.whatsapp.net`;
    await assertReplyAllowed(tenantId, input.instanceId, jid);
    const payload = input.payload || { type: "text" as const, text: input.messageText! };
    if (payload.type === "reaction") {
      const target = await db.query.messages.findFirst({ where: and(eq(messages.tenantId, tenantId), eq(messages.instanceId, input.instanceId), eq(messages.remoteJid, jid), eq(messages.evolutionMessageId, payload.key.id), eq(messages.isFromMe, payload.key.fromMe)) });
      if (!target || payload.key.remoteJid !== jid) throw new MessagingError("Reaction target was not found in this conversation.", 404);
    }
    // Direct sends use no campaign queue, sending window, pacing, or quota.
    const request = await createOutbound({ tenantId, instanceId: input.instanceId, requestKey: `direct-${input.requestId}`, phone: input.targetPhone, payload, userId });
    const sent = await dispatchOutbound(request.id, tenantId);
    if (sent.status === "failed") return NextResponse.json({error:"WhatsApp reported that delivery failed.",outboundId:sent.id,messageId:sent.evolutionMessageId},{status:422});
    const stored = await db.query.messages.findFirst({ where: and(eq(messages.tenantId, tenantId), eq(messages.instanceId, input.instanceId), eq(messages.evolutionMessageId, sent.evolutionMessageId!)) });
    return NextResponse.json({ success: true, outboundId: sent.id, messageId: sent.evolutionMessageId, storedMessageId: stored?.id, status: sent.status });
  } catch (error) {
    const authError = authenticationError(error); if (authError) return authError;
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 });
    if (error instanceof MessagingError) return NextResponse.json({ error: error.message, outboundId: error.outboundId }, { status: error.status });
    if (error instanceof EvolutionError) return NextResponse.json({ error: "WhatsApp connection could not be checked. No message was submitted." }, { status: 503 });
    return NextResponse.json({ error: "Message could not be sent. Check history before retrying." }, { status: 500 });
  }
}
