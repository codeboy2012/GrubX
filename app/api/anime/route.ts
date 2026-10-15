import { NextResponse } from "next/server";

import { AniPmError } from "@/lib/anime/anipm";
import { validateAnimeRequest } from "@/lib/anime/params";
import { getAnimeProvider } from "@/lib/anime/server";
import { buildEdgeCacheHeaders } from "@/lib/http/cache";
import type { AnimeResource } from "@/lib/anime/params";

export const runtime = "nodejs";

/** Documented cache windows per resource; the upstream fetch is revalidated the same way. */
const TTL_SECONDS: Record<AnimeResource, number> = {
  status: 600,
  search: 300,
  title: 3_600,
  series: 3_600,
  episodes: 3_600,
  recent: 300,
  schedule: 900,
  top: 1_800,
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const validation = validateAnimeRequest(searchParams);

  if (!validation.ok) {
    return NextResponse.json({ error: validation.message }, { status: validation.status });
  }

  const { resource, query, page, limit, genre, format, range, id } = validation.request;
  const provider = getAnimeProvider();
  const cacheHeaders = buildEdgeCacheHeaders(TTL_SECONDS[resource], TTL_SECONDS[resource] * 8);

  try {
    switch (resource) {
      case "status":
        return NextResponse.json(provider.status(), { headers: cacheHeaders });

      case "search":
        return NextResponse.json(await provider.search({ query, page, limit }), { headers: cacheHeaders });

      case "recent":
        return NextResponse.json(await provider.recent({ page, limit }), { headers: cacheHeaders });

      case "top":
        return NextResponse.json(await provider.top({ range, genre, format, limit }), { headers: cacheHeaders });

      case "schedule":
        return NextResponse.json(await provider.schedule(), { headers: cacheHeaders });

      case "title":
      case "series":
      case "episodes": {
        if (!id) {
          return NextResponse.json({ error: "A valid AniList or MyAnimeList id is required." }, { status: 400 });
        }

        if (resource === "episodes") {
          const episodes = await provider.episodes(id);
          return NextResponse.json(episodes, { headers: cacheHeaders });
        }

        const payload = resource === "series" ? await provider.series(id) : await provider.title(id);
        if (!payload) {
          return NextResponse.json({ error: "That anime title is not available on Ani.pm." }, { status: 404 });
        }
        return NextResponse.json(payload, { headers: cacheHeaders });
      }

      default:
        return NextResponse.json({ error: "Unsupported anime resource." }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof AniPmError) {
      const status = error.status === 404 || error.status === 410 ? 404 : 502;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }

    return NextResponse.json({ error: "The anime catalogue is unavailable right now." }, { status: 500 });
  }
}
