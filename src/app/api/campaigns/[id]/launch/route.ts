import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthAndTenant } from "@/lib/auth";
import { authenticationError } from "@/lib/api-error";
import { launchCampaign } from "@/lib/campaign-service";
import { MessagingError } from "@/lib/outbound-service";
export async function POST(req: Request,{params}:{params:Promise<{id:string}>}) {
 try { const {tenantId,userId}=await requireAuthAndTenant(req.headers.get("Authorization")); const {id}=await params; const input=z.object({consentConfirmed:z.literal(true)}).parse(await req.json()); return NextResponse.json(await launchCampaign(id,tenantId,userId,input.consentConfirmed),{status:202}); }
 catch(error){const auth=authenticationError(error);if(auth)return auth;if(error instanceof z.ZodError)return NextResponse.json({error:"Confirm that recipients opted in before launching."},{status:400});if(error instanceof MessagingError)return NextResponse.json({error:error.message},{status:error.status});return NextResponse.json({error:error instanceof Error?error.message:"Campaign could not be launched."},{status:503});}
}
