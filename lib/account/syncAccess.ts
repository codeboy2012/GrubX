import { NextResponse } from "next/server";

import { resolveSession } from "@/lib/account/auth";
import { ensureAccountSchema, getSql } from "@/lib/account/db";

/**
 * Session + profile resolution for the sync API.
 *
 * The profile id ALWAYS comes from the server-side session — a client-supplied
 * profileId is validated against the authenticated user's own rows, never
 * trusted as the access key. That is the ownership boundary for every sync
 * route: no session → 401; profile not owned by the session user → 403.
 */

export type SyncContext =
  | { ok: true; userId: string; email: string; profileId: string }
  | { ok: false; response: NextResponse };

export const resolveSyncContext = async (
  request: Request,
  requestedProfileId: string | null,
): Promise<SyncContext> => {
  const session = await resolveSession(request);
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Sign in required." }, { status: 401 }),
    };
  }

  try {
    await ensureAccountSchema();
    const sql = getSql();

    if (requestedProfileId) {
      const owned = await sql`
        SELECT id FROM account_profiles
        WHERE id = ${requestedProfileId} AND user_id = ${session.userId}
        LIMIT 1
      `;
      if (!owned[0]) {
        return {
          ok: false,
          response: NextResponse.json({ error: "Profile not found for this account." }, { status: 403 }),
        };
      }
      return { ok: true, userId: session.userId, email: session.email, profileId: requestedProfileId };
    }

    const rows = await sql`
      SELECT id FROM account_profiles WHERE user_id = ${session.userId} AND is_default = TRUE LIMIT 1
    `;
    if (!rows[0]) {
      return {
        ok: false,
        response: NextResponse.json({ error: "No profile available." }, { status: 409 }),
      };
    }

    return { ok: true, userId: session.userId, email: session.email, profileId: rows[0].id as string };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("DATABASE_URL")) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Account storage is not configured." }, { status: 503 }),
      };
    }
    return {
      ok: false,
      response: NextResponse.json({ error: "Sync is unavailable right now." }, { status: 500 }),
    };
  }
};

const readIdPattern = /^[\w:-]{1,128}$/;

export const readMediaId = (value: unknown): string | null =>
  typeof value === "string" && readIdPattern.test(value) ? value : null;
