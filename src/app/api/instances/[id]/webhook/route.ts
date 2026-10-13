import { NextResponse } from "next/server";
import { requireAuthAndTenant } from "@/lib/auth";
import { authenticationError } from "@/lib/api-error";
import { db } from "@/db";
import { whatsappInstances } from "@/db/schema";
import { eq,and } from "drizzle-orm";
import { configureEvolutionWebhook,evolutionApi } from "@/lib/evolution";
async function handle(req:Request,id:string,configure=false){try{const {tenantId,role}=await requireAuthAndTenant(req.headers.get("Authorization"));if(role!=="admin")return NextResponse.json({error:"Only admins can configure callbacks."},{status:403});const instance=await db.query.whatsappInstances.findFirst({where:and(eq(whatsappInstances.id,id),eq(whatsappInstances.tenantId,tenantId))});if(!instance)return NextResponse.json({error:"Connection not found."},{status:404});const result=configure?await configureEvolutionWebhook(instance.evolutionServerUrl,instance.evolutionInstanceId):await evolutionApi(instance.evolutionServerUrl,`/webhook/find/${encodeURIComponent(instance.evolutionInstanceId)}`);return NextResponse.json({configured:!!result,enabled:result?.enabled||false,url:result?.url||null,events:result?.events||[]});}catch(error){return authenticationError(error)||NextResponse.json({error:error instanceof Error?error.message:"Callback update failed."},{status:502});}}
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){return handle(req,(await params).id);}
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){return handle(req,(await params).id,true);}
