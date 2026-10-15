import "server-only";

import { anipmProvider } from "@/lib/anime/anipm";
import type { AnimeProvider, AnimeRecentQuery, AnimeSearchQuery, AnimeTopQuery } from "@/lib/anime/provider";

/**
 * Single point of provider selection. Swap `anipmProvider` for another
 * implementation of `AnimeProvider` to change the anime catalogue source
 * without touching any UI code.
 */
export const getAnimeProvider = (): AnimeProvider => anipmProvider;

export const getAnimeStatus = () => getAnimeProvider().status();

export const getServerAnimeSearch = (query: AnimeSearchQuery) => getAnimeProvider().search(query);

export const getServerAnimeTitle = (id: string) => getAnimeProvider().title(id);

export const getServerAnimeSeries = (id: string) => getAnimeProvider().series(id);

export const getServerAnimeEpisodes = (id: string) => getAnimeProvider().episodes(id);

export const getServerAnimeRecent = (query: AnimeRecentQuery) => getAnimeProvider().recent(query);

export const getServerAnimeSchedule = () => getAnimeProvider().schedule();

export const getServerAnimeTop = (query: AnimeTopQuery) => getAnimeProvider().top(query);
