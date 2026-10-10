import { NextResponse } from "next/server";
import { requireAuthAndTenant } from "@/lib/auth";
import { db } from "@/db";
import { contacts, whatsappInstances } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const importSchema = z.object({
  contacts: z.array(z.object({
    phone: z.string(),
    pushName: z.string().optional(),
    variables: z.record(z.string(), z.any()).optional()
  }))
});

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    const { tenantId } = await requireAuthAndTenant(authHeader);

    const body = await req.json();
    const { contacts: newContacts } = importSchema.parse(body);

    if (newContacts.length === 0) {
      return NextResponse.json({ error: "No valid contacts found. Please make sure your file has a 'phone' column with valid numbers." }, { status: 400 });
    }

    // We need an instance ID to associate these CRM contacts with.
    let firstInstance = await db.query.whatsappInstances.findFirst({
      where: eq(whatsappInstances.tenantId, tenantId)
    });

    // LOCAL DEV MOCK: If no instance, use a placeholder ID so CRM works
    if (!firstInstance && authHeader === "Bearer mock-token") {
      // Skip instance requirement for local dev
      const mockInstanceId = "mock_instance_123";
      
      const CHUNK_SIZE = 2000;
      let imported = 0;
      for (let i = 0; i < newContacts.length; i += CHUNK_SIZE) {
        const chunk = newContacts.slice(i, i + CHUNK_SIZE);
        const values = chunk.map(c => ({
          tenantId,
          instanceId: mockInstanceId,
          remoteJid: `${c.phone}@s.whatsapp.net`,
          pushName: c.pushName || null,
          metadata: c.variables || {},
          isSaved: true,
        }));
        await db.insert(contacts).values(values).onConflictDoUpdate({
          target: [contacts.tenantId, contacts.remoteJid],
          set: { isSaved: true }
        });
        imported += chunk.length;
      }
      return NextResponse.json({ success: true, count: imported });
    } else if (!firstInstance) {
      return NextResponse.json({ error: "You must connect at least one WhatsApp instance before importing contacts." }, { status: 400 });
    }

    // We chunk the inserts to avoid postgres parameter limits (65535) if someone uploads 10k contacts.
    // Each row has ~4 fields, so safe chunk size is ~2000.
    const CHUNK_SIZE = 2000;
    let imported = 0;

    for (let i = 0; i < newContacts.length; i += CHUNK_SIZE) {
      const chunk = newContacts.slice(i, i + CHUNK_SIZE);
      
      const values = chunk.map(c => ({
        tenantId,
        instanceId: firstInstance.id,
        remoteJid: `${c.phone}@s.whatsapp.net`,
        pushName: c.pushName || null,
        metadata: c.variables || {},
        isSaved: true, // Imported contacts are explicitly saved CRM data
      }));

      await db.insert(contacts).values(values).onConflictDoUpdate({
        target: [contacts.tenantId, contacts.remoteJid],
        set: {
          isSaved: true
        }
      });
      imported += chunk.length;
    }

    return NextResponse.json({ success: true, count: imported });
  } catch (error: any) {
    console.error("Bulk Import Error:", error);
    return NextResponse.json({ error: "Failed to import contacts." }, { status: 500 });
  }
}
