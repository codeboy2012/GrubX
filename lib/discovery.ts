import type { AnimeTitle } from "@/types/anime";
import type { MediaItem, MediaType, SearchTarget } from "@/types/media";
import type { MangaSummary } from "@/types/manga";
import type { EpgChannel, LiveMatch } from "@/types/live";

/**
 * Pure discovery/search helpers — no I/O. Everything here is unit-tested:
 * title normalization, cross-source deduplication, filter math, and history
 * privacy. The search page composes these with provider clients so behavior
 * stays consistent even as providers change.
 */

const foldTitle = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// Articles and filler that must not break deduplication ("The Office" vs "Office").
const TITLE_NOISE = new Set(["the", "a", "an", "movie", "show", "series", "season", "official"]);

const significantTokens = (value: string): string[] =>
  foldTitle(value)
    .split(" ")
    .filter((token) => token.length > 1 || /\d/.test(token))
    .filter((token) => !TITLE_NOISE.has(token));

/** Same title when their significant token sets match (order-insensitive). */
export const titlesMatch = (left: string, right: string): boolean => {
  const leftTokens = significantTokens(left);
  const rightTokens = significantTokens(right);
  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return foldTitle(left) === foldTitle(right);
  }
  if (leftTokens.length !== rightTokens.length) {
    return false;
  }
  return leftTokens.every((token, index) => token === rightTokens[index]);
};

/** Stable identity for a searchable item across all providers. */
export type SearchResultKind = MediaType | "live";

export type SearchKind = SearchTarget | "live";

export type UnifiedResult = {
  id: string;
  kind: SearchResultKind;
  title: string;
  detail: string | null;
  year: number | null;
  posterUrl: string | null;
  route: string;
  // Provider metadata for chips and provenance display.
  provider: "TMDB" | "Ani.pm" | "MangaDex" | "streamed.pk";
  genres: string[];
};

export const animeToResult = (anime: AnimeTitle): UnifiedResult => ({
  id: `anime:${anime.anilistId}`,
  kind: "anime",
  title: anime.title,
  detail: anime.format ?? null,
  year: anime.year ? Math.trunc(anime.year) : null,
  posterUrl: anime.posterUrl,
  route: `/anime/${anime.anilistId}`,
  provider: "Ani.pm",
  genres: anime.genres,
});

export const mangaToResult = (manga: MangaSummary): UnifiedResult => ({
  id: `manga:${manga.id}`,
  kind: "manga",
  title: manga.title,
  detail: manga.status ? `Manga · ${manga.status}` : "Manga",
  year: manga.year ?? null,
  posterUrl: manga.coverUrl,
  route: `/manga/${manga.id}`,
  provider: "MangaDex",
  genres: manga.tags.map((tag) => tag.name),
});

export const tmdbToResult = (item: MediaItem): UnifiedResult => ({
  id: `${item.mediaType}:${item.id}`,
  kind: item.mediaType,
  title: item.title,
  detail: item.mediaType === "movie" ? "Movie" : "TV series",
  year: item.releaseDate ? Number.parseInt(item.releaseDate.slice(0, 4), 10) || null : null,
  posterUrl: item.posterPath,
  route: `/title/${item.mediaType}/${item.id}`,
  provider: "TMDB",
  genres: item.genreIds.map(String),
});

export const liveToResult = (match: LiveMatch): UnifiedResult => ({
  id: `live:${match.id}`,
  kind: "live",
  title: match.title,
  detail: match.category,
  year: new Date(match.date).getFullYear(),
  posterUrl: null,
  route: `/live`,
  provider: "streamed.pk",
  genres: [match.category],
});

/** Live channels/programs whose titles match a query (provider data only). */
export const matchLiveChannels = (channels: EpgChannel[], query: string): UnifiedResult[] => {
  const needle = foldTitle(query);
  if (needle.length < 2) {
    return [];
  }
  const found: UnifiedResult[] = [];
  channels.forEach((channel) => {
    channel.programs.forEach((program) => {
      if (
        foldTitle(program.title).includes(needle) ||
        foldTitle(channel.name).includes(needle) ||
        significantTokens(program.title).every((token) => foldTitle(query).includes(token))
      ) {
        found.push({
          id: `live:${program.id}`,
          kind: "live",
          title: program.title,
          detail: `${channel.name} · ${channel.category}`,
          year: new Date(program.startAt).getFullYear(),
          posterUrl: null,
          route: channel.currentIndex >= 0 || programStateIsLive(program) ? "/live" : "/live/guide",
          provider: "streamed.pk",
          genres: [channel.category],
        });
      }
    });
  });
  return found;
};

const programStateIsLive = (program: { startAt: number; endAt: number }) =>
  program.startAt <= Date.now() && Date.now() < program.endAt;

/**
 * Cross-source deduplication. Anime and live ids are namespaced, so only
 * TMDB movie/tv (which can share a title with each other only when the
 * provider returns a duplicate row) and anime-vs-anime duplicates remain.
 * An anime and a live match with the same name are different works; they are
 * never merged.
 */
