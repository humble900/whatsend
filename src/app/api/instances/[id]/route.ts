import { NextResponse } from "next/server";
import { requireAuthAndTenant } from "@/lib/auth";
import { authenticationError } from "@/lib/api-error";
import { evolutionApi } from "@/lib/evolution";
import { db } from "@/db";
import { whatsappInstances } from "@/db/schema";
import { eq,and } from "drizzle-orm";
import { z } from "zod";
async function update(req:Request,id:string,remove=false){
 try {
  const {tenantId,role}=await requireAuthAndTenant(req.headers.get("Authorization"));
  if(role!=="admin")return NextResponse.json({error:"Only admins can change connections."},{status:403});
  const instance=await db.query.whatsappInstances.findFirst({where:and(eq(whatsappInstances.id,id),eq(whatsappInstances.tenantId,tenantId))});if(!instance)return NextResponse.json({error:"Connection not found."},{status:404});
  if(remove){await evolutionApi(instance.evolutionServerUrl,`/instance/delete/${encodeURIComponent(instance.evolutionInstanceId)}`,"DELETE");await db.delete(whatsappInstances).where(eq(whatsappInstances.id,id));}
  else {const body=await req.json();if(body.action==="logout"){await evolutionApi(instance.evolutionServerUrl,`/instance/logout/${encodeURIComponent(instance.evolutionInstanceId)}`,"DELETE");await db.update(whatsappInstances).set({status:"disconnected"}).where(eq(whatsappInstances.id,id));}
   else {const values=z.object({dailyLimit:z.number().int().min(1).max(1000),name:z.string().trim().min(1).max(100).optional()}).parse(body);await db.update(whatsappInstances).set(values).where(eq(whatsappInstances.id,id));}}
  return NextResponse.json({success:true});
 }catch(error){const auth=authenticationError(error);if(auth)return auth;return NextResponse.json({error:error instanceof z.ZodError?error.issues[0]?.message:error instanceof Error?error.message:"Connection update failed."},{status:error instanceof z.ZodError?400:502});}
}
export async function DELETE(req:Request,{params}:{params:Promise<{id:string}>}){return update(req,(await params).id,true);}
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){return update(req,(await params).id);}
