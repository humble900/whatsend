import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { AccountError } from "@/lib/account-auth";

export function authenticationError(error: unknown) {
  unstable_rethrow(error);
  return error instanceof AccountError
    ? NextResponse.json({ error: error.message }, { status: error.status })
    : null;
}
