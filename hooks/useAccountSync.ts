"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { useAccount } from "@/context/AccountContext";
import { pullLibrary, pullProgress, pullSettings } from "@/lib/account/syncClient";
import { PROGRESS_STORAGE_KEY, WATCHLIST_STORAGE_KEY, sanitizeSettings, writeLocalJson } from "@/lib/settings";
import type { PlaybackProgress, WatchlistItem } from "@/types/data-layer";

/**
 * Server → local merge on sign-in, so Continue Watching / My List / settings
 * that were saved on another device appear on this one.
 *
 * Conflict rule: for progress entries that exist on both sides, keep whichever
 * has the newer `updatedAt` — matching the server's last-write-wins semantics.
 */
export const useAccountSync = () => {
  const { user, activeProfileId, ready } = useAccount();
  const lastSyncedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!ready || !user || !activeProfileId) {
      return;
    }
    // One merge per session/profile pair.
    const key = `${user.userId}:${activeProfileId}`;
    if (lastSyncedRef.current === key) {
      return;
    }
    lastSyncedRef.current = key;

    void (async () => {
      try {
        const [serverProgress, serverLibrary, serverSettings] = await Promise.all([
          pullProgress(activeProfileId),
          pullLibrary(activeProfileId),
          pullSettings(activeProfileId),
        ]);

        if (typeof window === "undefined") {
          return;
        }

        if (serverProgress && serverProgress.length > 0) {
          const localRaw = window.localStorage.getItem(PROGRESS_STORAGE_KEY);
          const local = (localRaw ? (JSON.parse(localRaw) as Record<string, PlaybackProgress>) : {}) ?? {};
          const merged: Record<string, PlaybackProgress> = { ...local };
          for (const item of serverProgress) {
            const mediaId = String(item.mediaId ?? "");
            if (!mediaId) {
              continue;
            }
            const localEntry = local[mediaId];
            const serverUpdatedAt = String(item.updatedAt ?? "");
            if (!localEntry || localEntry.updatedAt < serverUpdatedAt) {
              merged[mediaId] = {
                mediaId,
                mediaType: (item.mediaType as PlaybackProgress["mediaType"]) ?? "movie",
                title: String(item.title ?? mediaId),
                posterPath: (item.posterPath as string | null) ?? null,
                backdropPath: (item.backdropPath as string | null) ?? null,
                season: (item.season as number | null) ?? null,
                episode: (item.episode as number | null) ?? null,
                chapterId: (item.chapterId as string | null) ?? null,
                currentTime: Number(item.currentTime ?? 0),
                duration: Number(item.duration ?? 0),
                progress: Number(item.percent ?? 0),
                updatedAt: serverUpdatedAt,
              };
            }
          }
          writeLocalJson(PROGRESS_STORAGE_KEY, merged);
        }

        if (serverLibrary && serverLibrary.length > 0) {
          const localRaw = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);
          const local = (localRaw ? (JSON.parse(localRaw) as WatchlistItem[]) : []) ?? [];
          const localById = new Map(local.map((item) => [item.mediaId, item]));
          for (const item of serverLibrary) {
            const mediaId = String(item.mediaId ?? "");
            if (!mediaId || localById.has(mediaId)) {
              continue;
            }
            localById.set(mediaId, {
              mediaId,
              mediaType: (item.mediaType as WatchlistItem["mediaType"]) ?? "movie",
              title: String(item.title ?? mediaId),
              posterPath: (item.posterPath as string | null) ?? null,
              backdropPath: (item.backdropPath as string | null) ?? null,
              rating: null,
              addedAt: String(item.addedAt ?? new Date().toISOString()),
            });
          }
          writeLocalJson(WATCHLIST_STORAGE_KEY, [...localById.values()]);
        }

        if (serverSettings) {
          const sanitized = sanitizeSettings(serverSettings);
          writeLocalJson("grubx_settings", sanitized);
        }
      } catch {
        // Offline or server hiccup: local caches remain untouched and usable.
        toast.error("Cross-device sync is temporarily unavailable.", { duration: 3500 });
      }
    })();
  }, [ready, user, activeProfileId]);
};
