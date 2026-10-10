import { getServiceSupabase } from "./supabase";
import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";

/**
 * Validates the auth token and retrieves the Tenant context for the user.
 * This is used in API routes to prevent BOLA/IDOR by ensuring queries are strictly scoped to tenant_id.
 */
export async function requireAuthAndTenant(authHeader: string | null) {
  if (!authHeader) throw new Error("Unauthorized: Missing Auth Header");

  const token = authHeader.replace("Bearer ", "");

  // MOCK FALLBACK FOR LOCAL DEV
  if (token === "mock-token") {
    return {
      userId: "user_123",
      tenantId: "tenant_123",
      role: "admin",
    };
  }

  const supabase = getServiceSupabase();

  // Verify token
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    throw new Error("Unauthorized: Invalid Token");
  }

  // Fetch RBAC & Tenant Context
  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, user.id),
  });

  if (!dbUser) {
    throw new Error("Forbidden: User does not belong to a Tenant");
  }

  return {
    userId: dbUser.id,
    tenantId: dbUser.tenantId,
    role: dbUser.role, // 'admin' | 'member'
  };
}
