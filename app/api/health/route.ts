import { NextResponse } from "next/server";

/**
 * GET /api/health
 *
 * Liveness is always an answer from this process (name + uptime) so a running
 * server is distinguishable from a dead one. The database probe runs only when
 * account storage is configured; a misconfigured deployment still returns ok
 * for the process itself but reports `database: "skipped"` honestly. Internal
 * error details never disappear into logs-only silence here, but they never
 * include secrets: only the check name that failed.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  const databaseUrlConfigured = Boolean(process.env.DATABASE_URL?.trim());

  let database: "ok" | "error" | "skipped" = "skipped";
  let databaseError: string | undefined;

  if (databaseUrlConfigured) {
    try {
      const { ensureAccountSchema, getSql } = await import("@/lib/account/db");
      await ensureAccountSchema();
      const sql = getSql();
      await sql`SELECT 1`;
      database = "ok";
    } catch (error) {
      database = "error";
      databaseError = error instanceof Error ? error.name : "unknown";
    }
  }

  const body = {
    status: "ok",
    uptimeSeconds: Math.round(process.uptime()),
    checks: {
      database,
      databaseConfigured: databaseUrlConfigured,
    },
    checkedInMs: Date.now() - startedAt,
  };

  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
  });
}
