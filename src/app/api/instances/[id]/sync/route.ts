import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthAndTenant } from "@/lib/auth";
import { authenticationError } from "@/lib/api-error";
import { db } from "@/db";
import { whatsappInstances } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { findEvolutionMessages } from "@/lib/evolution";
import { receiveEvolutionMessage } from "@/lib/inbound-message";
import { storeReceipt } from "@/lib/store-message";
import { receiptStatus } from "@/lib/evolution-events";
import { phoneSchema } from "@/lib/messaging-contracts";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await requireAuthAndTenant(req.headers.get("Authorization"));
    const { id } = await params; z.uuid().parse(id);
    const { phone } = z.object({ phone: phoneSchema }).parse(await req.json());
    const instance = await db.query.whatsappInstances.findFirst({ where: and(eq(whatsappInstances.id, id), eq(whatsappInstances.tenantId, tenantId)) });
    if (!instance) return NextResponse.json({ error: "Connection not found." }, { status: 404 });
    const records = await findEvolutionMessages(instance.evolutionInstanceId, `${phone}@s.whatsapp.net`, 100);
    for (const message of records) {
      await receiveEvolutionMessage(tenantId, id, message);
      const status = receiptStatus(message);
      if (message.key?.fromMe && status && message.key.id) await storeReceipt(tenantId, id, message.key.id, status);
    }
    return NextResponse.json({ synced: records.length, limit: 100 });
  } catch (error) {
    const auth = authenticationError(error); if (auth) return auth;
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 });
    return NextResponse.json({ error: "WhatsApp history could not be synchronized. Existing messages have been kept." }, { status: 502 });
  }
}
