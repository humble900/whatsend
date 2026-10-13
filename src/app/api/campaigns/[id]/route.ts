import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthAndTenant } from "@/lib/auth";
import { authenticationError } from "@/lib/api-error";
import { db } from "@/db";
import { campaigns, campaignAccounts, campaignLeads, outboundMessages, whatsappInstances, messages, blacklist } from "@/db/schema";
import { and, eq, inArray, desc } from "drizzle-orm";
import { campaignAnalytics, campaignEditSchema, getCampaign } from "@/lib/campaign-service";
import { MessagingError } from "@/lib/outbound-service";
function failure(error: unknown) { const auth = authenticationError(error); if (auth) return auth; if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 }); if (error instanceof MessagingError) return NextResponse.json({ error: error.message }, { status: error.status }); return NextResponse.json({ error: "Could not update the campaign." }, { status: 500 }); }
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await requireAuthAndTenant(req.headers.get("Authorization")); const { id } = await params;
    const campaign = await getCampaign(id, tenantId);
    const links = await db.query.campaignAccounts.findMany({ where: eq(campaignAccounts.campaignId, id) });
    const assignedAccounts = links.length ? await db.query.whatsappInstances.findMany({ where: and(eq(whatsappInstances.tenantId, tenantId), inArray(whatsappInstances.id, links.map(link => link.instanceId))) }) : [];
    const leads = await db.query.campaignLeads.findMany({ where: and(eq(campaignLeads.campaignId, id), eq(campaignLeads.tenantId, tenantId)) });
    const requests = await db.query.outboundMessages.findMany({ where: and(eq(outboundMessages.campaignId, id), eq(outboundMessages.tenantId, tenantId)) });
    const blocked = await db.query.blacklist.findMany({ where: eq(blacklist.tenantId, tenantId) });
    const replies = leads.length ? await db.query.messages.findMany({ where: and(eq(messages.tenantId, tenantId), eq(messages.isFromMe, false), inArray(messages.remoteJid, leads.map(lead => `${lead.phone}@s.whatsapp.net`))), orderBy: [desc(messages.createdAt)], limit: 1000 }) : [];
    const analytics = await campaignAnalytics(id, tenantId);
    return NextResponse.json({ campaign: { ...campaign, assignedAccounts, analytics: { ...analytics, total: analytics.total || leads.length, queued: campaign.status === "draft" ? leads.length : analytics.queued } }, leads: leads.map(lead => { const request = requests.find(row => row.remoteJid === `${lead.phone}@s.whatsapp.net`); const replied = request?.sentAt && replies.some(row => row.instanceId === request.instanceId && row.remoteJid === request.remoteJid && row.createdAt > request.sentAt!); return { ...lead, source: "Campaign", leadStatus: blocked.some(row => row.phoneNumber === `${lead.phone}@s.whatsapp.net`) ? "lost" : replied ? "replied" : "new", waVerified: "unverified", messageStatus: request?.status || null }; }) });
  } catch (error) { return failure(error); }
}
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await requireAuthAndTenant(req.headers.get("Authorization")); const { id } = await params;
    const campaign = await getCampaign(id, tenantId); const input = campaignEditSchema.parse(await req.json());
    const { instanceIds, payload, ...update } = input;
    if (campaign.status !== "draft" && Object.keys(update).some(key => !["name", "status"].includes(key))) throw new MessagingError("Pause or finish this campaign; message and recipient changes belong in a new draft.", 409);
    if (input.status === "paused" && campaign.status !== "running") throw new MessagingError("Only a running campaign can be paused.", 409);
    if (input.status === "running" && !["paused", "running"].includes(campaign.status)) throw new MessagingError("Launch this draft after completing its setup.", 409);
    if (input.status === "running") { const uncertain = await db.query.outboundMessages.findFirst({ where: and(eq(outboundMessages.campaignId, id), eq(outboundMessages.status, "uncertain")) }); if (uncertain) throw new MessagingError("Review uncertain deliveries before resuming this campaign.", 409); }
    if ((input.customDelayMin ?? campaign.customDelayMin) > (input.customDelayMax ?? campaign.customDelayMax)) throw new MessagingError("Minimum pacing cannot exceed maximum pacing.");
    if (instanceIds && campaign.status !== "draft") throw new MessagingError("Sending accounts can only be changed in a draft.", 409);
    const instances = instanceIds ? await db.query.whatsappInstances.findMany({ where: and(eq(whatsappInstances.tenantId, tenantId), inArray(whatsappInstances.id, instanceIds)) }) : [];
    if (instanceIds && instances.length !== new Set(instanceIds).size) throw new MessagingError("One or more accounts are unavailable.", 404);
    await db.transaction(async tx => {
      await tx.update(campaigns).set({ ...update, ...(payload ? { variants: [{ id: "default", label: "Default", weight: 100, spintaxTemplate: payload.type === "text" ? payload.text : "", payload }] } : {}) }).where(and(eq(campaigns.id, id), eq(campaigns.tenantId, tenantId)));
      if (instanceIds) { await tx.delete(campaignAccounts).where(eq(campaignAccounts.campaignId, id)); await tx.insert(campaignAccounts).values([...new Set(instanceIds)].map(instanceId => ({ campaignId: id, instanceId }))); }
      if (input.status === "cancelled") await tx.update(outboundMessages).set({ status: "cancelled", updatedAt: new Date() }).where(and(eq(outboundMessages.campaignId, id), eq(outboundMessages.status, "queued")));
    });
    return NextResponse.json({ success: true });
  } catch (error) { return failure(error); }
}

export async function DELETE(req: Request,{params}:{params:Promise<{id:string}>}) {
 try {const {tenantId,role}=await requireAuthAndTenant(req.headers.get("Authorization"));if(role!=="admin")return NextResponse.json({error:"Only admins can delete campaigns."},{status:403});const {id}=await params;const campaign=await getCampaign(id,tenantId);if(["running","queued","paused"].includes(campaign.status))throw new MessagingError("Cancel this campaign before deleting it.",409);const pending=await db.query.outboundMessages.findFirst({where:and(eq(outboundMessages.campaignId,id),eq(outboundMessages.status,"sending"))});if(pending)throw new MessagingError("A send is still in progress. Wait for its result before deleting.",409);await db.delete(campaigns).where(and(eq(campaigns.id,id),eq(campaigns.tenantId,tenantId)));return NextResponse.json({success:true});}catch(error){return failure(error);}
}
