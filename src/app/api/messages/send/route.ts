import { NextResponse } from "next/server";
import { requireAuthAndTenant } from "@/lib/auth";
import { sendEvolutionMessage } from "@/lib/evolution";
import { z } from "zod";
import { db } from "@/db";
import { whatsappInstances } from "@/db/schema";
import { eq } from "drizzle-orm";

const sendMessageSchema = z.object({
  instanceId: z.string(), // We take our DB ID, not the Evolution ID directly, for security
  targetPhone: z.string().min(1),
  messageText: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    const { tenantId } = await requireAuthAndTenant(authHeader);

    const body = await req.json();
    const { instanceId, targetPhone, messageText } = sendMessageSchema.parse(body);

    // 1. Verify tenant owns this instance
    const instanceRecord = await db.query.whatsappInstances.findFirst({
      where: eq(whatsappInstances.id, instanceId),
    });

    if (!instanceRecord || instanceRecord.tenantId !== tenantId) {
      return NextResponse.json({ error: "Instance not found or unauthorized" }, { status: 403 });
    }

    // 2. Send the message via Evolution API
    const result = await sendEvolutionMessage(instanceRecord.evolutionInstanceId, targetPhone, messageText);

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error("Send Message Error:", error);
    return NextResponse.json({ error: error.message || "Failed to send message" }, { status: 500 });
  }
}
