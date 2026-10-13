import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthAndTenant } from "@/lib/auth";
import { authenticationError } from "@/lib/api-error";
import { db } from "@/db";
import { messages, whatsappInstances } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { evolutionApi } from "@/lib/evolution";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await requireAuthAndTenant(req.headers.get("Authorization"));
    const { id } = await params; z.uuid().parse(id);
    const message = await db.query.messages.findFirst({where:and(eq(messages.id,id),eq(messages.tenantId,tenantId))});
    if (!message || !message.evolutionMessageId || !["media","image","video","document","audio","sticker"].includes(message.messageType)) return NextResponse.json({error:"Media message not found."},{status:404});
    const instance = await db.query.whatsappInstances.findFirst({where:and(eq(whatsappInstances.id,message.instanceId),eq(whatsappInstances.tenantId,tenantId))});
    if (!instance) return NextResponse.json({error:"Connection not found."},{status:404});
    const media = await evolutionApi(instance.evolutionServerUrl, `/chat/getBase64FromMediaMessage/${encodeURIComponent(instance.evolutionInstanceId)}`, "POST", {message:{key:{id:message.evolutionMessageId,remoteJid:message.remoteJid,fromMe:message.isFromMe}},convertToMp4:false});
    if (typeof media?.base64 !== "string" || !media.base64.length) return NextResponse.json({error:"WhatsApp could not retrieve this attachment."},{status:502});
    if (media.base64.length > 24*1024*1024) return NextResponse.json({error:"This attachment is too large to download here. Open it in WhatsApp."},{status:413});
    const file = Buffer.from(media.base64,"base64");
    const filename = String(media.fileName || "attachment").replace(/[^a-zA-Z0-9._ -]/g,"_").slice(0,180);
    const mime = typeof media.mimetype === "string" && /^[\w.+-]+\/[\w.+-]+$/.test(media.mimetype) ? media.mimetype : "application/octet-stream";
    return new Response(new Uint8Array(file),{headers:{"Content-Type":mime,"Content-Disposition":`attachment; filename="${filename}"`,"Content-Length":String(file.length),"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
  } catch (error) {
    const auth = authenticationError(error); if(auth)return auth;
    if(error instanceof z.ZodError)return NextResponse.json({error:"Invalid message."},{status:400});
    return NextResponse.json({error:"Attachment download failed. It may have expired on WhatsApp."},{status:502});
  }
}
