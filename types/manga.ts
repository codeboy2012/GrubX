export type MangaProviderId = "mangadex";

export type MangaTag = {
  id: string;
  name: string;
};

export type MangaSummary = {
  id: string;
  title: string;
  description: string;
  coverUrl: string | null;
  status: string | null;
  year: number | null;
  contentRating: string | null;
  tags: MangaTag[];
  authorName: string | null;
  lastChapter: string | null;
  updatedAt: string | null;
  availableLanguages: string[];
};

export type MangaDetails = MangaSummary & {
  authors: string[];
  artists: string[];
};

export type MangaChapter = {
  id: string;
  chapter: string | null;
  volume: string | null;
  title: string | null;
  language: string;
  pages: number;
  publishAt: string | null;
};

export type MangaChapterPages = {
  chapterId: string;
  baseUrl: string;
  hash: string;
  data: string[];
  dataSaver: string[];
};

export type MangaListKind = "popular" | "recent" | "search" | "tag";

export type MangaListQuery = {
  kind: MangaListKind;
  query?: string;
  tag?: string;
  language?: string;
  limit?: number;
  offset?: number;
};

export type MangaListPage = {
  items: MangaSummary[];
  limit: number;
  offset: number;
  total: number;
};

export type MangaProviderStatus = {
  provider: MangaProviderId;
  label: string;
  configured: boolean;
  requiresKey: boolean;
  notes: string;
};
