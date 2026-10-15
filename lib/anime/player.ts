"use client";

import { ANI_PM_ORIGIN, normalizeEpisodeNumber, normalizeAnimeLanguage } from "@/lib/anime/embed";
import type { AnimeLanguage } from "@/types/anime";

/**
 * Ani.pm player SDK adapter (api-docs.txt §6.4–6.6).
 *
 * The SDK is loaded on demand from the documented URL and used through a narrow
 * typed surface: every value coming back from the framed player is treated as
 * untrusted input and sanitized before it reaches React state or local storage.
 *
 * If the SDK cannot load (offline, blocked script), `loadAniPmPlayerSdk`
 * resolves to null and the caller renders the documented plain iframe with the
 * provider's own controls instead of pretending custom controls work.
 */

const SDK_URL = `${ANI_PM_ORIGIN}/embed/sdk/v1.js`;
const SDK_TIMEOUT_MS = 12_000;

export type AnimePlayerState = {
  title: string | null;
  episode: number | null;
  lang: AnimeLanguage;
  currentTime: number;
  duration: number;
  paused: boolean;
  volume: number;
  muted: boolean;
  rate: number;
  subtitle: string | null;
  qualities: number[];
  episodeCount: number;
};

export type AnimePlayerEvent =
  | "loaded"
  | "ready"
  | "play"
  | "pause"
  | "playing"
  | "waiting"
  | "seeking"
  | "seeked"
  | "timeupdate"
  | "ended"
  | "episodechange"
  | "languagechange"
  | "volumechange"
  | "ratechange"
  | "qualitychange"
  | "subtitlechange"
  | "fullscreenchange"
  | "theaterchange"
  | "autoplayblocked"
  | "error";

export type AnimePlayerError = { code: string; message: string };

export type AnimePlayerInstance = {
  on(event: AnimePlayerEvent, handler: (state: AnimePlayerState, error?: AnimePlayerError) => void): void;
  play(): void;
  pause(): void;
  togglePlay(): void;
  seek(seconds: number): void;
  seekBy(seconds: number): void;
  setVolume(volume: number): void;
  setMuted(muted: boolean): void;
  setPlaybackRate(rate: number): void;
  setLanguage(language: AnimeLanguage): void;
  setSubtitles(choice: string): void;
  setTheater(enabled: boolean): void;
  next(): void;
  previous(): void;
  requestFullscreen(): void;
  getState(): AnimePlayerState;
  destroy(): void;
};

export type AnimePlayerInit = {
  container: HTMLElement;
  anilistId: number;
  episode: number;
  lang: AnimeLanguage;
  color?: string;
  autoplay?: boolean;
  autoNext?: boolean;
  autoSkip?: boolean;
  theater?: boolean;
  start?: number;
  title?: string;
};

type RawPlayer = {
  on?: (event: string, handler: (payload: unknown) => void) => void;
  destroy?: () => void;
  play?: () => unknown;
  pause?: () => unknown;
  togglePlay?: () => unknown;
  seek?: (seconds: number) => unknown;
  seekBy?: (seconds: number) => unknown;
  setVolume?: (volume: number) => unknown;
  setMuted?: (muted: boolean) => unknown;
  setPlaybackRate?: (rate: number) => unknown;
  setLanguage?: (language: string) => unknown;
  setSubtitles?: (choice: string) => unknown;
  setTheater?: (enabled: boolean) => unknown;
  next?: () => unknown;
  previous?: () => unknown;
  requestFullscreen?: () => unknown;
  getState?: () => unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readNumber = (value: unknown, fallback = 0): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const readBoolean = (value: unknown): boolean => value === true;

const readString = (value: unknown): string | null =>
  typeof value === "string" && value.length <= 300 ? value : null;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Episode availability can arrive as a count, an array, or an object of lists. */
const readEpisodeCount = (value: unknown): number => {
  if (Array.isArray(value)) {
    return value.length;
  }
  if (isRecord(value)) {
    const candidates = [value.total, value.count, value.length, value.episodes];
    for (const candidate of candidates) {
      if (typeof candidate === "number" && Number.isFinite(candidate)) {
        return Math.max(0, Math.floor(candidate));
      }
      if (Array.isArray(candidate)) {
        return candidate.length;
      }
    }
  }
  return 0;
};

const readQualities = (value: unknown): number[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => (isRecord(entry) ? readNumber(entry.height, 0) : readNumber(entry, 0)))
    .filter((height) => height >= 144 && height <= 2160)
    .slice(0, 12)
    .sort((left, right) => left - right);
};

