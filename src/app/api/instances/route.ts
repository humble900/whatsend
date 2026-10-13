import { authenticationError } from "@/lib/api-error";
import { NextResponse } from "next/server";
import { requireAuthAndTenant } from "@/lib/auth";
import { createEvolutionInstance } from "@/lib/evolution";
import { z } from "zod";

const createInstanceSchema = z.object({
  instanceName: z.string().min(1).max(100),
  phoneNumber: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    // 1. Authenticate and enforce Tenant Isolation (BOLA protection)
    const authHeader = req.headers.get("Authorization");
    const { tenantId } = await requireAuthAndTenant(authHeader);

    const body = await req.json();
    const { instanceName, phoneNumber } = createInstanceSchema.parse(body);

    // 2. Instruct Evolution API to provision the new WhatsApp worker and fetch QR or Pairing Code
    const result = await createEvolutionInstance(tenantId, instanceName, phoneNumber);

    return NextResponse.json({
      success: true,
      connected: result.connected,
      dbId: result.dbId,
      evolutionInstanceId: result.evolutionInstanceId,
      qrcodeBase64: result.qrcode,
      pairingCode: result.pairingCode,
    }, { status: 201 });

  } catch (error: any) {
    const authFailure = authenticationError(error);
    if (authFailure) return authFailure;
    console.error("Instance Creation Error:", error);
    if (error.message.includes("No available proxies")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || "Connection could not be created." }, { status: 502 });
  }
}

import { db } from "@/db";
import { whatsappInstances } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    const { tenantId } = await requireAuthAndTenant(authHeader);

    const [instances,counts]=await Promise.all([db.query.whatsappInstances.findMany({
      where: eq(whatsappInstances.tenantId, tenantId),
      orderBy: [desc(whatsappInstances.createdAt)]
    }),db.execute(sql`select instance_id, count(*)::int as count from outbound_messages where tenant_id=${tenantId} and campaign_id is not null and status in ('sent','delivered','read') and sent_at >= date_trunc('day',now()) group by instance_id`)]);
    const countsByInstance=new Map(counts.map(row=>[row.instance_id,Number(row.count)]));
    return NextResponse.json({ instances: instances.map(instance => ({ ...instance, messagesSentToday: countsByInstance.get(instance.id)||0 })) }, { status: 200 });
  } catch (error: any) {
    const authFailure = authenticationError(error);
    if (authFailure) return authFailure;
    console.error("Fetch Instances Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
