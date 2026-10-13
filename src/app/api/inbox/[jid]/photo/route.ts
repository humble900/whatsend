import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthAndTenant } from "@/lib/auth";
import { authenticationError } from "@/lib/api-error";
import { getContactPhoto } from "@/lib/contact-photo";
export async function GET(req:Request,{params}:{params:Promise<{jid:string}>}) {
 try {
  const {tenantId}=await requireAuthAndTenant(req.headers.get("Authorization"));
  const {jid}=await params;z.string().regex(/^\d{7,15}@s\.whatsapp\.net$/).parse(jid);
  const url=new URL(req.url),instanceId=z.uuid().parse(url.searchParams.get("instanceId"));
  const photo=await getContactPhoto(tenantId,instanceId,jid,url.searchParams.get("refresh")==="true");
  return photo?NextResponse.json(photo,{headers:{"Cache-Control":"private, no-store"}}):NextResponse.json({error:"Contact not found."},{status:404});
 }catch(error){return authenticationError(error)||(error instanceof z.ZodError?NextResponse.json({error:"Invalid contact."},{status:400}):NextResponse.json({error:"Photo is temporarily unavailable."},{status:503}));}
}
