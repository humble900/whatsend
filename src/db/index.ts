import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function createQueryClient() {
  const configured=Number(process.env.DATABASE_POOL_MAX||5);
  const client=postgres(process.env.DATABASE_URL!,{
    max:Number.isInteger(configured)&&configured>0?Math.min(configured,20):5,
    idle_timeout:120,connect_timeout:15,prepare:false,
    connection:{statement_timeout:15000},
  });
  return client;
}
// Fast Refresh must reuse the pool instead of leaving a pool per module reload.
const state=globalThis as typeof globalThis & {whatsendQueryClient?:ReturnType<typeof createQueryClient>};
const client=process.env.NODE_ENV==='development'?(state.whatsendQueryClient??=createQueryClient()):createQueryClient();
export const db=drizzle(client,{schema});
