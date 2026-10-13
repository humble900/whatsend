import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthAndTenant } from "@/lib/auth";
import { authenticationError } from "@/lib/api-error";
import { db } from "@/db";
import { campaigns, campaignAccounts, campaignLeads, whatsappInstances } from "@/db/schema";
import { and, eq, inArray, desc } from "drizzle-orm";
import { campaignEditSchema, campaignLeadSchema, launchCampaign } from "@/lib/campaign-service";
import { MessagingError } from "@/lib/outbound-service";
export async function GET(req: Request) {
 try {const {tenantId}=await requireAuthAndTenant(req.headers.get("Authorization"));return NextResponse.json({campaigns:await db.query.campaigns.findMany({where:eq(campaigns.tenantId,tenantId),orderBy:[desc(campaigns.createdAt)]})});}
 catch(error){return authenticationError(error)||NextResponse.json({error:"Could not load campaigns."},{status:500});}
}
export async function POST(req: Request) {
 let campaignId:string|undefined;
 try {
  const {tenantId,userId}=await requireAuthAndTenant(req.headers.get("Authorization"));const body=await req.json();
  const name=z.string().trim().min(1).max(120).parse(body.name);const settings=campaignEditSchema.parse(body);const leads=body.contacts?campaignLeadSchema.parse({contacts:body.contacts}).contacts:[];
  const {instanceIds=[],payload,status:ignored,...fields}=settings;
  const instances=instanceIds.length?await db.query.whatsappInstances.findMany({where:and(eq(whatsappInstances.tenantId,tenantId),inArray(whatsappInstances.id,instanceIds))}):[];
  if(instances.length!==new Set(instanceIds).size)throw new MessagingError("One or more sending accounts were not found.",404);
  const unique=[...new Map(leads.map(lead=>[lead.phone,lead])).values()];
  await db.transaction(async tx=>{
   const [created]=await tx.insert(campaigns).values({tenantId,name,spintaxTemplate:body.spintaxTemplate||"",...fields,timezone:settings.timezone||"UTC",status:"draft",totalContacts:unique.length,...(payload?{variants:[{id:"default",label:"Default",weight:100,spintaxTemplate:payload.type==="text"?payload.text:"",payload}]}:{})}).returning({id:campaigns.id});campaignId=created.id;
   if(instanceIds.length)await tx.insert(campaignAccounts).values([...new Set(instanceIds)].map(instanceId=>({campaignId:created.id,instanceId})));
   for(let offset=0;offset<unique.length;offset+=500)await tx.insert(campaignLeads).values(unique.slice(offset,offset+500).map(lead=>({tenantId,campaignId:created.id,phone:lead.phone,name:lead.name,variables:lead.variables||{}})));
  });
  if(body.launch===true)return NextResponse.json(await launchCampaign(campaignId!,tenantId,userId,body.consentConfirmed===true),{status:202});
  return NextResponse.json({success:true,campaignId,status:"draft"},{status:201});
 }catch(error){const auth=authenticationError(error);if(auth)return auth;if(error instanceof z.ZodError)return NextResponse.json({error:error.issues[0]?.message,campaignId},{status:400});return NextResponse.json({error:error instanceof Error?error.message:"Could not create campaign.",campaignId,draftSaved:!!campaignId},{status:error instanceof MessagingError?error.status:503});}
}
