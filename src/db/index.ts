import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Retrieve database URL from environment
const connectionString = process.env.DATABASE_URL!;

// 1. Connection Pooling
// Supabase free-tier pooler can be slow to handshake — use generous timeouts.
const queryClient = postgres(connectionString, {
  max: 10,                // Supabase free tier supports ~15 concurrent connections
  idle_timeout: 30,       // 30 seconds before releasing idle connections
  connect_timeout: 30,    // 30 seconds to establish connection (Supabase pooler can be slow)
  prepare: false,         // Required for Supabase's connection pooler (transaction mode)
  connection: {
    statement_timeout: 15000, // Kill queries that take longer than 15 seconds
  }
});

// Initialize Drizzle ORM
export const db = drizzle(queryClient, { schema });
