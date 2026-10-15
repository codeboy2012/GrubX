import "server-only";

import { mangadexProvider } from "@/lib/manga/mangadex";
import type { MangaProvider } from "@/lib/manga/provider";
import type { MangaListQuery } from "@/types/manga";

/**
 * Single point of provider selection. Swap `mangadexProvider` for another
 * implementation of `MangaProvider` to change the data source without touching
 * any UI code.
 */
export const getMangaProvider = (): MangaProvider => mangadexProvider;

export const getMangaStatus = () => getMangaProvider().status();

export const getServerMangaTags = () => getMangaProvider().tags();

export const getServerMangaList = (query: MangaListQuery) => getMangaProvider().list(query);

export const getServerMangaDetails = (id: string) => getMangaProvider().details(id);

export const getServerMangaChapters = (id: string, language = "en") =>
  getMangaProvider().chapters(id, language);

export const getServerMangaChapterPages = (chapterId: string) =>
  getMangaProvider().chapterPages(chapterId);
