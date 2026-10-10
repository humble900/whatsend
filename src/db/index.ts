import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Retrieve database URL from environment
const connectionString = process.env.DATABASE_URL!;

// 1. Connection Pooling (PgBouncer)
// Rule: Max 50 connections to prevent RAM exhaustion. Statement timeout kills dangling queries.
const queryClient = postgres(connectionString, {
  max: 50,
  idle_timeout: 10,       // 10 seconds
  connect_timeout: 5,     // 5 seconds
  prepare: false,         // PgBouncer requires prepare: false in transaction mode
  connection: {
    statement_timeout: 5000, // Kill queries that take longer than 5 seconds
  }
});

// Initialize Drizzle ORM
export const db = drizzle(queryClient, { schema });
