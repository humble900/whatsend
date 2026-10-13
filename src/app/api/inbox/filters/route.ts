import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthAndTenant } from "@/lib/auth";
import { authenticationError } from "@/lib/api-error";
import { inboxOptionSchema,listInboxOptions } from "@/lib/inbox-service";
export async function GET(req: Request) {
 try {
  const {tenantId}=await requireAuthAndTenant(req.headers.get("Authorization"));
  const filters=inboxOptionSchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return NextResponse.json(await listInboxOptions(tenantId,filters));
 }catch(error){return authenticationError(error)||(error instanceof z.ZodError ? NextResponse.json({error:"Choose valid inbox filters."},{status:400}) : NextResponse.json({error:"Could not load filter options."},{status:500}));}
}
