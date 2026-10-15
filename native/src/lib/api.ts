import type {
  AnimeRecentEpisode,
  AnimeSearchPage,
  AnimeSeries,
  AnimeTitle,
  LiveMatch,
  LiveSource,
  LiveStream,
  MangaChapter,
  MangaChapterPages,
  MangaDetails,
  MangaListKind,
  MangaListPage,
  MangaProviderStatus,
  MediaDetails,
  MediaPage,
  TmdbMediaType,
} from "./types";
import { getCacheOutcome, isCacheablePath, recordOutcome, withOfflineCache } from "./offlineCache";

/**
 * GrubX API client for the Expo (phone / TV / web-export) apps.
 *
 * The Next.js deployment is the single source of business logic: this client
 * only calls its existing routes (`/api/tmdb`, `/api/anime`, `/api/manga`,
 * `/api/live/*`, `/api/player/resolve`). The API base comes from
 * `EXPO_PUBLIC_API_BASE` at bundle time (set it to https://grub.<domain> for
 * released builds, or http://<LAN-IP>:3000 while developing against `pnpm dev`).
 */

const DEV_FALLBACK = "http://grub.sky0cloud.dpdns.org";

const trimSlash = (value: string) => value.replace(/\/+$/, "");

export const API_BASE = trimSlash(process.env.EXPO_PUBLIC_API_BASE || DEV_FALLBACK);

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const REQUEST_TIMEOUT_MS = 12_000;

/**
 * GET wrapper with the offline catalogue cache.
 *
 * Cacheable paths (see lib/offlineCache.ts) transparently fall back to the
 * last good response when the network fails; their staleness is recorded and
 * readable via `getCacheOutcome(path)`. Non-cacheable paths (player/resolve)
 * do not touch the cache at all.
 */
const cacheKeyFor = (path: string) => `/api/${path.split("/")[1] ?? ""}`.replace(/\?.*$/, "");

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  if (!isCacheablePath(path)) {
    return requestRaw<T>(path, init);
  }
  const outcome = await withOfflineCache(path, () => requestRaw<T>(path, init));
  recordOutcome(path, outcome);
  return outcome.data;
};

/** Staleness marker of the last read of `path`, when served from cache. */
export const cacheOutcomeFor = getCacheOutcome;

const requestRaw = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: { Accept: "application/json", ...(init?.headers ?? {}) },
  });

  if (!response.ok) {
    let message = `Request failed with ${response.status}`;
    try {
      const body = (await response.json()) as { error?: unknown };
      if (typeof body?.error === "string") {
        message = body.error;
      }
    } catch {
      // A non-JSON error body falls back to the status-code message above.
    }
    throw new ApiError(message, response.status);
  }

  return (await response.json()) as T;
};

const tmdb = (path: string, params: Record<string, string | number | undefined> = {}) => {
  const search = new URLSearchParams({ path });
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  });
  return request<Record<string, unknown>>(`/api/tmdb?${search.toString()}`);
};

export const api = {
  /** Trending hero rows (movies + series mixed by the server). */
  async trending(): Promise<MediaPage> {
    const payload = await tmdb("/trending/all/day");
    return payload as unknown as MediaPage;
  },

  async list(mediaType: "movie" | "tv", category: "popular" | "top_rated", page = 1): Promise<MediaPage> {
    const payload = await tmdb(`/${mediaType}/${category}`, { page });
    return payload as unknown as MediaPage;
  },

  async search(mediaType: TmdbMediaType, query: string, page = 1): Promise<MediaPage> {
    const payload = await tmdb(`/search/${mediaType}`, { query, page });
    return payload as unknown as MediaPage;
  },

  async details(mediaType: TmdbMediaType, id: string): Promise<MediaDetails> {
    const payload = await tmdb(`/${mediaType}/${id}`, { append_to_response: "videos,credits" });
    return payload as unknown as MediaDetails;
  },

  /** Playback server selection; returns the GrubX embed page path to open. */
  async resolveEmbed(mediaType: "movie" | "tv", mediaId: string, season = 1, episode = 1): Promise<string | null> {
    const params = new URLSearchParams({
      mediaType,
      mediaId: String(mediaId),
      season: String(season),
      episode: String(episode),
      autoplayNextEpisode: "true",
    });
    const payload = await request<{ selected?: { embedPath?: string } | null }>(`/api/player/resolve?${params}`);
    return payload.selected?.embedPath ?? null;
  },

  async animeTop(range: "today" | "week" | "month" | "all", limit = 24): Promise<AnimeTitle[]> {
    const params = new URLSearchParams({ resource: "top", range, limit: String(limit) });
    const payload = await request<{ data?: AnimeTitle[] }>(`/api/anime?${params}`);
    return payload.data ?? [];
  },

  async animeRecent(limit = 24): Promise<AnimeRecentEpisode[]> {
    return request<AnimeRecentEpisode[]>(`/api/anime?${new URLSearchParams({ resource: "recent", limit: String(limit) })}`);
  },

  async animeSeries(id: string): Promise<AnimeSeries> {
    return request<AnimeSeries>(`/api/anime?${new URLSearchParams({ resource: "series", id })}`);
  },

  async animeSearch(query: string, limit = 24): Promise<AnimeSearchPage> {
    return request<AnimeSearchPage>(
      `/api/anime?${new URLSearchParams({ resource: "search", query, limit: String(limit) })}`,
    );
  },

  async mangaStatus(): Promise<MangaProviderStatus> {
    return request<MangaProviderStatus>("/api/manga?resource=status");
  },

  async mangaList(kind: MangaListKind, options: { query?: string; tag?: string; limit?: number } = {}): Promise<MangaListPage> {
    const params = new URLSearchParams({ resource: "list", kind, limit: String(options.limit ?? 24) });
    if (options.query) {
      params.set("query", options.query);
    }
    if (options.tag) {
      params.set("tag", options.tag);
    }
    return request<MangaListPage>(`/api/manga?${params}`);
  },

  async mangaDetails(id: string): Promise<MangaDetails> {
    return request<MangaDetails>(`/api/manga?${new URLSearchParams({ resource: "details", id })}`);
  },

  async mangaChapters(id: string, language = "en"): Promise<MangaChapter[]> {
    return request<MangaChapter[]>(
      `/api/manga?${new URLSearchParams({ resource: "chapters", id, language })}`,
    );
  },

  async mangaPages(chapterId: string): Promise<MangaChapterPages> {
    return request<MangaChapterPages>(`/api/manga?${new URLSearchParams({ resource: "pages", chapterId })}`);
  },

  async liveMatches(scope: "live" | "all-today", popular = false): Promise<LiveMatch[]> {
    const params = new URLSearchParams({ scope });
    if (popular) {
      params.set("popular", "true");
    }
    return request<LiveMatch[]>(`/api/live/matches?${params}`);
  },

  async liveStreams(source: LiveSource): Promise<LiveStream[]> {
    return request<LiveStream[]>(
      `/api/live/streams?${new URLSearchParams({ source: source.source, id: source.id })}`,
    );
  },
};

/** Absolute URL to open inside a WebView (GrubX embed page / provider page). */
export const absoluteUrl = (pathOrUrl: string) => (/^https?:\/\//i.test(pathOrUrl) ? pathOrUrl : `${API_BASE}${pathOrUrl}`);

/** Player page for movies and series on the current GrubX deployment. */
export const movieEmbedUrl = (mediaId: string) => absoluteUrl(`/embed/movie/vidking/${mediaId}`);

export const showEmbedUrl = (mediaId: string, season: number, episode: number) =>
  absoluteUrl(`/embed/tv/vidking/${mediaId}/${season}/${episode}`);
