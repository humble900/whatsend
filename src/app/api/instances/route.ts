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
      evolutionInstanceId: result.evolutionInstanceId,
      qrcodeBase64: result.qrcode,
      pairingCode: result.pairingCode,
    }, { status: 201 });

  } catch (error: any) {
    console.error("Instance Creation Error:", error);
    if (error.message.includes("No available proxies")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
