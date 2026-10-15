"use client";

/**
 * Client-side sync engine.
 *
 * Local storage stays the fast path (offline, instant reads) — but every local
 * write is mirrored to the server account, and on sign-in the server is pulled
 * and *merged over* local state (server is authoritative for account data;
 * local entries with a newer `updatedAt` win locally until the next pull).
 *
 * All requests are `credentials: same-origin`; the session cookie is HttpOnly
 * so no token is ever exposed to page scripts.
 */

export type SyncProgressInput = {
  mediaId: string;
  mediaType: "movie" | "tv" | "anime" | "manga";
  title: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  season?: number | null;
  episode?: number | null;
  chapterId?: string | null;
  currentTime: number;
  duration: number;
  progress?: number;
  updatedAt?: string;
};

const postJson = async <T = Record<string, unknown>>(
  path: string,
  body: unknown,
): Promise<{ ok: boolean; status: number; body: T | null }> => {
  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const parsed = (await response.json().catch(() => null)) as T | null;
  return { ok: response.ok, status: response.status, body: parsed };
};

export const pushProgress = async (input: SyncProgressInput) => {
  const result = await postJson("/api/sync/progress", {
    ...input,
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  });
  return result;
};

export const pushLibraryAdd = async (input: {
  mediaId: string;
  mediaType: string;
  title: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  profileId?: string;
}) => postJson("/api/sync/library", input);

export const pushLibraryRemove = async (mediaId: string, profileId?: string) =>
  fetch("/api/sync/library", {
    method: "DELETE",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mediaId, profileId }),
  });

export const pushSettings = async (settings: unknown, profileId?: string) =>
  postJson("/api/sync/settings", { settings, profileId });

export const pullProgress = async (profileId?: string) => {
  const params = new URLSearchParams();
  if (profileId) {
    params.set("profileId", profileId);
  }
  const response = await fetch(`/api/sync/progress?${params.toString()}`, {
    credentials: "same-origin",
  });
  if (!response.ok) {
    return null;
  }
  const body = (await response.json().catch(() => null)) as { items?: Array<Record<string, unknown>> } | null;
  return body?.items ?? null;
};

export const pullLibrary = async (profileId?: string) => {
  const params = new URLSearchParams();
  if (profileId) {
    params.set("profileId", profileId);
  }
  const response = await fetch(`/api/sync/library?${params.toString()}`, {
    credentials: "same-origin",
  });
  if (!response.ok) {
    return null;
  }
  const body = (await response.json().catch(() => null)) as { items?: Array<Record<string, unknown>> } | null;
  return body?.items ?? null;
};

export const pullSettings = async (profileId?: string) => {
  const params = new URLSearchParams();
  if (profileId) {
    params.set("profileId", profileId);
  }
  const response = await fetch(`/api/sync/settings?${params.toString()}`, {
    credentials: "same-origin",
  });
  if (!response.ok) {
    return null;
  }
  const body = (await response.json().catch(() => null)) as
    | { settings?: Record<string, unknown>; updatedAt?: string | null }
    | null;
  return body?.settings ?? null;
};