const sanitizeState = (payload: unknown): AnimePlayerState => {
  const record = isRecord(payload) ? payload : {};
  const duration = clamp(readNumber(record.duration, 0), 0, 60 * 60 * 12);
  const currentTime = clamp(readNumber(record.currentTime ?? record.time, 0), 0, duration > 0 ? duration : 60 * 60 * 12);

  const episodeValue = readNumber(record.episode, 0);
  const rate = readNumber(record.rate ?? record.playbackRate, 1);

  return {
    title: readString(record.title),
    episode: Number.isInteger(episodeValue) && episodeValue > 0 ? episodeValue : null,
    lang: normalizeAnimeLanguage(readString(record.lang) ?? undefined),
    currentTime,
    duration,
    paused: readBoolean(record.paused) || record.playing === false,
    volume: clamp(readNumber(record.volume, 1), 0, 1),
    muted: readBoolean(record.muted),
    rate: clamp(rate, 0.25, 4),
    subtitle: readString(record.subtitle ?? record.subtitles),
    qualities: readQualities(record.qualities ?? record.availableQualities),
    episodeCount: readEpisodeCount(record.episodes ?? record.episodeList ?? record.episodeAvailability),
  };
};

type SdkGlobal = {
  Player: new (target: HTMLElement | string, options: Record<string, unknown>) => RawPlayer;
};

let sdkPromise: Promise<SdkGlobal | null> | null = null;

const readSdkGlobal = (): SdkGlobal | null => {
  const candidate = (window as unknown as { AniPM?: unknown }).AniPM;
  if (isRecord(candidate) && typeof candidate.Player === "function") {
    return candidate as unknown as SdkGlobal;
  }
  return null;
};

/**
 * Loads `https://ani.pm/embed/sdk/v1.js` once per document. Resolves to null if
 * the script cannot be loaded or does not define the documented global.
 */
export const loadAniPmPlayerSdk = (): Promise<SdkGlobal | null> => {
  if (sdkPromise) {
    return sdkPromise;
  }

  sdkPromise = new Promise<SdkGlobal | null>((resolve) => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      resolve(null);
      return;
    }

    const existing = readSdkGlobal();
    if (existing) {
      resolve(existing);
      return;
    }

    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.referrerPolicy = "origin";

    let settled = false;
    const finish = (sdk: SdkGlobal | null) => {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(timer);
      resolve(sdk);
    };

    const timer = window.setTimeout(() => finish(readSdkGlobal()), SDK_TIMEOUT_MS);
    script.onload = () => finish(readSdkGlobal());
    script.onerror = () => finish(null);
    document.head.appendChild(script);
  });

  return sdkPromise;
};

/**
 * Wraps a raw SDK player. Commands are fire-and-forget: the SDK returns promises
 * that reject on a destroyed or unready player, and a rejected command must never
 * surface as an unhandled rejection.
 */
