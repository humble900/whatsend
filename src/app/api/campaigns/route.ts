import { NextResponse } from "next/server";
import { requireAuthAndTenant } from "@/lib/auth";
import { campaignQueue } from "@/lib/queue";
import { db } from "@/db";
import { campaigns } from "@/db/schema";
import { z } from "zod";
import { eq } from "drizzle-orm";

const createCampaignSchema = z.object({
  name: z.string().min(1),
  spintaxTemplate: z.string().min(1),
  contacts: z.array(z.object({
    phone: z.string().min(8),
    variables: z.record(z.string(), z.string()).optional()
  })), // Support for CSV dynamic rows
});

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    const { tenantId } = await requireAuthAndTenant(authHeader);

    const body = await req.json();
    const { name, spintaxTemplate, contacts } = createCampaignSchema.parse(body);

    if (contacts.length === 0) {
      return NextResponse.json({ error: "No contacts provided" }, { status: 400 });
    }

    // 1. Instance Rotation (Sharding) Setup
    // Fetch all connected instances for this tenant to spread the load
    const activeInstances = await db.query.whatsappInstances.findMany({
      where: (table, { and, eq }) => and(eq(table.tenantId, tenantId), eq(table.status, "connected")),
      columns: { evolutionInstanceId: true }
    });

    if (activeInstances.length === 0) {
      return NextResponse.json({ error: "No connected WhatsApp instances available for dispatch." }, { status: 400 });
    }

    // 2. Create the Campaign Record
    const [newCampaign] = await db.insert(campaigns).values({
      tenantId,
      name,
      spintaxTemplate,
      totalContacts: contacts.length,
      status: "queued",
    }).returning({ id: campaigns.id });

    // 3. Dispatch Bulk Jobs to Redis Queue with Round-Robin Rotation
    const jobs = contacts.map((contact, index) => {
      // Mathematically spread the load across all available instances
      const assignedInstance = activeInstances[index % activeInstances.length].evolutionInstanceId;

      return {
        name: "dispatch-message",
        data: {
          tenantId,
          campaignId: newCampaign.id,
          evolutionInstanceId: assignedInstance,
          targetPhone: contact.phone,
          spintaxTemplate,
          variables: contact.variables || {}, // Pass the specific row variables
        },
        opts: {}
      };
    });

    await campaignQueue.addBulk(jobs);

    // 4. Mark Campaign as Running
    await db.update(campaigns).set({ status: "running" }).where(eq(campaigns.id, newCampaign.id));

    return NextResponse.json({
      success: true,
      campaignId: newCampaign.id,
      queuedContacts: contacts.length,
    }, { status: 201 });

  } catch (error: any) {
    console.error("Campaign Creation Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
