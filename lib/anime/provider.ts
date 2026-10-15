import type {
  AnimeEpisode,
  AnimeProviderId,
  AnimeProviderStatus,
  AnimeRecentEpisode,
  AnimeScheduleEntry,
  AnimeSearchPage,
  AnimeSeries,
  AnimeTitle,
  AnimeTopRange,
} from "@/types/anime";

export type AnimeSearchQuery = {
  query: string;
  page?: number;
  limit?: number;
};

export type AnimeTopQuery = {
  range: AnimeTopRange;
  genre?: string;
  format?: string;
  limit?: number;
};

export type AnimeRecentQuery = {
  page?: number;
  limit?: number;
};

/**
 * An anime catalogue source. The UI only ever reaches it through `/api/anime`,
 * so the concrete backend (Ani.pm today) can be replaced without touching a
 * component.
 */
export interface AnimeProvider {
  id: AnimeProviderId;
  label: string;
  requiresKey: boolean;
  status(): AnimeProviderStatus;
  search(query: AnimeSearchQuery): Promise<AnimeSearchPage>;
  title(id: string): Promise<AnimeTitle | null>;
  series(id: string): Promise<AnimeSeries | null>;
  episodes(id: string): Promise<AnimeEpisode[]>;
  recent(query: AnimeRecentQuery): Promise<AnimeRecentEpisode[]>;
  schedule(): Promise<AnimeScheduleEntry[]>;
  top(query: AnimeTopQuery): Promise<AnimeTitle[]>;
}
