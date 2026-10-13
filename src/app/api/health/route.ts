import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
export async function GET(req: Request) {
  void req.headers.get("User-Agent");
  try { await db.execute(sql`select 1`); return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } }); }
  catch { return NextResponse.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
