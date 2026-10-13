import { authenticationError } from "@/lib/api-error";
import { NextResponse } from "next/server";
import { requireAuthAndTenant } from "@/lib/auth";
import { db } from "@/db";
import { contacts, blacklist } from "@/db/schema";
import { eq, desc, inArray } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    const { tenantId } = await requireAuthAndTenant(authHeader);

    // Fetch all contacts for this tenant
    const allContacts = await db.query.contacts.findMany({
      where: eq(contacts.tenantId, tenantId),
      orderBy: [desc(contacts.createdAt)],
    });

    // Fetch blacklist to mark which ones are banned/opted-out
    const allBlacklisted = await db.query.blacklist.findMany({
      where: eq(blacklist.tenantId, tenantId)
    });
    const blacklistSet = new Set(allBlacklisted.map(b => b.phoneNumber));

    // Map response
    const mapped = allContacts.map(c => ({
      id: c.id,
      remoteJid: c.remoteJid,
      pushName: c.pushName,
      isSaved: c.isSaved,
      isBlacklisted: blacklistSet.has(c.remoteJid),
      metadata: c.metadata,
      createdAt: c.createdAt,
    }));

    return NextResponse.json({ contacts: mapped });
  } catch (error: any) {
    const authFailure = authenticationError(error);
    if (authFailure) return authFailure;
    console.error("Fetch Contacts Error:", error);
    return NextResponse.json({ error: "Failed to fetch contacts" }, { status: 500 });
  }
}
