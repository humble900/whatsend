import { NextResponse } from "next/server";
import { z } from "zod";
import { inboxFilterSchema,listInbox } from "@/lib/inbox-service";
import { requireAuthAndTenant } from "@/lib/auth";
import { authenticationError } from "@/lib/api-error";
export async function GET(req: Request) {
 try {
  const {tenantId}=await requireAuthAndTenant(req.headers.get("Authorization"));
  const filters=inboxFilterSchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return NextResponse.json(await listInbox(tenantId,filters));
 }catch(error){return authenticationError(error)||(error instanceof z.ZodError ? NextResponse.json({error:"Choose valid inbox filters."},{status:400}) : NextResponse.json({error:"Could not load conversations."},{status:500}));}
}
