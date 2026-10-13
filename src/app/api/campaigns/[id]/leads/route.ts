import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthAndTenant } from "@/lib/auth";
import { authenticationError } from "@/lib/api-error";
import { db } from "@/db";
import { campaignLeads, campaigns } from "@/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { campaignLeadSchema, getCampaign } from "@/lib/campaign-service";
import { MessagingError } from "@/lib/outbound-service";
async function edit(req: Request, id: string, remove = false) {
 try {
  const { tenantId } = await requireAuthAndTenant(req.headers.get("Authorization")); const campaign = await getCampaign(id, tenantId);
  if (campaign.status !== "draft") throw new MessagingError("Recipients can only be edited in a draft.", 409);
  const body = await req.json();
  const count=await db.transaction(async tx=>{
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${id}))`);
    const fresh=await tx.query.campaigns.findFirst({where:and(eq(campaigns.id,id),eq(campaigns.tenantId,tenantId)),columns:{status:true}});
    if(fresh?.status!=='draft')throw new MessagingError('Recipients can only be edited in a draft.',409);
  if (remove) { const input = z.object({ ids: z.array(z.uuid()).min(1).max(10000) }).parse(body); await tx.delete(campaignLeads).where(and(eq(campaignLeads.campaignId, id), eq(campaignLeads.tenantId, tenantId), inArray(campaignLeads.id, input.ids))); }
  else { const input = campaignLeadSchema.parse(body); const unique = [...new Map(input.contacts.map(lead => [lead.phone,lead])).values()]; for (let offset=0; offset<unique.length; offset+=500) await tx.insert(campaignLeads).values(unique.slice(offset,offset+500).map(lead => ({ campaignId:id,tenantId,phone:lead.phone,name:lead.name,variables:lead.variables||{} }))).onConflictDoNothing(); }
  const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` }).from(campaignLeads).where(eq(campaignLeads.campaignId, id));
  await tx.update(campaigns).set({ totalContacts: count }).where(eq(campaigns.id, id));
  return count;
  });
  return NextResponse.json({ success: true, count });
 } catch(error) { const auth = authenticationError(error); if(auth)return auth; if(error instanceof z.ZodError)return NextResponse.json({error:error.issues[0]?.message},{status:400}); if(error instanceof MessagingError)return NextResponse.json({error:error.message},{status:error.status}); return NextResponse.json({error:"Could not save recipients."},{status:500}); }
}
export async function POST(req: Request,{params}:{params:Promise<{id:string}>}){return edit(req,(await params).id);}
export async function DELETE(req: Request,{params}:{params:Promise<{id:string}>}){return edit(req,(await params).id,true);}
