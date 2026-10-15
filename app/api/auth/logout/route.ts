import { NextResponse } from "next/server";

import { clearSessionCookie } from "@/lib/account/cookies";
import { resolveSession, revokeSession } from "@/lib/account/auth";

export const runtime = "nodejs";

/** POST /api/auth/logout — revoke the presented session and clear the cookie. */
export async function POST(request: Request) {
  const session = await resolveSession(request);
  if (session) {
    try {
      await revokeSession(session.sessionId);
    } catch {
      // Even if revocation fails, the cookie is cleared client-side.
    }
  }

  const response = NextResponse.json({ ok: true });
  return clearSessionCookie(response, request);
}
