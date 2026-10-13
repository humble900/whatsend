import { unstable_rethrow } from "next/navigation";
import { NextResponse } from "next/server";
import { AccountError, getAuthenticatedAccount } from "@/lib/account-auth";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";

function metadataText(value: unknown) { return typeof value === "string" ? value : ""; }
function accountResponse(account: Awaited<ReturnType<typeof getAuthenticatedAccount>>) {
  const { user, membership, workspace } = account;
  return {
    id: user.id, email: user.email, pendingEmail: user.new_email || null,
    fullName: metadataText(user.user_metadata.full_name) || metadataText(user.user_metadata.name),
    jobTitle: metadataText(user.user_metadata.job_title),
    contactPhone: metadataText(user.user_metadata.contact_phone),
    role: membership.role, createdAt: user.created_at,
    providers: user.identities?.map(identity => identity.provider) || [],
    workspace,
  };
}
function failure(error: unknown) {
  unstable_rethrow(error);
  if (error instanceof AccountError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error("Account request failed", error);
  return NextResponse.json({ error: "We couldn’t load your account. Please try again." }, { status: 500 });
}
export async function GET(req: Request) {
  const authorization = req.headers.get("Authorization");
  try { return NextResponse.json(accountResponse(await getAuthenticatedAccount(authorization)), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return failure(error); }
}
export async function PATCH(req: Request) {
  const authorization = req.headers.get("Authorization");
  try {
    const account = await getAuthenticatedAccount(authorization);
    if (account.membership.role !== "admin") throw new AccountError("Only workspace admins can change the workspace name.", 403);
    const body = await req.json().catch(() => { throw new AccountError("Send a valid profile update.", 400); });
    if (typeof body.workspaceName !== "string" || !body.workspaceName.trim() || body.workspaceName.trim().length > 150) {
      return NextResponse.json({ error: "Enter a workspace name between 1 and 150 characters." }, { status: 400 });
    }
    const [workspace] = await db.update(tenants).set({ name: body.workspaceName.trim() }).where(eq(tenants.id, account.membership.tenantId)).returning({ id: tenants.id, name: tenants.name, plan: tenants.plan });
    return NextResponse.json(accountResponse({ ...account, workspace }));
  } catch (error) { return failure(error); }
}
