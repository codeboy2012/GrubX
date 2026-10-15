import { API_BASE } from "./api";
import type { Progress, SavedItem } from "./storage";

/**
 * GrubX native account client.
 *
 * Talks to the same Next.js account routes as the web app. The session token
 * is an opaque bearer issued by /api/auth/login and stored in AsyncStorage;
 * it is exchanged for cookie-less header auth because native fetch does not
 * share cookies with the web deployment. The token never leaves the server
 * account system — provider credentials are never involved.
 */

const TOKEN_KEY = "grubx_session_token";

type SessionInfo = { user: { userId: string; email: string } | null; profiles?: Array<{ id: string; name: string; isDefault: boolean }> };

const readToken = async (): Promise<string | null> => {
  try {
    const { default: AsyncStorage } = await import("@react-native-async-storage/async-storage");
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

const writeToken = async (token: string | null) => {
  try {
    const { default: AsyncStorage } = await import("@react-native-async-storage/async-storage");
    if (token) {
      await AsyncStorage.setItem(TOKEN_KEY, token);
    } else {
      await AsyncStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // Storage failure keeps the account unusable but never crashes the app.
  }
};

const authedFetch = async <T>(path: string, init: RequestInit & { bearer?: string | null } = {}): Promise<T> => {
  const token = init.bearer ?? (await readToken());
  const headers: Record<string, string> = { Accept: "application/json", ...(init.headers as Record<string, string> | undefined) };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, { ...init, headers, signal: AbortSignal.timeout(12_000) });

  if (response.status === 401) {
    await writeToken(null);
    throw new Error("Your session expired. Sign in again.");
  }
  if (!response.ok) {
    let message = `Request failed with ${response.status}`;
    try {
      const body = (await response.json()) as { error?: unknown };
      if (typeof body?.error === "string") {
        message = body.error;
      }
    } catch {
      // Keep the default message.
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
};

/**
 * Bearer support on the server: the login route sets an HttpOnly cookie for
 * the web; the native client needs the raw token too. Login returns both.
 */
export const account = {
  async session(): Promise<SessionInfo> {
    try {
      return await authedFetch<SessionInfo>("/api/auth/session");
    } catch {
      return { user: null };
    }
  },

  async signIn(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email, password, deviceLabel: "GrubX native" }),
      signal: AbortSignal.timeout(12_000),
    });
    const body = (await response.json().catch(() => ({}))) as { token?: string; error?: string };
    if (!response.ok || !body.token) {
      return { ok: false, error: body.error ?? "Unable to sign in right now." };
    }
    await writeToken(body.token);
    return { ok: true };
  },

  async register(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
    const response = await fetch(`${API_BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email, password, deviceLabel: "GrubX native" }),
      signal: AbortSignal.timeout(12_000),
    });
    const body = (await response.json().catch(() => ({}))) as { token?: string; error?: string };
    if (!response.ok || !body.token) {
      return { ok: false, error: body.error ?? "Unable to create the account right now." };
    }
    await writeToken(body.token);
    return { ok: true };
  },

  async signOut(): Promise<void> {
    try {
      await authedFetch("/api/auth/logout", { method: "POST" });
    } finally {
      await writeToken(null);
    }
  },

  /** Server progress for the signed-in profile, merged into local storage. */
  async pullProgress(): Promise<Progress[] | null> {
    const body = await authedFetch<{ items?: Array<Record<string, unknown>> }>("/api/sync/progress");
    return (body.items ?? []) as unknown as Progress[];
  },

  async pullLibrary(): Promise<SavedItem[] | null> {
    const body = await authedFetch<{ items?: Array<Record<string, unknown>> }>("/api/sync/library");
    return (body.items ?? []) as unknown as SavedItem[];
  },

  async pushProgress(item: Progress): Promise<void> {
    await authedFetch("/api/sync/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mediaId: item.mediaId,
        mediaType: item.mediaType,
        title: item.title,
        posterPath: item.coverUrl,
        season: item.season,
        episode: item.episode,
        chapterId: item.chapterId ?? null,
        currentTime: item.currentTime,
        duration: item.duration,
        updatedAt: item.updatedAt,
      }),
    });
  },

  async pushLibraryAdd(item: SavedItem): Promise<void> {
    await authedFetch("/api/sync/library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mediaId: item.mediaId,
        mediaType: item.mediaType,
        title: item.title,
        posterPath: item.coverUrl,
      }),
    });
  },

  async pushLibraryRemove(mediaId: string): Promise<void> {
    await authedFetch("/api/sync/library", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mediaId }),
    });
  },
};
