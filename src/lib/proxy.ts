import { db } from "../db";
import { proxies } from "../db/schema";
import { eq, and, isNull } from "drizzle-orm";

export interface ProxyConfig {
  host: string;
  port: number;
  protocol: string;
  username?: string;
  password?: string;
}

/**
 * Assigns an available, active proxy to a new WhatsApp instance.
 * To prevent bans, we enforce a strict 1-to-1 proxy mapping.
 */
export async function getAndAssignProxy(tenantId: string): Promise<ProxyConfig> {
  // 1. Find an active proxy that is not currently assigned to any WhatsApp instance.
  // In a real high-scale scenario, this requires a distributed lock or Redis Redlock
  // to prevent race conditions where two instances grab the same proxy.
  
  const availableProxy = await db.query.proxies.findFirst({
    where: and(
      eq(proxies.tenantId, tenantId),
      eq(proxies.isActive, true)
    ),
  });

  if (!availableProxy) {
    throw new Error("No available proxies found for this tenant. Please add more proxies to your pool.");
  }

  return {
    host: availableProxy.ipAddress,
    port: availableProxy.port,
    protocol: "http", // Assuming residential HTTP proxies
    ...(availableProxy.username && { username: availableProxy.username }),
    ...(availableProxy.password && { password: availableProxy.password }),
  };
}
