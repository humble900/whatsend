import { getServiceSupabase } from "./supabase-server";
import { db } from "../db";
import { users, tenants } from "../db/schema";
import { eq, sql } from "drizzle-orm";

export class AccountError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function getAuthenticatedAccount(authHeader: string | null) {
  const match = authHeader?.match(/^Bearer\s+(\S+)$/i);
  if (!match || match[1] === "mock-token") throw new AccountError("Please sign in to continue.", 401);
  const { data: { user }, error } = await getServiceSupabase().auth.getUser(match[1]);
  if (error && (!error.status || error.status >= 500)) throw new AccountError("The sign-in service is temporarily unavailable. Please try again.", 503);
  if (error || !user || !user.email) throw new AccountError("Your session has expired. Please sign in again.", 401);

  let membership = await db.query.users.findFirst({ where: eq(users.id, user.id) });
  if (!membership) {
    // First sign-in creates an isolated workspace. Never trust metadata for roles or tenant IDs.
    membership = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${user.id}))`);
      const existing = await tx.query.users.findFirst({ where: eq(users.id, user.id) });
      if (existing) return existing;
      const rawName = user.user_metadata.full_name || user.user_metadata.name;
      const name = typeof rawName === "string" && rawName.trim() ? rawName.trim().slice(0, 150) : user.email!.split("@")[0];
      const result = await tx.execute(sql`insert into tenants (name, plan) values (${`${name}'s workspace`}, 'starter') returning id`);
      const workspace = result[0] as { id: string };
      const [member] = await tx.insert(users).values({ id: user.id, email: user.email!, tenantId: workspace.id, role: "admin" }).returning();
      return member;
    });
  }
  if (membership.email !== user.email) {
    await db.update(users).set({ email: user.email }).where(eq(users.id, user.id));
  }
  const workspace = await db.query.tenants.findFirst({ where: eq(tenants.id, membership.tenantId), columns: { id: true, name: true, plan: true } });
  if (!workspace) throw new AccountError("Your workspace could not be found.", 403);
  return { user, membership, workspace };
}

export async function requireAuthAndTenant(authHeader: string | null) {
  const match = authHeader?.match(/^Bearer\s+(\S+)$/i);
  if (!match || match[1] === "mock-token") throw new AccountError("Please sign in to continue.",401);
  // Supabase verifies the signature and expiration with cached signing keys.
  // Authorization still comes from the database, never from JWT role metadata.
  const {data,error} = await getServiceSupabase().auth.getClaims(match[1]);
  if(error && (!error.status || error.status >= 500)) throw new AccountError("The sign-in service is temporarily unavailable. Please try again.",503);
  const userId = data?.claims?.sub;
  if(error || typeof userId !== "string") throw new AccountError("Your session has expired. Please sign in again.",401);
  let membership = await db.query.users.findFirst({where:eq(users.id,userId)});
  if(!membership) membership = (await getAuthenticatedAccount(authHeader)).membership;
  return {userId,tenantId:membership.tenantId,role:membership.role};
}
