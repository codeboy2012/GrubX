import { NextResponse } from "next/server";

import { buildEdgeCacheHeaders } from "@/lib/http/cache";
import { getMangaProvider } from "@/lib/manga/server";
import type { MangaListKind } from "@/types/manga";

export const runtime = "nodejs";

const LIST_KINDS: MangaListKind[] = ["popular", "recent", "search", "tag"];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LANGUAGE_PATTERN = /^[a-z]{2}(-[a-z]{2})?$/i;
const MAX_TITLE_LENGTH = 120;

const json = (body: unknown, ttlSeconds: number) =>
  NextResponse.json(body, { headers: buildEdgeCacheHeaders(ttlSeconds) });

const readInt = (value: string | null, fallback: number, min: number, max: number) => {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const resource = searchParams.get("resource") ?? "list";
  const provider = getMangaProvider();

  try {
    switch (resource) {
      case "status":
        return json(provider.status(), 600);

      case "tags":
        return json(await provider.tags(), 86_400);

      case "list": {
        const kindParam = searchParams.get("kind") ?? "popular";
        if (!LIST_KINDS.includes(kindParam as MangaListKind)) {
          return NextResponse.json({ error: "Unsupported manga list kind." }, { status: 400 });
        }
        const kind = kindParam as MangaListKind;
        const title = searchParams.get("query")?.trim().slice(0, MAX_TITLE_LENGTH) ?? "";
        const tag = searchParams.get("tag")?.trim() ?? "";
        const language = searchParams.get("language")?.trim() ?? "";

        if (kind === "search" && title.length < 2) {
          return NextResponse.json({ error: "Enter at least two characters to search manga." }, { status: 400 });
        }
        if (kind === "tag" && !UUID_PATTERN.test(tag)) {
          return NextResponse.json({ error: "A valid manga genre id is required." }, { status: 400 });
        }
        if (language && !LANGUAGE_PATTERN.test(language)) {
          return NextResponse.json({ error: "Unsupported language code." }, { status: 400 });
        }

        const page = await provider.list({
          kind,
          query: title || undefined,
          tag: kind === "tag" ? tag : undefined,
          language: language || undefined,
          limit: readInt(searchParams.get("limit"), 24, 1, 60),
          offset: readInt(searchParams.get("offset"), 0, 0, 10_000),
        });
        return json(page, 300);
      }

      case "details": {
        const id = searchParams.get("id")?.trim() ?? "";
        if (!UUID_PATTERN.test(id)) {
          return NextResponse.json({ error: "A valid manga id is required." }, { status: 400 });
        }
        const details = await provider.details(id);
        if (!details) {
          return NextResponse.json({ error: "Manga not found." }, { status: 404 });
        }
        return json(details, 1_800);
      }

      case "chapters": {
        const id = searchParams.get("id")?.trim() ?? "";
        const language = searchParams.get("language")?.trim() || "en";
        if (!UUID_PATTERN.test(id)) {
          return NextResponse.json({ error: "A valid manga id is required." }, { status: 400 });
        }
        if (!LANGUAGE_PATTERN.test(language)) {
          return NextResponse.json({ error: "Unsupported language code." }, { status: 400 });
        }
        return json(await provider.chapters(id, language), 900);
      }

      case "pages": {
        const chapterId = searchParams.get("chapterId")?.trim() ?? "";
        if (!UUID_PATTERN.test(chapterId)) {
          return NextResponse.json({ error: "A valid chapter id is required." }, { status: 400 });
        }
        return json(await provider.chapterPages(chapterId), 600);
      }

      default:
        return NextResponse.json({ error: "Unsupported manga resource." }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Manga request failed.";
    return NextResponse.json({ error: message }, { status: /MangaDex request failed/i.test(message) ? 502 : 500 });
  }
}
