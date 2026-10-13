import { authenticationError } from "@/lib/api-error";
import { NextResponse } from "next/server";
import { requireAuthAndTenant } from "@/lib/auth";
import { db } from "@/db";
import { campaigns } from "@/db/schema";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1, "Campaign name is required").max(120),
});

/**
 * POST /api/campaigns/draft
 * Creates a campaign in "draft" status with just a name.
 * The user then fills in leads, sequences, schedule from the detail page.
 */
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    const { tenantId } = await requireAuthAndTenant(authHeader);

    const body = await req.json();
    const { name } = schema.parse(body);

    const [draft] = await db.insert(campaigns).values({
      tenantId,
      name,
      status: "draft",
      spintaxTemplate: "",
      totalContacts: 0,
      dailyLimitPerAccount: 50,
      delayMode: "smart",
      customDelayMin: 15,
      customDelayMax: 45,
      sendingWindows: [{ start: "09:00", end: "17:00" }],
      variants: [],
      variantMode: "round_robin",
    }).returning({ id: campaigns.id });

    return NextResponse.json({ campaignId: draft.id }, { status: 201 });
  } catch (error: any) {
    const authFailure = authenticationError(error);
    if (authFailure) return authFailure;
    if (error.name === "ZodError") {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create draft" }, { status: 500 });
  }
}
