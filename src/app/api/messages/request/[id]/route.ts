import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthAndTenant } from "@/lib/auth";
import { authenticationError } from "@/lib/api-error";
import { db } from "@/db";
import { outboundMessages } from "@/db/schema";
import { and,eq } from "drizzle-orm";
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}) {
 try {
  const {tenantId}=await requireAuthAndTenant(req.headers.get('Authorization'));
  const {id}=await params;z.uuid().parse(id);
  const row=await db.query.outboundMessages.findFirst({where:and(eq(outboundMessages.tenantId,tenantId),eq(outboundMessages.requestKey,`direct-${id}`)),columns:{id:true,status:true,evolutionMessageId:true}});
  if(!row)return NextResponse.json({error:'Send request not found.'},{status:404});
  return NextResponse.json({id:row.id,status:row.status,messageId:row.evolutionMessageId},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){return authenticationError(error)||NextResponse.json({error:'Could not check delivery.'},{status:error instanceof z.ZodError?400:503});}
}
