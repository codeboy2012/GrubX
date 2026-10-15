"use client";

import type {
  MangaChapter,
  MangaChapterPages,
  MangaDetails,
  MangaListPage,
  MangaListQuery,
  MangaProviderStatus,
  MangaTag,
} from "@/types/manga";

const buildUrl = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  });
  return `/api/manga?${search.toString()}`;
};

const fetchJson = async <T>(url: string, signal?: AbortSignal): Promise<T> => {
  const response = await fetch(url, { credentials: "same-origin", signal });
  if (!response.ok) {
    throw new Error(`Manga request failed: ${response.status}`);
  }
  return (await response.json()) as T;
};

export const getClientMangaStatus = (signal?: AbortSignal) =>
  fetchJson<MangaProviderStatus>(buildUrl({ resource: "status" }), signal);

export const getClientMangaTags = (signal?: AbortSignal) =>
  fetchJson<MangaTag[]>(buildUrl({ resource: "tags" }), signal);

export const getClientMangaList = (query: MangaListQuery, signal?: AbortSignal) =>
  fetchJson<MangaListPage>(
    buildUrl({
      resource: "list",
      kind: query.kind,
      query: query.query,
      tag: query.tag,
      language: query.language,
      limit: query.limit,
      offset: query.offset,
    }),
    signal,
  );

export const getClientMangaDetails = (id: string, signal?: AbortSignal) =>
  fetchJson<MangaDetails>(buildUrl({ resource: "details", id }), signal);

export const getClientMangaChapters = (id: string, language = "en", signal?: AbortSignal) =>
  fetchJson<MangaChapter[]>(buildUrl({ resource: "chapters", id, language }), signal);

export const getClientMangaChapterPages = (chapterId: string, signal?: AbortSignal) =>
  fetchJson<MangaChapterPages>(buildUrl({ resource: "pages", chapterId }), signal);
