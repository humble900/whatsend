import { authenticationError } from "@/lib/api-error";
import { NextResponse } from "next/server";
import { requireAuthAndTenant } from "@/lib/auth";
import { checkWhatsAppNumbers } from "@/lib/evolution";
import { db } from "@/db";
import { whatsappInstances } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const schema = z.object({
  phones: z.array(z.string().min(7)).max(5000, "Maximum 5,000 numbers per validation batch"),
  instanceId: z.string().uuid("A connected WhatsApp instance ID is required"),
});

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    const { tenantId } = await requireAuthAndTenant(authHeader);

    const body = await req.json();
    const { phones, instanceId } = schema.parse(body);

    // Verify the instance belongs to this tenant and is connected
    const instance = await db.query.whatsappInstances.findFirst({
      where: and(
        eq(whatsappInstances.id, instanceId),
        eq(whatsappInstances.tenantId, tenantId),
        eq(whatsappInstances.status, "connected")
      ),
    });

    if (!instance) {
      return NextResponse.json({
        error: "No connected WhatsApp instance found. Please connect an account first."
      }, { status: 400 });
    }

    // Clean and deduplicate phones
    const cleaned = [...new Set(phones.map(p => p.replace(/[^0-9]/g, "")).filter(p => p.length >= 7))];

    // Run the check (batched with rate limiting internally)
    const results = await checkWhatsAppNumbers(instance.evolutionInstanceId, cleaned);

    const valid: string[] = [];
    const invalid: string[] = [];

    results.forEach((val, phone) => {
      if (val.exists) valid.push(phone);
      else invalid.push(phone);
    });

    return NextResponse.json({
      total: cleaned.length,
      valid: valid.length,
      invalid: invalid.length,
      validPhones: valid,
      invalidPhones: invalid,
    });

  } catch (error: any) {
    const authFailure = authenticationError(error);
    if (authFailure) return authFailure;
    console.error("WA Validation error:", error);
    if (error.name === "ZodError") {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || "Validation failed" }, { status: 500 });
  }
}
