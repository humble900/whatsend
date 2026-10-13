import { authenticationError } from "@/lib/api-error";
import { NextResponse } from "next/server";
import { requireAuthAndTenant } from "@/lib/auth";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { validateMetaCredentials, maskCredential, type MetaApiCredentials } from "@/lib/meta-api";
import { randomBytes } from "crypto";

/**
 * GET /api/settings/official-api
 * Returns masked credentials so the user can see what's saved
 * without ever exposing the real access token.
 */
export async function GET(req: Request) {
  try {
    const { tenantId, role } = await requireAuthAndTenant(req.headers.get("Authorization"));
    if (role !== "admin") return NextResponse.json({ error: "Only workspace administrators can view provider credentials." }, { status: 403 });

    const tenant = await db.query.tenants.findFirst({ where: eq(tenants.id, tenantId) });
    const creds = tenant?.officialApiCredentials as MetaApiCredentials | null;

    if (!creds?.phoneNumberId) {
      return NextResponse.json({ connected: false });
    }

    // Return MASKED values only — never send raw access token to browser
    return NextResponse.json({
      connected: true,
      messagingEnabled: false,
      phoneNumberId: creds.phoneNumberId,
      maskedToken: maskCredential(creds.accessToken),
      wabaId: creds.wabaId,
      appId: creds.appId || "",
      webhookVerifyToken: creds.webhookVerifyToken || "",
    });
  } catch (err: any) {
    const authFailure = authenticationError(err);
    if (authFailure) return authFailure;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/settings/official-api
 * Save + validate Meta Cloud API credentials.
 * Calls the Graph API to verify the credentials are real before saving.
 *
 * Body: { phoneNumberId, accessToken, wabaId, appId? }
 */
export async function POST(req: Request) {
  try {
    const { tenantId, role } = await requireAuthAndTenant(req.headers.get("Authorization"));
    if (role !== "admin") return NextResponse.json({ error: "Only workspace administrators can manage provider credentials." }, { status: 403 });
    const body = await req.json();

    const { phoneNumberId, accessToken, wabaId, appId } = body;

    if (!phoneNumberId || !accessToken || !wabaId) {
      return NextResponse.json(
        { error: "phoneNumberId, accessToken, and wabaId are all required." },
        { status: 400 },
      );
    }

    // Validate against the real Graph API
    const validation = await validateMetaCredentials({ phoneNumberId, accessToken, wabaId });

    if (!validation.valid) {
      return NextResponse.json(
        { error: `Meta API rejected these credentials: ${validation.error}` },
        { status: 422 },
      );
    }

    // Generate a stable webhook verify token for this tenant
    const existingTenant = await db.query.tenants.findFirst({ where: eq(tenants.id, tenantId) });
    const existingCreds = existingTenant?.officialApiCredentials as MetaApiCredentials | null;
    const webhookVerifyToken = existingCreds?.webhookVerifyToken || randomBytes(16).toString("hex");

    // Persist credentials (stored as JSONB — encrypt with KMS in production)
    await db.update(tenants)
      .set({
        officialApiCredentials: {
          phoneNumberId,
          accessToken,    // Store encrypted in production via KMS/Vault
          wabaId,
          appId: appId || "",
          webhookVerifyToken,
        } satisfies MetaApiCredentials & { webhookVerifyToken: string },
      })
      .where(eq(tenants.id, tenantId));

    return NextResponse.json({
      success: true,
      displayPhoneNumber: validation.displayPhoneNumber,
      verifiedName: validation.verifiedName,
      webhookVerifyToken,
      messagingEnabled: false,
    });
  } catch (err: any) {
    const authFailure = authenticationError(err);
    if (authFailure) return authFailure;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/settings/official-api
 * Disconnects the Meta API — clears stored credentials.
 */
export async function DELETE(req: Request) {
  try {
    const { tenantId, role } = await requireAuthAndTenant(req.headers.get("Authorization"));
    if (role !== "admin") return NextResponse.json({ error: "Only workspace administrators can manage provider credentials." }, { status: 403 });

    await db.update(tenants)
      .set({ officialApiCredentials: null })
      .where(eq(tenants.id, tenantId));

    return NextResponse.json({ success: true });
  } catch (err: any) {
    const authFailure = authenticationError(err);
    if (authFailure) return authFailure;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
