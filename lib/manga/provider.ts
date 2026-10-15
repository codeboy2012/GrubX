import type {
  MangaChapter,
  MangaChapterPages,
  MangaDetails,
  MangaListPage,
  MangaListQuery,
  MangaProviderId,
  MangaProviderStatus,
  MangaSummary,
  MangaTag,
} from "@/types/manga";

/**
 * A manga data source. The UI only ever talks to this interface through the
 * server route, so the concrete backend (MangaDex today) can be replaced
 * without touching any component.
 */
export interface MangaProvider {
  id: MangaProviderId;
  label: string;
  requiresKey: boolean;
  isConfigured(): boolean;
  status(): MangaProviderStatus;
  tags(): Promise<MangaTag[]>;
  list(query: MangaListQuery): Promise<MangaListPage>;
  details(id: string): Promise<MangaDetails | null>;
  chapters(id: string, language: string): Promise<MangaChapter[]>;
  chapterPages(chapterId: string): Promise<MangaChapterPages>;
}

export type { MangaSummary };
