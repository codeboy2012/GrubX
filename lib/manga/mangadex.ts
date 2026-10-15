import "server-only";

import type {
  MangaChapter,
  MangaChapterPages,
  MangaDetails,
  MangaListPage,
  MangaListQuery,
  MangaProviderStatus,
  MangaSummary,
  MangaTag,
} from "@/types/manga";
import type { MangaProvider } from "@/lib/manga/provider";
import { readServerEnv } from "@/lib/env";

const DEFAULT_API_BASE = "https://api.mangadex.org";
const UPLOADS_BASE = "https://uploads.mangadex.org";
const USER_AGENT = "GrubX/4.0 (+https://grub.sky0cloud.dpdns.org)";
const DEFAULT_LANGUAGE = "en";

// Content ratings we surface by default. Explicit ("erotica"/"pornographic") is
// intentionally excluded so the reader never serves adult content by accident.
const ALLOWED_CONTENT_RATINGS = ["safe", "suggestive"];

export const getMangaApiBase = () => {
  // The raw value comes from the centralized config module; validation stays
  // here so an unusable base can never be turned into a request.
  const configured = readServerEnv("NEXT_PUBLIC_MANGA_API_BASE");
  const base = configured && configured.length > 0 ? configured : DEFAULT_API_BASE;
  try {
    const parsed = new URL(base);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return DEFAULT_API_BASE;
    }
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return DEFAULT_API_BASE;
  }
};

type MangaDexRecord = {
  id?: string;
  attributes?: Record<string, unknown>;
  relationships?: Array<{ type?: string; attributes?: Record<string, unknown> }>;
};

const readLocalized = (value: unknown, preferred = DEFAULT_LANGUAGE): string => {
  if (typeof value === "string") {
    return value;
  }
  if (!value || typeof value !== "object") {
    return "";
  }
  const record = value as Record<string, unknown>;
  const preferredValue = record[preferred];
  if (typeof preferredValue === "string") {
    return preferredValue;
  }
  const first = Object.values(record).find((entry): entry is string => typeof entry === "string");
  return first ?? "";
};