export const createAnimePlayer = async (init: AnimePlayerInit): Promise<AnimePlayerInstance | null> => {
  const sdk = await loadAniPmPlayerSdk();
  if (!sdk) {
    return null;
  }

  const raw = new sdk.Player(init.container, {
    anime: init.anilistId,
    episode: init.episode,
    lang: init.lang,
    // Documented options are only sent when the caller asked for them.
    ...(init.color ? { color: init.color } : {}),
    ...(typeof init.autoplay === "boolean" ? { autoplay: init.autoplay } : {}),
    ...(typeof init.autoNext === "boolean" ? { autonext: init.autoNext } : {}),
    ...(typeof init.autoSkip === "boolean" ? { autoskip: init.autoSkip } : {}),
    ...(typeof init.theater === "boolean" ? { theater: init.theater } : {}),
    ...(typeof init.start === "number" && init.start > 0 ? { start: Math.floor(init.start) } : {}),
  });

  let state: AnimePlayerState = sanitizeState(null);
  const listeners = new Map<string, Set<(state: AnimePlayerState, error?: AnimePlayerError) => void>>();
  let destroyed = false;

  const emit = (event: string, payload: unknown) => {
    const next = sanitizeState(isRecord(payload) ? payload : {});
    state = { ...state, ...next };

    const error =
      event === "error" && isRecord(payload)
        ? {
            code: readString(payload.code) ?? "anipm-error",
            message: readString(payload.message) ?? "The player reported a problem.",
          }
        : undefined;

    listeners.get(event)?.forEach((handler) => handler(state, error));
    listeners.get("*")?.forEach((handler) => handler(state, error));
  };

  const EVENTS: AnimePlayerEvent[] = [
    "loaded",
    "ready",
    "play",
    "pause",
    "playing",
    "waiting",
    "seeking",
    "seeked",
    "timeupdate",
    "ended",
    "episodechange",
    "languagechange",
    "volumechange",
    "ratechange",
    "qualitychange",
    "subtitlechange",
    "fullscreenchange",
    "theaterchange",
    "autoplayblocked",
    "error",
  ];

  EVENTS.forEach((event) => {
    raw.on?.(event, (payload) => emit(event, payload));
  });

  const call = (method: keyof RawPlayer, ...args: unknown[]) => {
    if (destroyed) {
      return;
    }
    const fn = raw[method] as ((...callArgs: unknown[]) => unknown) | undefined;
    if (typeof fn !== "function") {
      return;
    }
    try {
      const result = fn.apply(raw, args);
      if (result && typeof (result as Promise<unknown>).catch === "function") {
        void (result as Promise<unknown>).catch(() => undefined);
      }
    } catch {
      // A destroyed or unready player rejects or throws; the UI reflects that
      // through the `error` event rather than an uncaught exception.
    }
  };

  return {
    on(event, handler) {
      const set = listeners.get(event) ?? new Set();
      set.add(handler);
      listeners.set(event, set);
    },
    play: () => call("play"),
    pause: () => call("pause"),
    togglePlay: () => call("togglePlay"),
    seek: (seconds) => call("seek", clamp(Math.floor(seconds), 0, 60 * 60 * 12)),
    seekBy: (seconds) => call("seekBy", clamp(Math.floor(seconds), -600, 600)),
    setVolume: (volume) => call("setVolume", clamp(volume, 0, 1)),
    setMuted: (muted) => call("setMuted", muted === true),
    setPlaybackRate: (rate) => call("setPlaybackRate", clamp(rate, 0.25, 4)),
    setLanguage: (language) => call("setLanguage", normalizeAnimeLanguage(language)),
    setSubtitles: (choice) => call("setSubtitles", choice.slice(0, 40)),
    setTheater: (enabled) => call("setTheater", enabled === true),
    next: () => call("next"),
    previous: () => call("previous"),
    requestFullscreen: () => call("requestFullscreen"),
    getState: () => {
      const live = raw.getState?.();
      if (isRecord(live)) {
        state = { ...state, ...sanitizeState(live) };
      }
      return state;
    },
    destroy() {
      if (destroyed) {
        return;
      }
      destroyed = true;
      listeners.clear();
      try {
        raw.destroy?.();
      } catch {
        // Destroying an already-unloaded frame must not break unmount.
      }
    },
  };
};

/** Documented episode-availability shape from the catalogue, for the watch page. */
export const isEpisodeAvailable = (episode: number | null, count: number) =>
  episode !== null && count > 0 && episode <= count && episode >= 1;

export { normalizeEpisodeNumber };