export const dedupeResults = (results: UnifiedResult[]): UnifiedResult[] => {
  const byId = new Map<string, UnifiedResult>();
  const tmdbByTitle: UnifiedResult[] = [];

  results.forEach((result) => {
    if (byId.has(result.id)) {
      return;
    }
    if (result.kind === "movie" || result.kind === "tv") {
      const duplicate = tmdbByTitle.find(
        (candidate) =>
          candidate.kind === result.kind &&
          titlesMatch(candidate.title, result.title) &&
          (candidate.year ?? null) === (result.year ?? null),
      );
      if (duplicate) {
        return;
      }
      tmdbByTitle.push(result);
    }
    byId.set(result.id, result);
  });

  return Array.from(byId.values());
};

export type SearchFilters = {
  kind: SearchKind;
  yearFrom: number | null;
  yearTo: number | null;
  genre: string | null;
};

export const EMPTY_SEARCH_FILTERS: SearchFilters = {
  kind: "all",
  yearFrom: null,
  yearTo: null,
  genre: null,
};

export const filtersActive = (filters: SearchFilters) =>
  filters.kind !== "all" || filters.yearFrom !== null || filters.yearTo !== null || filters.genre !== null;

/** Filters apply to TMDB-derived values; other kinds only respect kind + year. */
export const applySearchFilters = (results: UnifiedResult[], filters: SearchFilters): UnifiedResult[] =>
  results.filter((result) => {
    if (filters.kind !== "all" && result.kind !== filters.kind) {
      return false;
    }
    const year = result.year ?? null;
    if (filters.yearFrom !== null && (year === null || year < filters.yearFrom)) {
      return false;
    }
    if (filters.yearTo !== null && (year === null || year > filters.yearTo)) {
      return false;
    }
    if (filters.genre !== null) {
      const needle = foldTitle(filters.genre);
      if (!result.genres.some((genre) => foldTitle(genre).includes(needle))) {
        return false;
      }
    }
    return true;
  });

export const GROUP_LABELS: Record<SearchResultKind, string> = {
  movie: "Movies",
  tv: "TV Shows",
  anime: "Anime",
  manga: "Manga",
  live: "Live & Sports",
};

/**
 * Group results into labeled sections for clear scanning, preserving
 * relevance order within each group. Empty groups are omitted.
 */
export const groupResults = (results: UnifiedResult[]): Array<[SearchResultKind, UnifiedResult[]]> => {
  const groups = new Map<SearchResultKind, UnifiedResult[]>();
  results.forEach((result) => {
    groups.set(result.kind, [...(groups.get(result.kind) ?? []), result]);
  });
  return Array.from(groups.entries()).filter(([, items]) => items.length > 0);
};

// ---------------------------------------------------------------------------
// Search history with privacy controls
// ---------------------------------------------------------------------------

export const HISTORY_MAX_ITEMS = 12;

export const pushSearchHistory = (history: string[], query: string): string[] => {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return history;
  }
  const next = [trimmed, ...history.filter((entry) => entry !== trimmed)];
  return next.slice(0, HISTORY_MAX_ITEMS);
};

export const SEARCH_HISTORY_KEY = "grubx_search_history";

export const readSearchHistory = (): string[] => {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(SEARCH_HISTORY_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string").slice(0, HISTORY_MAX_ITEMS) : [];
  } catch {
    return [];
  }
};

export const writeSearchHistory = (history: string[]) => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
  // Reuse the app-wide storage event so hooks/screens refresh consistently.
  window.dispatchEvent(new CustomEvent("grubx:storage", { detail: { key: SEARCH_HISTORY_KEY } }));
};

export const clearSearchHistory = () => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(SEARCH_HISTORY_KEY);
  window.dispatchEvent(new CustomEvent("grubx:storage", { detail: { key: SEARCH_HISTORY_KEY } }));
};

export const SEARCH_HISTORY_ENABLED_KEY = "grubx_search_history_enabled";

export const readHistoryEnabled = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }
  // Private by default: history only turns on when the user asks for it.
  try {
    return window.localStorage.getItem(SEARCH_HISTORY_ENABLED_KEY) === "true";
  } catch {
    return false;
  }
};

export const writeHistoryEnabled = (enabled: boolean) => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(SEARCH_HISTORY_ENABLED_KEY, enabled ? "true" : "false");
  if (!enabled) {
    clearSearchHistory();
  }
  window.dispatchEvent(new CustomEvent("grubx:storage", { detail: { key: SEARCH_HISTORY_ENABLED_KEY } }));
};

/** Keyboard-agnostic result slide math for TV remotes (left/right paging). */
export const slideWindow = (items: UnifiedResult[], start: number, size: number): UnifiedResult[] => {
  if (items.length === 0) {
    return [];
  }
  const normalized = Math.max(0, Math.min(start, Math.floor((items.length - 1) / size) * size));
  return items.slice(normalized, normalized + size);
};
