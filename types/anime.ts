export type AnimeProviderId = "anipm";

export type AnimeLanguage = "sub" | "dub";

export type AnimeEmbedLanguage = AnimeLanguage | "vostfr";

export type AnimeTopRange = "today" | "week" | "month" | "all";

/** Per-episode version availability exactly as the catalogue reports it. */
export type AnimeAvailability = {
  sub: boolean;
  dub: boolean;
  subHard: boolean;
  dubHard: boolean;
};

export type AnimeEpisode = {
  number: number;
  title: string | null;
  runtimeSeconds: number | null;
  aired: string | null;
  thumbnail: string | null;
  available: AnimeAvailability;
  /** Ready-to-use embed URLs supplied by the provider, when present. */
  embed: { sub: string | null; dub: string | null } | null;
};

export type AnimeTitle = {
  anilistId: number;
  malId: number | null;
  title: string;
  nativeTitle: string | null;
  format: string | null;
  status: string | null;
  year: number | null;
  season: string | null;
  score: number | null;
  rating: string | null;
  durationMinutes: number | null;
  episodeCounts: { total: number; sub: number; dub: number };
  genres: string[];
  studios: string[];
  adult: boolean;
  synopsis: string;
  posterUrl: string | null;
  bannerUrl: string | null;
  siteUrl: string | null;
  embedUrl: string | null;
};

export type AnimeSeries = AnimeTitle & {
  episodes: AnimeEpisode[];
};

export type AnimeSearchPage = {
  items: AnimeTitle[];
  page: number;
  limit: number;
  total: number | null;
  hasMore: boolean;
};

export type AnimeRecentEpisode = {
  anilistId: number;
  title: string;
  posterUrl: string | null;
  episode: number;
  episodeTitle: string | null;
  available: { sub: boolean; dub: boolean };
  addedAt: string | null;
  runtimeSeconds: number | null;
  embedUrl: string | null;
};

export type AnimeScheduleEntry = {
  anilistId: number;
  title: string;
  episode: number;
  kind: AnimeLanguage;
  airingAt: string | null;
  final: boolean;
  delayed: boolean;
  onProvider: boolean;
  adult: boolean;
  embedUrl: string | null;
};

export type AnimeProviderStatus = {
  provider: AnimeProviderId;
  label: string;
  configured: boolean;
  requiresKey: boolean;
  notes: string;
};
