import { authenticationError } from "@/lib/api-error";
import { NextResponse } from "next/server";
import { requireAuthAndTenant } from "@/lib/auth";
import { db } from "@/db";
import { whatsappInstances, contacts } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { checkWhatsAppNumbers } from "@/lib/evolution";

/**
 * POST /api/contacts/verify
 * 
 * Verifies which phone numbers are actually registered on WhatsApp using
 * Evolution API's /chat/whatsappNumbers endpoint. Requires at least one
 * connected instance in the tenant.
 *
 * Body: { phones: string[], saveVerified?: boolean }
 * Response: { results: { phone, exists, jid }[], instanceUsed: string }
 */
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    const { tenantId } = await requireAuthAndTenant(authHeader);
    const body = await req.json();

    const phones: string[] = (body.phones || []).map((p: string) => p.replace(/[^0-9]/g, "")).filter(Boolean);

    if (!phones.length) {
      return NextResponse.json({ error: "No phone numbers provided." }, { status: 400 });
    }

    if (phones.length > 500) {
      return NextResponse.json({ error: "Max 500 numbers per verification request." }, { status: 400 });
    }

    // Find first connected instance for this tenant
    const instance = await db.query.whatsappInstances.findFirst({
      where: and(
        eq(whatsappInstances.tenantId, tenantId),
        eq(whatsappInstances.status, "connected")
      ),
    });

    if (!instance) return NextResponse.json({ error: "Connect a WhatsApp number before verifying contacts." }, { status: 409 });
    const resultsMap = await checkWhatsAppNumbers(instance.evolutionInstanceId, phones);

    const results = phones.map(phone => ({
      phone,
      exists: resultsMap.get(phone)?.exists ?? false,
      jid: resultsMap.get(phone)?.jid,
    }));

    return NextResponse.json({
      results,
      instanceUsed: instance?.evolutionInstanceId || null,
      total: phones.length,
      verified: results.filter(r => r.exists).length,
      invalid: results.filter(r => !r.exists).length,
    });
  } catch (error: any) {
    const authFailure = authenticationError(error);
    if (authFailure) return authFailure;
    console.error("WA Verify error:", error);
    return NextResponse.json({ error: error.message || "Verification failed" }, { status: 500 });
  }
}
