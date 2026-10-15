import { NextResponse } from "next/server";

import { ConfigError } from "@/lib/env";
import { buildEdgeCacheHeaders } from "@/lib/http/cache";
import { fetchTmdbJson, getTmdbRouteConfig } from "@/lib/tmdb/request";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path")?.trim();

  if (!path) {
    return NextResponse.json({ error: "Missing TMDB path." }, { status: 400 });
  }

  try {
    const { rule } = getTmdbRouteConfig(path);
    const forwardedParams = Object.fromEntries(
      Array.from(searchParams.entries()).filter(([key]) => key !== "path" && rule.params.includes(key)),
    );
    const { payload, ttlSeconds } = await fetchTmdbJson<Record<string, unknown>>(path, forwardedParams);

    return NextResponse.json(payload, {
      headers: buildEdgeCacheHeaders(ttlSeconds),
    });
  } catch (error) {
    // A missing key is a deployment state, not a client mistake: report it as an
    // unavailable service with an actionable message and keep the variable name
    // and hint in the server log only.
    if (error instanceof ConfigError) {
      console.error("[GrubX] TMDB is not configured:", error.variable, error.hint);
      return NextResponse.json(
        {
          error: "Movie and TV metadata is not configured on this server.",
          code: "tmdb-not-configured",
        },
        { status: 503 },
      );
    }

    const message = error instanceof Error ? error.message : "TMDB request failed.";
    return NextResponse.json(
      {
        error: message,
      },
      { status: /TMDB request failed/i.test(message) ? 502 : 400 },
    );
  }
}
