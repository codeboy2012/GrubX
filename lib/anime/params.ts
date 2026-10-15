import { normalizeAnimeId } from "@/lib/anime/embed";
import type { AnimeTopRange } from "@/types/anime";

/**
 * Request validation for `/api/anime`. Kept free of I/O so it can be unit
 * tested directly and reused by the route handler.
 */

export const ANIME_RESOURCES = [
  "status",
  "search",
  "title",
  "series",
  "episodes",
  "recent",
  "schedule",
  "top",
] as const;

export type AnimeResource = (typeof ANIME_RESOURCES)[number];

export const MIN_QUERY_LENGTH = 2;
export const MAX_QUERY_LENGTH = 120;
export const MAX_LIMIT = 50;
export const MAX_PAGE = 20;

export const ANIME_TOP_RANGES: readonly AnimeTopRange[] = ["today", "week", "month", "all"];
export const ANIME_FORMATS = ["TV", "MOVIE", "OVA", "ONA", "SPECIAL"] as const;

export const isAnimeResource = (value: string): value is AnimeResource =>
  (ANIME_RESOURCES as readonly string[]).includes(value);

const readInt = (value: string | null, fallback: number, min: number, max: number) => {
  if (value === null || value.trim() === "") {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
};

export const readPage = (value: string | null, fallback = 1) => readInt(value, fallback, 1, MAX_PAGE);

export const readLimit = (value: string | null, fallback: number) => readInt(value, fallback, 1, MAX_LIMIT);

/** Genre labels are free-form upstream, so they are length- and charset-capped. */
export const readGenre = (value: string | null): string | undefined => {
  if (!value) {
    return undefined;
  }
  const genre = value.trim().slice(0, 40);
  return /^[a-zA-Z0-9 '&-]+$/.test(genre) ? genre : undefined;
};

export const readFormat = (value: string | null): string | undefined => {
  if (!value) {
    return undefined;
  }
  const format = value.trim().toUpperCase();
  return (ANIME_FORMATS as readonly string[]).includes(format) ? format : undefined;
};

export const readTopRange = (value: string | null): AnimeTopRange =>
  (ANIME_TOP_RANGES as readonly string[]).includes(value ?? "") ? (value as AnimeTopRange) : "week";

export const readQuery = (value: string | null): string | null => {
  const query = (value ?? "").trim();
  if (query.length < MIN_QUERY_LENGTH || query.length > MAX_QUERY_LENGTH) {
    return null;
  }
  return query;
};

export const readAnimeId = (value: string | null): string | null => normalizeAnimeId(value);

export type AnimeSearchRequest = {
  resource: AnimeResource;
  query: string;
  page: number;
  limit: number;
  genre?: string;
  format?: string;
  range: AnimeTopRange;
  id: string | null;
};

export type AnimeRequestResult =
  | { ok: true; request: AnimeSearchRequest }
  | { ok: false; status: number; message: string };

const DEFAULT_LIMIT_BY_RESOURCE: Record<AnimeResource, number> = {
  status: 1,
  search: 24,
  title: 1,
  series: 1,
  episodes: 100,
  recent: 24,
  schedule: 50,
  top: 24,
};

/**
 * Validates an incoming `/api/anime` query string. Any identifier that does not
 * parse is rejected here rather than forwarded upstream.
 */
export const validateAnimeRequest = (searchParams: URLSearchParams): AnimeRequestResult => {
  const resource = searchParams.get("resource") ?? "top";
  if (!isAnimeResource(resource)) {
    return { ok: false, status: 400, message: "Unsupported anime resource." };
  }

  const page = readPage(searchParams.get("page"));
  const limit = readLimit(searchParams.get("limit"), DEFAULT_LIMIT_BY_RESOURCE[resource]);
  const range = readTopRange(searchParams.get("range"));
  const genre = readGenre(searchParams.get("genre"));
  const format = readFormat(searchParams.get("format"));
  const rawQuery = searchParams.get("query");

  const request: AnimeSearchRequest = { resource, query: "", page, limit, range, id: null };
  if (genre) {
    request.genre = genre;
  }
  if (format) {
    request.format = format;
  }

  if (resource === "search") {
    const query = readQuery(rawQuery);
    if (!query) {
      return {
        ok: false,
        status: 400,
        message: `Enter between ${MIN_QUERY_LENGTH} and ${MAX_QUERY_LENGTH} characters to search anime.`,
      };
    }
    request.query = query;
  }

  if (resource === "title" || resource === "series" || resource === "episodes") {
    const id = readAnimeId(searchParams.get("id"));
    if (!id) {
      return { ok: false, status: 400, message: "A valid AniList or MyAnimeList id is required." };
    }
    request.id = id;
  }

  return { ok: true, request };
};
