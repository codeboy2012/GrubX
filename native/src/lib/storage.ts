import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Local-first My List and playback progress for GrubX native.
 *
 * Parity with the web app (`lib/dataLayer.ts`): identical record shapes and the
 * same storage keys, so the concepts match even though AsyncStorage and
 * browser localStorage are separate stores on their own platforms. There is no
 * server sync in GrubX by design — anything here stays on this device.
 */

export type LibraryMediaType = "movie" | "tv" | "anime" | "manga";

export type SavedItem = {
  mediaId: string;
  mediaType: LibraryMediaType;
  title: string;
  coverUrl: string | null;
  rating: number | null;
};

export type Progress = {
  mediaId: string;
  mediaType: LibraryMediaType;
  title: string;
  coverUrl: string | null;
  season: number | null;
  /** Manga only: the id of the chapter being read. */
  chapterId?: string | null;
  episode: number | null;
  currentTime: number;
  duration: number;
  percent: number;
  updatedAt: string;
};

const WATCHLIST_KEY = "grubx_watchlist";
const PROGRESS_KEY = "grubx_progress";

const readJson = async <T>(key: string): Promise<T | null> => {
  try {
    const value = await AsyncStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
};

const writeJson = async (key: string, value: unknown) => {
  await AsyncStorage.setItem(key, JSON.stringify(value));
};

export const library = {
  async list(): Promise<SavedItem[]> {
    const items = await readJson<SavedItem[]>(WATCHLIST_KEY);
    return (items ?? []).filter((item) => Boolean(item.mediaId));
  },

  async isSaved(mediaId: string): Promise<boolean> {
    const items = await this.list();
    return items.some((item) => item.mediaId === mediaId);
  },

  async toggle(item: SavedItem): Promise<boolean> {
    const items = await this.list();
    const index = items.findIndex((entry) => entry.mediaId === item.mediaId);
    if (index >= 0) {
      items.splice(index, 1);
      await writeJson(WATCHLIST_KEY, items);
      return false;
    }
    await writeJson(WATCHLIST_KEY, [{ ...item, }, ...items]);
    return true;
  },

  async progress(): Promise<Progress[]> {
    const items = await readJson<Record<string, Progress>>(PROGRESS_KEY);
    return Object.values(items ?? {})
      .filter((item) => item.percent > 0 && item.percent < 95)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  },

  /** Resume-and-save progress record; malformed values are ignored. */
  async saveProgress(item: Progress): Promise<void> {
    if (!Number.isFinite(item.duration) || item.duration < 30 || !Number.isFinite(item.currentTime)) {
      return;
    }
    if (item.currentTime < 0 || item.currentTime > item.duration) {
      return;
    }

    const all = (await readJson<Record<string, Progress>>(PROGRESS_KEY)) ?? {};
    all[item.mediaId] = item;
    await writeJson(PROGRESS_KEY, all);
  },

  async remove(mediaId: string): Promise<void> {
    const items = await this.list();
    await writeJson(
      WATCHLIST_KEY,
      items.filter((item) => item.mediaId !== mediaId),
    );
  },
};
