/** Metadata sources that only know films and series (TMDB). */
export type TmdbMediaType = "movie" | "tv";

/**
 * Application-level content types. `anime` and `manga` come from their own
 * providers, so they carry their own identifiers and must never be sent to a
 * TMDB endpoint or assumed interchangeable with a TMDB id.
 */
export type MediaType = TmdbMediaType | "anime" | "manga";
export type SearchTarget = "all" | MediaType;
/** Discoverable surface for unified search; live programming is included. */
export type DiscoveryKind = MediaType | "live";

export const isTmdbMediaType = (value: string): value is TmdbMediaType => value === "movie" || value === "tv";

export type Genre = {
  id: number;
  name: string;
};

export type MediaItem = {
  id: string;
  tmdbId: number;
  title: string;
  mediaType: MediaType;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate: string | null;
  rating: number | null;
  voteCount: number | null;
  genreIds: number[];
};

export type CastMember = {
  name: string;
  character: string;
  profilePath: string | null;
};

export type SeasonSummary = {
  seasonNumber: number;
  name: string;
  episodeCount: number;
  posterPath: string | null;
};

export type EpisodeSummary = {
  episodeNumber: number;
  name: string;
  overview: string;
  stillPath: string | null;
  airDate: string | null;
  runtime: number | null;
};

export type TrailerResult = {
  id: string;
  key: string;
  name: string;
  site: "YouTube";
  type: "Trailer";
  embedUrl: string;
  thumbnailUrl: string;
};

export type MediaDetails = MediaItem & {
  runtime: number | null;
  status: string | null;
  tagline: string | null;
  genres: Genre[];
  trailer: TrailerResult | null;
  cast: CastMember[];
  seasons: SeasonSummary[];
  totalSeasons: number | null;
};

export type MediaPage = {
  page: number;
  totalPages: number;
  totalResults?: number;
  results: MediaItem[];
};
