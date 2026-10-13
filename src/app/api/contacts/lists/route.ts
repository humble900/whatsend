import { authenticationError } from "@/lib/api-error";
import { NextResponse } from "next/server";
import { requireAuthAndTenant } from "@/lib/auth";
import { db } from "@/db";
import { contacts } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/contacts/lists
 * Returns unique lists derived from contact metadata._listName.
 * Each list includes name, count, and sample contacts.
 */
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    const { tenantId } = await requireAuthAndTenant(authHeader);

    const allContacts = await db.query.contacts.findMany({
      where: eq(contacts.tenantId, tenantId),
      columns: { id: true, remoteJid: true, pushName: true, metadata: true, createdAt: true },
    });

    // Group by _listName from metadata
    const listMap = new Map<string, {
      name: string;
      count: number;
      importedAt: string | null;
      samples: string[];
    }>();

    for (const c of allContacts) {
      const listName: string = (c.metadata as any)?._listName || null;
      if (!listName) continue; // skip contacts with no list (raw WA syncs)

      if (!listMap.has(listName)) {
        listMap.set(listName, {
          name: listName,
          count: 0,
          importedAt: (c.metadata as any)?._importedAt ?? null,
          samples: [],
        });
      }

      const entry = listMap.get(listName)!;
      entry.count++;
      if (entry.samples.length < 3) {
        const phone = c.remoteJid.replace("@s.whatsapp.net", "");
        entry.samples.push(c.pushName || `+${phone}`);
      }
    }

    const lists = Array.from(listMap.values()).sort((a, b) =>
      (b.importedAt || "").localeCompare(a.importedAt || "")
    );

    return NextResponse.json({ lists });
  } catch (error: any) {
    const authFailure = authenticationError(error);
    if (authFailure) return authFailure;
    console.error("Lists fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch lists" }, { status: 500 });
  }
}
