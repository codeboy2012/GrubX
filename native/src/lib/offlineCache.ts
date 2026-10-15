import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Offline cache for GrubX native API reads.
 *
 * Strategy, mirrored from the web service worker: only public catalogue
 * metadata is cached (TMDB proxy, anime, manga, live guide). Nothing from the
 * player/resolve path, and obviously no media bytes — streams are NOT cached
 * and offline playback is explicitly unsupported by every provider.
 *
 * Staleness is explicit: a cached fallback carries `cachedAt`, so screens can
 * decide to mark data as old instead of pretending it is fresh.
 */

const CACHE_PREFIX = "grubx_cache:";
const MAX_CACHE_AGE_MS = 14 * 24 * 60 * 60 * 1000; // hard purge after 2 weeks
const MAX_ENTRIES = 200;

export type CachedEntry<T> = {
  data: T;
  cachedAt: number;
};

export type ApiReadResult<T> = {
  data: T;
  /** true when the value came from the cache because the network failed. */
  fromCache: boolean;
  /** ms since the cached copy was obtained; undefined when fresh. */
  ageMs?: number;
  /** The network error when a cached copy was served instead. */
  networkError?: string;
};

/** Only catalogue metadata is ever persisted. Add paths here deliberately. */
const CACHEABLE = ["/api/tmdb", "/api/anime", "/api/manga", "/api/live"];

export const isCacheablePath = (path: string) => CACHEABLE.some((base) => path.startsWith(base));

const readJsonAsync = async <T>(key: string): Promise<T | null> => {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

export const readCache = async <T>(path: string): Promise<CachedEntry<T> | null> => {
  const entry = await readJsonAsync<CachedEntry<T>>(`${CACHE_PREFIX}${path}`);
  if (!entry) {
    return null;
  }
  if (typeof entry.cachedAt !== "number" || Date.now() - entry.cachedAt > MAX_CACHE_AGE_MS) {
    await removeCache(path);
    return null;
  }
  return entry;
};

export const writeCache = async <T>(path: string, data: T): Promise<void> => {
  if (!isCacheablePath(path)) {
    return;
  }
  try {
    await AsyncStorage.setItem(CACHE_PREFIX + path, JSON.stringify({ data, cachedAt: Date.now() }));
    await pruneCache();
  } catch {
    // Storage full or unavailable; offline caching is best-effort by design.
  }
};

export const removeCache = async (path: string): Promise<void> => {
  try {
    await AsyncStorage.removeItem(`${CACHE_PREFIX}${path}`);
  } catch {
    // noop
  }
};

/** Evict oldest entries beyond the cap. */
const pruneCache = async (): Promise<void> => {
  const keys = await AsyncStorage.getAllKeys();
  const cacheKeys = keys.filter((key) => key.startsWith(CACHE_PREFIX));
  if (cacheKeys.length <= MAX_ENTRIES) {
    return;
  }
  const timestamped = await Promise.all(
    cacheKeys.map(async (key) => {
      const entry = await readJsonAsync<{ cachedAt?: number }>(key);
      return { key, cachedAt: entry?.cachedAt ?? 0 };
    }),
  );
  const oldest = timestamped
    .sort((left, right) => left.cachedAt - right.cachedAt)
    .slice(0, cacheKeys.length - MAX_ENTRIES);
  await Promise.all(oldest.map((item) => AsyncStorage.removeItem(item.key)));
};

/** Outcome of the most recent read per path — screens use this to show a
 * "saved copy" badge instead of pretending cached data is fresh. */
const outcomes = new Map<string, ApiReadResult<unknown>>();

export const recordOutcome = (path: string, outcome: ApiReadResult<unknown>) => {
  outcomes.set(path, outcome);
};

export const getCacheOutcome = (path: string): ApiReadResult<unknown> | undefined =>
  outcomes.get(cacheKey(path));

const cacheKey = (path: string) => `/api/${path.split("/")[1] ?? ""}`.replace(/\?.*$/, "");

/**
 * Wrap an API read with the offline fallback. Network first; on any failure a
 * cached copy — with explicit `fromCache`— replaces it.
 */
export const withOfflineCache = async <T>(path: string, fetcher: () => Promise<T>): Promise<ApiReadResult<T>> => {
  try {
    const data = await fetcher();
    void writeCache(path, data);
    return { data, fromCache: false };
  } catch (error) {
    const entry = await readCache<T>(path);
    if (entry) {
      return {
        data: entry.data,
        fromCache: true,
        ageMs: Date.now() - entry.cachedAt,
        networkError: error instanceof Error ? error.message : String(error),
      };
    }
    throw error;
  }
};
