import type { GrubXMediaType } from "@/types/grubx";

/**
 * Normalized player event model (api-docs.txt §7.2).
 *
 * Every provider adapter converts its own wire format into these events.
 * Application layers (progress engine, watch party, UI) consume only this
 * shape, never a provider payload.
 */

export type NormalizedPlayerEventName =
  | "ready"
  | "play"
  | "pause"
  | "seeked"
  | "timeupdate"
  | "ended";

export type NormalizedPlayerEvent = {
  provider: string;
  event: NormalizedPlayerEventName;
  /** Raw position in seconds. Present for progress-bearing events. */
  currentTime: number | null;
  /** Raw duration in seconds. 0 means "unknown" — never persisted as truth. */
  duration: number;
  mediaType: GrubXMediaType | null;
  /** Provider-confirmed media id, when the provider includes one. */
  mediaId: string | null;
  season: number | null;
  episode: number | null;
};

export type PlayableMediaContext = {
  provider: string;
  mediaType: GrubXMediaType;
  mediaId: string;
  season: number | null;
  episode: number | null;
};

export type PlayerCommandName = "play" | "pause" | "seek" | "volume" | "mute" | "getStatus";

export type PlayerCommand =
  | { command: "play" }
  | { command: "pause" }
  | { command: "seek"; time: number }
  | { command: "volume"; level: number }
  | { command: "mute"; muted: boolean }
  | { command: "getStatus" };

/**
 * Embed-URL origin extraction.
 *
 * Commands are sent with the *actual* origin of the iframe (api-docs.txt §2.4:
 * "use the actual origin of the iframe in the second argument"), never "*".
 */
export const embedOrigin = (embedUrl: string): string | null => {
  try {
    const parsed = new URL(embedUrl, typeof window !== "undefined" ? window.location.origin : "https://grubx.invalid");
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
};
