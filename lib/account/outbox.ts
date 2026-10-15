/**
 * Client sync outbox.
 *
 * Progress/watchlist/settings mirrors used to be swallowed on failure
 * (`catch(() => undefined)`), which silently dropped changes made offline.
 * Now every failed mirror lands here and is flushed in order whenever the
 * network returns, the tab becomes visible, or the app boots.
 *
 * Conflict policy is explicit last-write-wins per (kind, key): a queued item
 * is superseded by a newer write to the same target — the queue stores at most
 * the newest intent, and flush order preserves chronology.
 *
 * Only non-sensitive user-library payloads are ever queued. No credentials,
 * session tokens, provider keys, or private media bytes pass through this
 * module, and queued items are cleared on explicit account sign-out clears.
 */

import {
  pushLibraryAdd,
  pushLibraryRemove,
  pushProgress,
  pushSettings,
  type SyncProgressInput,
} from "@/lib/account/syncClient";

export type OutboxKind = "progress" | "libraryAdd" | "libraryRemove" | "settings";

export type OutboxItem = {
  id: string;
  kind: OutboxKind;
  /** Identifies the target entity for dedupe (e.g. mediaId). */
  key: string;
  enqueuedAt: string;
  /** Overall recency used by last-write-wins (payload's own timestamp). */
  payloadAt: string;
  payload: unknown;
};

type KV = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export const OUTBOX_STORAGE_KEY = "grubx_sync_outbox";

const MAX_ITEMS = 500;

const defaultKV: KV = typeof window !== "undefined" ? window.localStorage : stubKV();

function stubKV(): KV {
  const memory = new Map<string, string>();
  return {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => void memory.set(key, value),
    removeItem: (key) => void memory.delete(key),
  };
}

const readOutbox = (kv: KV = defaultKV): OutboxItem[] => {
  const raw = kv.getItem(OUTBOX_STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as OutboxItem[]) : [];
  } catch {
    return [];
  }
};

const writeOutbox = (items: OutboxItem[], kv: KV = defaultKV) => {
  kv.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(items));
};

/**
 * Queue a write, replacing an older intent for the same target. Returns the
 * full queue so callers/tests can observe state.
 */
export const enqueueOutbox = (
  item: Pick<OutboxItem, "kind" | "key" | "payload"> & { payloadAt?: string; now?: string },
  kv: KV = defaultKV,
): OutboxItem[] => {
  const now = item.now ?? new Date().toISOString();
  const entry: OutboxItem = {
    id: `${item.kind}:${item.key}`,
    kind: item.kind,
    key: item.key,
    enqueuedAt: now,
    payloadAt: item.payloadAt ?? now,
    payload: item.payload,
  };

  const existing = readOutbox(kv).filter((pending) => pending.id !== entry.id);
  const next = [...existing, entry]
    .sort((left, right) => left.enqueuedAt.localeCompare(right.enqueuedAt))
    .slice(-MAX_ITEMS);
  writeOutbox(next, kv);
  return next;
};

export const outboxSize = (kv: KV = defaultKV) => readOutbox(kv).length;

export const clearOutbox = (kv: KV = defaultKV) => {
  kv.removeItem(OUTBOX_STORAGE_KEY);
};

/**
 * Default flush target wired to real sync endpoints. Skips the network when
 * there is no signed-in session (queued items simply persist).
 */
export const flushSyncOutbox = async () => {
  const session = await fetch("/api/auth/session", { credentials: "same-origin" })
    .then((response) => response.json() as Promise<{ user: unknown }>)
    .then((body) => body.user !== null)
    .catch(() => false);
  if (!session) {
    return { flushed: 0, remaining: outboxSize() };
  }
  return flushOutbox({
    progress: (input) => pushProgress(input),
    libraryAdd: (input) => pushLibraryAdd(input as never),
    libraryRemove: (mediaId) => pushLibraryRemove(mediaId),
    settings: (input) => pushSettings(input),
  });
};

export type OutboxSink = {
  progress(input: SyncProgressInput): Promise<unknown>;
  libraryAdd(input: Record<string, unknown>): Promise<unknown>;
  libraryRemove(mediaId: string): Promise<unknown>;
  settings(input: unknown): Promise<unknown>;
};

/**
 * Flush queued writes in chronological order. Items that succeed are removed;
 * ITEMS THAT FAIL REMAIN for the next attempt (retried safely — every sink is
 * idempotent by key: server-side upserts or deletes, never blind stores).
 */
export const flushOutbox = async (
  sink: OutboxSink,
  kv: KV = defaultKV,
): Promise<{ flushed: number; remaining: number }> => {
  const items = readOutbox(kv);
  let flushed = 0;
  for (const item of items) {
    try {
      if (item.kind === "progress") {
        await sink.progress(item.payload as SyncProgressInput);
      } else if (item.kind === "libraryAdd") {
        await sink.libraryAdd(item.payload as Record<string, unknown>);
      } else if (item.kind === "settings") {
        await sink.settings(item.payload);
      } else {
        await sink.libraryRemove(String(item.key));
      }
      flushed += 1;
    } catch {
      break;
    }
  }
  const remaining = items.slice(flushed);
  writeOutbox(remaining, kv);
  return { flushed, remaining: remaining.length };
};