const mangadexFetch = async <T>(path: string, params: Record<string, string | string[] | number | undefined> = {}): Promise<T> => {
  const url = new URL(`${getMangaApiBase()}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((entry) => url.searchParams.append(key, entry));
      return;
    }
    url.searchParams.set(key, String(value));
  });

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
    cache: "no-store",
    redirect: "error",
  });

  if (!response.ok) {
    throw new Error(`MangaDex request failed: ${response.status} ${path}`);
  }

  return (await response.json()) as T;
};

const coverUrl = (mangaId: string, record: MangaDexRecord): string | null => {
  const cover = record.relationships?.find((relationship) => relationship.type === "cover_art");
  const fileName = cover?.attributes?.fileName;
  if (typeof fileName !== "string" || fileName.length === 0) {
    return null;
  }
  return `${UPLOADS_BASE}/covers/${mangaId}/${fileName}`;
};

const relationshipNames = (record: MangaDexRecord, type: string): string[] =>
  (record.relationships ?? [])
    .filter((relationship) => relationship.type === type)
    .map((relationship) => relationship.attributes?.name)
    .filter((name): name is string => typeof name === "string" && name.length > 0);

const normalizeTags = (value: unknown): MangaTag[] =>
  Array.isArray(value)
    ? value.map((tag) => ({
        id: String((tag as { id?: string }).id ?? ""),
        name: readLocalized((tag as { attributes?: Record<string, unknown> }).attributes?.name),
      }))
    : [];

export const normalizeMangaSummary = (record: MangaDexRecord): MangaSummary => {
  const attributes = record.attributes ?? {};
  const id = String(record.id ?? "");
  const authors = relationshipNames(record, "author");

  return {
    id,
    title: readLocalized(attributes.title) || "Untitled",
    description: readLocalized(attributes.description),
    coverUrl: coverUrl(id, record),
    status: typeof attributes.status === "string" ? attributes.status : null,
    year: typeof attributes.year === "number" ? attributes.year : null,
    contentRating: typeof attributes.contentRating === "string" ? attributes.contentRating : null,
    tags: normalizeTags(attributes.tags),
    authorName: authors[0] ?? relationshipNames(record, "artist")[0] ?? null,
    lastChapter: typeof attributes.lastChapter === "string" ? attributes.lastChapter : null,
    updatedAt: typeof attributes.updatedAt === "string" ? attributes.updatedAt : null,
    availableLanguages: Array.isArray(attributes.availableTranslatedLanguages)
      ? attributes.availableTranslatedLanguages.filter((entry): entry is string => typeof entry === "string")
      : [],
  };
};

const normalizeChapter = (record: MangaDexRecord): MangaChapter | null => {
  const attributes = record.attributes ?? {};
  if (typeof attributes.externalUrl === "string" && attributes.externalUrl.length > 0) {
    return null;
  }

  return {
    id: String(record.id ?? ""),
    chapter: typeof attributes.chapter === "string" ? attributes.chapter : null,
    volume: typeof attributes.volume === "string" ? attributes.volume : null,
    title: typeof attributes.title === "string" && attributes.title.length > 0 ? attributes.title : null,
    language: typeof attributes.translatedLanguage === "string" ? attributes.translatedLanguage : DEFAULT_LANGUAGE,
    pages: typeof attributes.pages === "number" ? attributes.pages : 0,
    publishAt: typeof attributes.publishAt === "string" ? attributes.publishAt : null,
  };
};

export const mangadexProvider: MangaProvider = {
  id: "mangadex",
  label: "MangaDex",
  requiresKey: false,

  isConfigured() {
    return true;
  },

  status(): MangaProviderStatus {
    return {
      provider: "mangadex",
      label: "MangaDex",
      configured: true,
      requiresKey: false,
      notes:
        "MangaDex public read API. No API key required. Manga pages are served from MangaDex's own CDN and are never rehosted by GrubX.",
    };
  },

  async tags() {
    const payload = await mangadexFetch<{ data?: MangaDexRecord[] }>("/manga/tag");
    return (payload.data ?? [])
      .map((record) => ({ id: String(record.id ?? ""), name: readLocalized(record.attributes?.name) }))
      .filter((tag) => tag.id.length > 0 && tag.name.length > 0)
      .sort((left, right) => left.name.localeCompare(right.name));
  },

  async list(query: MangaListQuery): Promise<MangaListPage> {
    const limit = Math.min(60, Math.max(1, query.limit ?? 24));
    const offset = Math.max(0, query.offset ?? 0);
    const params: Record<string, string | string[] | number | undefined> = {
      limit,
      offset,
      "includes[]": ["cover_art", "author"],
      "contentRating[]": ALLOWED_CONTENT_RATINGS,
      "order[followedCount]": "desc",
    };

    if (query.kind === "recent") {
      params["order[latestUploadedChapter]"] = "desc";
      params["availableTranslatedLanguage[]"] = query.language || DEFAULT_LANGUAGE;
      params.hasAvailableChapters = "true";
      delete params["order[followedCount]"];
    } else if (query.kind === "search") {
      params.title = query.query?.trim();
      delete params["order[followedCount]"];
    } else if (query.kind === "tag") {
      params["includedTags[]"] = query.tag ? [query.tag] : [];
      params.hasAvailableChapters = "true";
    }

    const payload = await mangadexFetch<{ data?: MangaDexRecord[]; total?: number }>("/manga", params);
    return {
      items: (payload.data ?? []).map(normalizeMangaSummary).filter((item) => item.id.length > 0),
      limit,
      offset,
      total: typeof payload.total === "number" ? payload.total : 0,
    };
  },

  async details(id: string): Promise<MangaDetails | null> {
    const payload = await mangadexFetch<{ data?: MangaDexRecord }>(`/manga/${encodeURIComponent(id)}`, {
      "includes[]": ["cover_art", "author", "artist"],
    });
    if (!payload.data) {
      return null;
    }
    const summary = normalizeMangaSummary(payload.data);
    return {
      ...summary,
      authors: relationshipNames(payload.data, "author"),
      artists: relationshipNames(payload.data, "artist"),
    };
  },

  async chapters(id: string, language: string): Promise<MangaChapter[]> {
    const payload = await mangadexFetch<{ data?: MangaDexRecord[] }>(`/manga/${encodeURIComponent(id)}/feed`, {
      limit: 500,
      "translatedLanguage[]": language || DEFAULT_LANGUAGE,
      "order[volume]": "asc",
      "order[chapter]": "asc",
      includeExternalUrl: 0,
    });

    return (payload.data ?? [])
      .map(normalizeChapter)
      .filter((chapter): chapter is MangaChapter => Boolean(chapter))
      .filter((chapter) => chapter.pages > 0);
  },

  async chapterPages(chapterId: string): Promise<MangaChapterPages> {
    const payload = await mangadexFetch<{
      baseUrl?: string;
      chapter?: { hash?: string; data?: string[]; dataSaver?: string[] };
    }>(`/at-home/server/${encodeURIComponent(chapterId)}`);

    return {
      chapterId,
      baseUrl: String(payload.baseUrl ?? ""),
      hash: String(payload.chapter?.hash ?? ""),
      data: Array.isArray(payload.chapter?.data) ? payload.chapter!.data.filter((entry) => typeof entry === "string") : [],
      dataSaver: Array.isArray(payload.chapter?.dataSaver)
        ? payload.chapter!.dataSaver.filter((entry) => typeof entry === "string")
        : [],
    };
  },
};
