/**
 * GrubX native data contracts.
 *
 * Mirrors the shapes served by the GrubX web API layer (`../types/*.ts`):
 * `/api/tmdb`, `/api/anime`, `/api/manga`, `/api/live/*`. Keep this file in
 * sync with those sources — the HTTP API is the shared business boundary, and
 * these are its response shapes.
 */

// ---------------- Movies & TV (TMDB via /api/tmdb) ----------------

export type TmdbMediaType = "movie" | "tv";

export type MediaItem = {
  id: string;
  mediaType: TmdbMediaType;
  title: string;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate: string | null;
  rating: number | null;
  genreIds?: number[];
};

export type MediaGenre = { id: number; name: string };

export type MediaDetails = {
  id: string;
  mediaType: TmdbMediaType;
  title: string;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate: string | null;
  rating: number | null;
  runtime: number | null;
  status: string | null;
  tagline: string | null;
  genres: MediaGenre[];
  seasons: { seasonNumber: number; name: string; episodeCount: number }[];
};

export type MediaPage = { page: number; totalResults?: number; totalPages?: number; results: MediaItem[] };

// ---------------- Anime (Ani.pm via /api/anime) ----------------

export type AnimeLanguage = "sub" | "dub";

export type AnimeTitle = {
  anilistId: number;
  malId: number | null;
  title: string;
  format: string | null;
  status: string | null;
  year: number | null;
  score: number | null;
  genres: string[];
  synopsis: string;
  posterUrl: string | null;
  bannerUrl: string | null;
  episodeCounts: { total: number; sub: number; dub: number };
};

export type AnimeEpisode = {
  number: number;
  title: string | null;
  runtimeSeconds: number | null;
  thumbnail: string | null;
  available: { sub: boolean; dub: boolean };
};

export type AnimeSeries = AnimeTitle & { episodes: AnimeEpisode[] };

export type AnimeSearchPage = { items: AnimeTitle[]; page: number; limit: number; hasMore: boolean };

export type AnimeRecentEpisode = {
  anilistId: number;
  title: string;
  posterUrl: string | null;
  episode: number;
  available: { sub: boolean; dub: boolean };
};

// ---------------- Manga (MangaDex via /api/manga) ----------------

export type MangaTag = { id: string; name: string };

export type MangaSummary = {
  id: string;
  title: string;
  description: string;
  coverUrl: string | null;
  status: string | null;
  year: number | null;
  tags: MangaTag[];
  authorName: string | null;
  lastChapter: string | null;
  updatedAt: string | null;
};

export type MangaDetails = MangaSummary & { authors: string[]; artists: string[] };

export type MangaChapter = {
  id: string;
  chapter: string | null;
  volume: string | null;
  title: string | null;
  language: string;
  pages: number;
};

export type MangaChapterPages = {
  chapterId: string;
  baseUrl: string;
  hash: string;
  data: string[];
  dataSaver: string[];
};

export type MangaListKind = "popular" | "recent" | "search" | "tag";

export type MangaListPage = { items: MangaSummary[]; limit: number; offset: number; total: number };

// ---------------- Live TV (/api/live/*) ----------------

export type LiveSource = { source: string; id: string };

export type LiveMatch = {
  id: string;
  title: string;
  category: string;
  date: number;
  poster?: string;
  popular?: boolean;
  teams?: { home?: { badge?: string | null }; away?: { badge?: string | null } };
  sources: LiveSource[];
};

export type LiveStream = {
  streamNo: number;
  source: string;
  embedUrl?: string;
  language?: string;
  hd?: boolean;
};

// ---------------- Provider status ----------------

export type MangaProviderStatus = {
  provider: string;
  label: string;
  configured: boolean;
  requiresKey: boolean;
  notes: string;
  integration?: "native" | "external-only";
  siteUrl?: string | null;
  alternatives?: MangaProviderStatus[];
};
