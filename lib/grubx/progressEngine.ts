import type { NormalizedPlayerEvent, NormalizedPlayerEventName, PlayableMediaContext } from "@/lib/grubx/playerEvents";

/**
 * Playback progress engine (api-docs.txt §7.3).
 *
 * Turns raw player events into reliable progress persistence:
 * - Debounced periodic saves (never on every event).
 * - Forced flush on pause, seek, ended, and page-hide.
 * - Monotonic per-media guard: an older async update can never overwrite a
 *   newer one (api-docs.txt §7.3 "avoid overwriting newer progress with older
 *   asynchronous updates").
 * - Duration-validated: implausible updates (0 duration, negative time,
 *   currentTime > duration for non-`ended` events) are dropped, which prevents
 *   a broken provider from marking a title "watched".
 * - "Watched" is claimed only from an explicit `ended` event, or from a
 *   timeupdate whose position has crossed the completion threshold the
 *   provider reported — never from a startup or missing data.
 */

export type PersistedProgress = {
  mediaId: string;
  mediaType: "movie" | "tv" | "anime";
  title?: string;
  season: number | null;
  episode: number | null;
  currentTime: number;
  duration: number;
  progress: number; // 0–100
  updatedAt: string;
};

export type ProgressSink = {
  save(input: Omit<PersistedProgress, "updatedAt" | "progress"> & { progress?: number }): Promise<void> | void;
};

export type ProgressEngineOptions = {
  context: PlayableMediaContext;
  title?: string;
  /** Periodic-save interval in ms (default 10s, matching Production Recommendations). */
  saveIntervalMs?: number;
  /** Percentage at which a title is considered "watched" (default 95). */
  watchedThreshold?: number;
  sink: ProgressSink;
};

export type ProgressSnapshot = PersistedProgress | null;

const clampPercent = (value: number) => Math.min(100, Math.max(0, Math.round(value)));

/**
 * Whether a timeupdate event should be trusted at all. `ended` bypasses these
 * checks — an ended session is a completion claim, valid even at 0 duration.
 */
const isPlausibleTimeupdate = (event: NormalizedPlayerEvent): boolean => {
  if (event.currentTime === null || event.currentTime < 0) {
    return false;
  }
  if (event.duration <= 0) {
    // A provider with unknown duration cannot establish progress.
    return false;
  }
  if (event.currentTime > event.duration) {
    return false;
  }
  return true;
};

export const createProgressEngine = (options: ProgressEngineOptions) => {
  const saveIntervalMs = options.saveIntervalMs ?? 10_000;
  const watchedThreshold = options.watchedThreshold ?? 95;

  let lastSavedAt = 0;
  let lastSavedTime: number | null = null;
  let lastSavedDuration: number | null = null;
  let completed = false;

  const persist = async (
    input: { event: NormalizedPlayerEventName; currentTime: number; duration: number },
    force = false,
  ) => {
    const now = Date.now();
    if (!force && now - lastSavedAt < saveIntervalMs) {
      return;
    }

    // Monotonic guard: skip an update that is older than what we saved already
    // for the same media key (api-docs.txt §7.3).
    if (
      !force &&
      lastSavedTime !== null &&
      input.event === "timeupdate" &&
      input.currentTime <= lastSavedTime
    ) {
      return;
    }

    lastSavedAt = now;
    lastSavedTime = input.currentTime;
    lastSavedDuration = input.duration;

    const duration = Math.max(0, input.duration);
    const percent =
      duration > 0 ? clampPercent((input.currentTime / duration) * 100) : input.event === "ended" ? 100 : 0;

    await options.sink.save({
      mediaId: options.context.mediaId,
      mediaType: options.context.mediaType,
      title: options.title,
      season: options.context.season,
      episode: options.context.episode,
      currentTime: input.currentTime,
      duration,
      progress: percent,
    });
  };

  return {
    /**
     * Feed a normalized player event. Returns the decision rationale, which
     * callers can surface for debugging without coupling on persistence.
     */
    async handle(event: NormalizedPlayerEvent): Promise<"saved" | "throttled" | "ignored"> {
      if (event.event === "ready") {
        return "ignored";
      }

      if (event.event === "ended") {
        if (completed) {
          return "ignored";
        }
        completed = true;
        const currentTime =
          event.currentTime !== null
            ? event.currentTime
            : (lastSavedTime ?? 0);
        await persist({ event: "ended", currentTime, duration: event.duration }, true);
        return "saved";
      }

      if (!isPlausibleTimeupdate(event)) {
        return "ignored";
      }

      if (event.duration > 0 && event.currentTime !== null && event.currentTime / event.duration >= watchedThreshold / 100) {
        // A viewer who reaches the threshold is treated as finished watching
        // even before the provider emits `ended` (some providers never do).
        if (!completed) {
          completed = true;
          await persist(
            { event: "ended", currentTime: event.currentTime, duration: event.duration },
            true,
          );
          return "saved";
        }
        return "ignored";
      }

      if (event.event === "pause" || event.event === "seeked") {
        await persist(
          { event: event.event, currentTime: event.currentTime ?? 0, duration: event.duration },
          true,
        );
        return "saved";
      }

      await persist({ event: event.event, currentTime: event.currentTime ?? 0, duration: event.duration });
      return "saved";
    },

    /** Manual progress correction ("I'm actually at 42:10"). */
    async correct(currentTime: number, duration: number | null): Promise<void> {
      const safeTime = Math.max(0, currentTime);
      const safeDuration = duration !== null && duration > 0 ? duration : lastSavedDuration ?? 0;
      completed = safeDuration > 0 && safeTime / safeDuration >= watchedThreshold / 100;
      lastSavedTime = safeTime;
      await persist({ event: "timeupdate", currentTime: safeTime, duration: safeDuration }, true);
    },

    /** Flush on pagehide / unmount — a last-chance non-throwing save. */
    async flush(): Promise<void> {
      if (lastSavedTime === null || completed) {
        return;
      }
      await persist(
        { event: "timeupdate", currentTime: lastSavedTime, duration: lastSavedDuration ?? 0 },
        true,
      );
    },

    /** Whether the current title counts as watched. */
    isCompleted: () => completed,
  };
};

export type ProgressEngine = ReturnType<typeof createProgressEngine>;
