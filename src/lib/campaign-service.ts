import { z } from "zod";
import { db } from "@/db";
import { campaigns, campaignAccounts, campaignLeads, outboundMessages, whatsappInstances } from "@/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { MessagingError, createOutbound } from "./outbound-service";
import { outboundPayloadSchema, phoneSchema, type OutboundPayload } from "./messaging-contracts";
import { injectVariables, parseSpintax } from "./spintax";
import { assertCampaignWorkerAvailable } from "./queue";

const windowSchema = z.object({ start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) }).refine(value => value.start !== value.end, "A sending window must have a duration.");
export const campaignEditSchema = z.object({ name: z.string().trim().min(1).max(120).optional(), spintaxTemplate: z.string().max(4096).optional(), payload: outboundPayloadSchema.optional(), instanceIds: z.array(z.uuid()).min(1).max(20).optional(), dailyLimitPerAccount: z.number().int().min(1).max(1000).optional(), delayMode: z.enum(["smart", "custom"]).optional(), customDelayMin: z.number().min(1).max(300).optional(), customDelayMax: z.number().min(1).max(300).optional(), sendingWindows: z.array(windowSchema).min(1).max(10).optional(), timezone: z.string().refine(value => { try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; } }, "Choose a valid timezone.").optional(), status: z.enum(["paused", "running", "cancelled"]).optional(), variants: z.array(z.object({ id: z.string().min(1).max(100), label: z.string().max(100), spintaxTemplate: z.string().max(4096), weight: z.number().int().min(1).max(100), payload: outboundPayloadSchema.optional() })).max(20).optional(), variantMode: z.enum(["round_robin", "weighted", "account_locked"]).optional() });
export const campaignLeadSchema = z.object({ contacts: z.array(z.object({ phone: phoneSchema, name: z.string().max(255).optional(), variables: z.record(z.string(), z.string().max(4096)).optional() })).min(1).max(10000) });
export async function getCampaign(id: string, tenantId: string) {
  z.uuid().parse(id);
  const campaign = await db.query.campaigns.findFirst({ where: and(eq(campaigns.id, id), eq(campaigns.tenantId, tenantId)) });
  if (!campaign) throw new MessagingError("Campaign was not found.", 404);
  return campaign;
}
export async function campaignAnalytics(id: string, tenantId: string) {
  const rows = await db.select({ status: outboundMessages.status, count: sql<number>`count(*)::int` }).from(outboundMessages).where(and(eq(outboundMessages.campaignId, id), eq(outboundMessages.tenantId, tenantId))).groupBy(outboundMessages.status);
  const counts = Object.fromEntries(rows.map(row => [row.status, row.count]));
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const sent = (counts.sent || 0) + (counts.delivered || 0) + (counts.read || 0);
  const processed = sent + (counts.failed || 0) + (counts.skipped || 0) + (counts.cancelled || 0);
  return { total, sent, failed: counts.failed || 0, skipped: counts.skipped || 0, uncertain: counts.uncertain || 0, delivered: (counts.delivered || 0) + (counts.read || 0), read: counts.read || 0, queued: (counts.queued || 0) + (counts.sending || 0), processed, progress: total ? Math.round(processed / total * 100) : 0 };
}
export async function refreshCampaignProgress(id: string, tenantId: string) {
  const analytics = await campaignAnalytics(id, tenantId); const campaign = await getCampaign(id, tenantId);
  await db.update(campaigns).set({ contactsProcessed: analytics.processed, ...(analytics.uncertain && campaign.status === "running" ? { status: "paused" } : analytics.total && analytics.processed === analytics.total && campaign.status !== "cancelled" ? { status: "completed", completedAt: new Date() } : {}) }).where(eq(campaigns.id, id));
}
export async function launchCampaign(id: string, tenantId: string, userId: string, consent: boolean) {
  if (!consent) throw new MessagingError("Confirm that every recipient opted in before launching.");
  const campaign = await getCampaign(id, tenantId);
  if (campaign.status !== "draft") throw new MessagingError("Only a draft campaign can be launched.", 409);
  const leads = await db.query.campaignLeads.findMany({ where: and(eq(campaignLeads.campaignId, id), eq(campaignLeads.tenantId, tenantId)) });
  if (!leads.length) throw new MessagingError("Add recipients before launching.");
  const links = await db.query.campaignAccounts.findMany({ where: eq(campaignAccounts.campaignId, id) });
  const instances = links.length ? await db.query.whatsappInstances.findMany({ where: and(eq(whatsappInstances.tenantId, tenantId), eq(whatsappInstances.status, "connected"), inArray(whatsappInstances.id, links.map(link => link.instanceId))) }) : [];
  if (instances.length !== links.length || !instances.length) throw new MessagingError("Choose connected WhatsApp accounts before launching.");
  if (campaign.customDelayMin > campaign.customDelayMax) throw new MessagingError("Minimum pacing cannot exceed maximum pacing.");
  const variants = campaign.variants as { id: string; spintaxTemplate: string; weight?: number; payload?: OutboundPayload }[];
  if (!variants.length && !campaign.spintaxTemplate.trim()) throw new MessagingError("Add a campaign message before launching.");
  const prepared = leads.map((lead, index) => {
    const inst = instances[index % instances.length];
    let variant = variants.length ? variants[index % variants.length] : { id: "default", spintaxTemplate: campaign.spintaxTemplate };
    if (campaign.variantMode === "account_locked" && variants.length) variant = variants[(index % instances.length) % variants.length];
    if (campaign.variantMode === "weighted" && variants.length) { let point = ((index * 2654435761) >>> 0) / 4294967296 * variants.reduce((sum, item) => sum + (item.weight || 1), 0); variant = variants.find(item => { point -= item.weight || 1; return point <= 0; }) || variants[variants.length - 1]; }
    const variables = { ...(lead.variables as Record<string,string>), name: lead.name || (lead.variables as any).name || "" };
    const render = (text: string) => parseSpintax(injectVariables(text, variables));
    const payload = variant.payload ? { ...variant.payload, ...(variant.payload.type === "text" ? { text: render(variant.payload.text) } : variant.payload.type === "media" ? { caption: render(variant.payload.caption || "") } : {}) } : { type: "text" as const, text: render(variant.spintaxTemplate) };
    return { inst, lead, payload: outboundPayloadSchema.parse(payload) };
  });
  await assertCampaignWorkerAvailable();
  await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${id}))`);
    const current = await tx.query.campaigns.findFirst({ where: eq(campaigns.id, id) });
    if (current?.status !== "draft") throw new MessagingError("Campaign is already launched.", 409);
    // Outbox rows are prepared before running; the worker recovers queue interruptions.
    for (const item of prepared) {
      const requestHash = (await import("node:crypto")).createHash("sha256").update(JSON.stringify(item.payload)).digest("hex");
      await tx.insert(outboundMessages).values({ tenantId, instanceId: item.inst.id, campaignId: id, requestKey: `campaign-${id}-${item.lead.phone}`, requestHash, remoteJid: `${item.lead.phone}@s.whatsapp.net`, payload: item.payload, messageText: (await import("./messaging-contracts")).payloadPreview(item.payload), consentConfirmedBy: userId }).onConflictDoNothing();
    }
    await tx.update(campaigns).set({ status: "running", startedAt: new Date(), consentConfirmedAt: new Date(), totalContacts: leads.length }).where(eq(campaigns.id, id));
  });
  const outbound = await db.query.outboundMessages.findMany({ where: and(eq(outboundMessages.campaignId, id), eq(outboundMessages.tenantId, tenantId), eq(outboundMessages.status, "queued")), columns: { id: true } });
  // The cloud worker claims these durable rows; local web servers need no
  // network access to Railway's private Redis and cannot lose a launch on exit.
  return { campaignId: id, queuedContacts: outbound.length };
}
