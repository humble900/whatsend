import { authenticationError } from "@/lib/api-error";
import { NextResponse } from "next/server";
import { requireAuthAndTenant } from "@/lib/auth";
import { db } from "@/db";
import { campaigns, whatsappInstances, messages, contacts, blacklist } from "@/db/schema";
import { eq, and, count, sum, gte, desc } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    const { tenantId } = await requireAuthAndTenant(authHeader);

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Run all queries in parallel for speed
    const [
      allInstances,
      allCampaigns,
      messages24h,
      totalContacts,
      recentCampaignList,
    ] = await Promise.all([
      // All WA instances for this tenant
      db.query.whatsappInstances.findMany({
        where: eq(whatsappInstances.tenantId, tenantId),
        columns: { id: true, status: true, messagesSentToday: true, dailyLimit: true },
      }),

      // All campaigns
      db.query.campaigns.findMany({
        where: eq(campaigns.tenantId, tenantId),
        columns: { id: true, status: true, totalContacts: true, contactsProcessed: true },
      }),

      // Messages sent in last 24h (outbound only)
      db.query.messages.findMany({
        where: and(
          eq(messages.tenantId, tenantId),
          eq(messages.isFromMe, true),
          gte(messages.createdAt, since24h)
        ),
        columns: { id: true, status: true, createdAt: true },
      }),

      // Total saved contacts
      db.query.contacts.findMany({
        where: eq(contacts.tenantId, tenantId),
        columns: { id: true },
      }),

      // Recent 5 campaigns with detail
      db.query.campaigns.findMany({
        where: eq(campaigns.tenantId, tenantId),
        orderBy: [desc(campaigns.createdAt)],
        limit: 5,
        columns: { id: true, name: true, status: true, totalContacts: true, contactsProcessed: true, createdAt: true },
      }),
    ]);

    // Compute stats
    const activeInstances = allInstances.filter(i => i.status === "connected").length;
    const totalInstances = allInstances.length;
    const messagesSent24h = messages24h.length;
    const delivered24h = messages24h.filter(m => ["delivered", "read"].includes(m.status)).length;
    const failed24h = messages24h.filter(m => m.status === "failed").length;
    const deliveryRate = messagesSent24h > 0
      ? ((delivered24h / messagesSent24h) * 100).toFixed(1)
      : "—";

    const runningCampaigns = allCampaigns.filter(c => c.status === "running").length;
    const totalMessagesSent = allCampaigns.reduce((sum, c) => sum + c.contactsProcessed, 0);

    const firstHour = new Date(since24h);

    const hourlyActivity = Array.from({ length: 24 }, (_, index) => ({ timestamp: new Date(firstHour.getTime() + index * 3600000).toISOString(), count: 0 }));
    for (const entry of messages24h) {
      const index = Math.floor((entry.createdAt.getTime() - firstHour.getTime()) / 3600000);
      if (index >= 0 && index < hourlyActivity.length) hourlyActivity[index].count++;
    }

    // Daily capacity
    const dailyCapacity = allInstances.reduce((sum, i) => sum + i.dailyLimit, 0);
    const dailyUsed = allInstances.reduce((sum, i) => sum + i.messagesSentToday, 0);

    return NextResponse.json({
      hourlyActivity,
      stats: {
        activeInstances,
        totalInstances,
        messagesSent24h,
        deliveryRate: deliveryRate === "—" ? "—" : `${deliveryRate}%`,
        failed24h,
        runningCampaigns,
        totalContacts: totalContacts.length,
        dailyCapacity,
        dailyUsed,
        totalMessagesSent,
      },
      recentCampaigns: recentCampaignList.map(c => ({
        id: c.id,
        name: c.name,
        status: c.status,
        totalContacts: c.totalContacts,
        contactsProcessed: c.contactsProcessed,
        progress: c.totalContacts > 0
          ? Math.round((c.contactsProcessed / c.totalContacts) * 100)
          : 0,
        createdAt: c.createdAt,
      })),
    });
  } catch (error: any) {
    const authFailure = authenticationError(error);
    if (authFailure) return authFailure;
    console.error("Dashboard stats error:", error);
    return NextResponse.json({ error: "Failed to load stats" }, { status: 500 });
  }
}
