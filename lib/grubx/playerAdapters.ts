import type { GrubXMediaType } from "@/types/grubx";

import {
  embedOrigin,
  type NormalizedPlayerEvent,
  type NormalizedPlayerEventName,
  type PlayerCommand,
  type PlayableMediaContext,
} from "@/lib/grubx/playerEvents";

/**
 * Provider adapters for the documented embed players (api-docs.txt §2–6).
 *
 * Capabilities modeled here reflect ONLY what each provider's documentation
 * states; per-provider limitations are recorded in the adapter `notes`, so the
 * UI never offers a control a provider cannot operate.
 *
 * Security model (api-docs.txt §9 "Validate iframe messages"):
 * - Every inbound message must come from `event.source === iframe.contentWindow`.
 * - `event.origin` must exactly match the origin the iframe was loaded from.
 * - Message schemas are validated field-by-field; unknown shapes are dropped.
 * - Outbound commands are allowlisted per provider and sent with the iframe's
 *   real origin — never "*" (api-docs.txt §9: avoid wildcard target origins).
 */

export type ProviderId = string;

export type AdapterCapabilities = {
  /** Provider documents playback control commands. */
  commands: boolean;
  /** Provider documents a progress event. */
  progress: boolean;
  /** Provider documents a subtitle preference parameter. */
  subtitleParam: boolean;
  /** Provider documents TV next-episode parameters. */
  nextEpisodeParams: boolean;
};

export type ProviderAdapter = {
  id: ProviderId;
  name: string;
  /** Documented origin hosts the embed player may be served from. */
  origins: string[];
  supportsCommands: boolean;
  capabilities: AdapterCapabilities;
  notes: string;
  /** Inbound message → NormalizedPlayerEvent, or null when not applicable. */
  parseEvent(data: unknown, context: PlayableMediaContext): NormalizedPlayerEvent | null;
  /** Normalized command → provider wire message, or null when unsupported. */
  buildCommand(command: PlayerCommand): Record<string, unknown> | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readFiniteNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const readNonNegativeNumber = (value: unknown): number => {
  const parsed = readFiniteNumber(value);
  return parsed !== null && parsed >= 0 ? parsed : 0;
};

const readPositiveInteger = (value: unknown): number | null => {
  const parsed = readFiniteNumber(value);
  return parsed !== null && Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

/**
 * Shared PLAYER_EVENT schema check: { type: "PLAYER_EVENT", data: {...} }.
 * Documented for VidFast (§2.4), VidLink (§3.6), and VidRock (§5.5).
 * VidCore's documentation (§4.3) shows the same data shape.
 */
const parsePlayerEventPayload = (
  data: unknown,
  providerId: string,
  context: PlayableMediaContext,
  options: { titleIdField?: "tmdbId" | "mtmdbId" } = {},
): NormalizedPlayerEvent | null => {
  if (!isRecord(data) || data.type !== "PLAYER_EVENT" || !isRecord(data.data)) {
    return null;
  }

  const payload = data.data;
  const events: NormalizedPlayerEventName[] = ["play", "pause", "seeked", "timeupdate", "ended"];
  const eventName = payload.event;
  if (typeof eventName !== "string" || !events.includes(eventName as NormalizedPlayerEventName)) {
    return null;
  }

  const rawId = payload[options.titleIdField ?? "tmdbId"];
  const providerMediaId =
    typeof rawId === "string" && /^[\w-]{1,64}$/.test(rawId)
      ? rawId
      : typeof rawId === "number" && Number.isInteger(rawId) && rawId > 0
        ? String(rawId)
        : null;

  return {
    provider: providerId,
    event: eventName as NormalizedPlayerEventName,
    currentTime: readFiniteNumber(payload.currentTime),
    duration: readNonNegativeNumber(payload.duration),
    mediaType: readMediaType(payload.mediaType, context.mediaType),
    mediaId: providerMediaId ?? context.mediaId,
    season: readPositiveInteger(payload.season),
    episode: readPositiveInteger(payload.episode),
  };
};

const readMediaType = (value: unknown, fallback: GrubXMediaType): GrubXMediaType =>
  value === "tv" ? "tv" : value === "movie" ? "movie" : value === "anime" ? "anime" : fallback;

/** VidFast — progress + commands documented (§2.3–2.4). */
export const VUDFAST_ORIGINS = [
  "https://vidfast.pro",
  "https://vidfast.in",
  "https://vidfast.io",
  "https://vidfast.me",
  "https://vidfast.net",
  "https://vidfast.pm",
  "https://vidfast.vc",
  "https://vidfast.bz",
] as const;

export const vidfastAdapter: ProviderAdapter = {
  id: "vidfast",
  name: "VidFast",
  origins: [...VUDFAST_ORIGINS],
  supportsCommands: true,
  capabilities: { commands: true, progress: true, subtitleParam: true, nextEpisodeParams: true },
  notes: "Documented event set + play/pause/seek/volume/mute/getStatus commands. Watch-party capable.",
  parseEvent(data, context) {
    return parsePlayerEventPayload(data, "vidfast", context);
  },
  buildCommand(command) {
    switch (command.command) {
      case "seek":
        return { command: "seek", time: Math.max(0, Math.floor(command.time)) };
      case "volume":
        return { command: "volume", level: Math.min(1, Math.max(0, command.level)) };
      case "mute":
        return { command: "mute", muted: command.muted === true };
      default:
        return { command: command.command };
    }
  },
};

/** VidLink — progress documented (§3.5–3.6); commands NOT documented. */
export const vidlinkAdapter: ProviderAdapter = {
  id: "vidlink",
  name: "VidLink",
  origins: ["https://vidlink.pro"],
  supportsCommands: false,
  capabilities: { commands: false, progress: true, subtitleParam: true, nextEpisodeParams: true },
  notes: "Watch progress + PLAYER_EVENT documented. No send-command API documented.",
  parseEvent(data, context) {
    // VidLink's docs mark the media id as mtmdbId (verify before relying on it).
    return parsePlayerEventPayload(data, "vidlink", context, { titleIdField: "mtmdbId" });
  },
  buildCommand() {
    return null;
  },
};

/** VidCore — timeupdate/ended events + commands documented (§4.3–4.4). */
export const vidcoreAdapter: ProviderAdapter = {
  id: "vidcore",
  name: "VidCore",
  origins: ["https://vidcore.io"],
  supportsCommands: true,
  capabilities: { commands: true, progress: true, subtitleParam: true, nextEpisodeParams: true },
  notes:
    "PLAYER_EVENT + play/pause/seek/volume/mute/getStatus documented. Docs acknowledge two message schemas; only PLAYER_EVENT is trusted.",
  parseEvent(data, context) {
    return parsePlayerEventPayload(data, "vidcore", context);
  },
  buildCommand(command) {
    switch (command.command) {
      case "seek":
        return { command: "seek", time: Math.max(0, Math.floor(command.time)) };
      case "volume":
        return { command: "volume", level: Math.min(1, Math.max(0, command.level)) };
      case "mute":
        return { command: "mute", muted: command.muted === true };
      default:
        return { command: command.command };
    }
  },
};

/** VidRock — progress + events documented (§5.4–5.5); commands NOT documented. */
export const vidrockAdapter: ProviderAdapter = {
  id: "vidrock",
  name: "VidRock",
  origins: ["https://vidrock.net"],
  supportsCommands: false,
  capabilities: { commands: false, progress: true, subtitleParam: true, nextEpisodeParams: true },
  notes: "MEDIA_DATA + PLAYER_EVENT documented. No send-command API documented.",
  parseEvent(data, context) {
    return parsePlayerEventPayload(data, "vidrock", context);
  },
  buildCommand() {
    return null;
  },
};

/**
 * Ani.pm — direct postMessage protocol (§6.6).
 * Only used as an adapter for embed-mode playback (not the SDK instance).
 */
export const anipmAdapter: ProviderAdapter = {
  id: "anipm",
  name: "Ani.pm",
  origins: ["https://ani.pm"],
  supportsCommands: true,
  capabilities: { commands: true, progress: true, subtitleParam: true, nextEpisodeParams: true },
  notes: "Versioned postMessage protocol (ns=anipm.player, v=1). Refer to the SDK layer for full control.",
  parseEvent(data, context) {
    if (!isRecord(data) || data.ns !== "anipm.player" || data.v !== 1 || !isRecord(data.result)) {
      return null;
    }
    const state = data.result;
    const currentTime = readFiniteNumber(state.currentTime);
    const duration = readFiniteNumber(state.duration);
    const event: NormalizedPlayerEventName =
      state.paused === true || state.playing === false ? "pause" : "timeupdate";

    return {
      provider: "anipm",
      event,
      currentTime: currentTime !== null ? Math.max(0, currentTime) : null,
      duration: Math.max(0, readNonNegativeNumber(duration)),
      mediaType: "anime",
      mediaId: context.mediaId,
      season: null,
      episode: readPositiveInteger(state.episode),
    };
  },
  buildCommand(command) {
    const envelope = (cmd: string, args: Record<string, unknown>) => ({
      ns: "anipm.player" as const,
      v: 1 as const,
      id: Math.floor(Math.random() * 0x7fffffff),
      cmd,
      args,
    });

    switch (command.command) {
      case "play":
        return envelope("play", {});
      case "pause":
        return envelope("pause", {});
      case "seek":
        return envelope("seek", { time: Math.max(0, Math.floor(command.time)) });
      case "volume":
        return envelope("setVolume", { volume: Math.min(1, Math.max(0, command.level)) });
      case "mute":
        return envelope("setMuted", { muted: command.muted === true });
      case "getStatus":
        return envelope("getState", {});
      default:
        return null;
    }
  },
};

const ADAPTERS: Partial<Record<ProviderId, ProviderAdapter>> = {
  vidfast: vidfastAdapter,
  vidlink: vidlinkAdapter,
  vidcore: vidcoreAdapter,
  vidrock: vidrockAdapter,
  anipm: anipmAdapter,
};

export const getProviderAdapter = (providerId: string): ProviderAdapter | null => ADAPTERS[providerId] ?? null;

/**
 * Fallback adapter for providers without documented message APIs (custom
 * providers, vidfun, videasy, zxcstream, vidking…). No messages are trusted;
 * progress relies solely on the embed-URL start parameter and manual control.
 */
export const FALLBACK_ADAPTER: ProviderAdapter = {
  id: "generic",
  name: "Provider",
  origins: [],
  supportsCommands: false,
  capabilities: { commands: false, progress: false, subtitleParam: false, nextEpisodeParams: false },
  notes: "No documented message API. Messages from this source are not trusted.",
  parseEvent() {
    return null;
  },
  buildCommand() {
    return null;
  },
};

/**
 * Validates an inbound iframe message against the active embed.
 *
 * Returns the normalized event, or null when ANY check fails:
 *  1. `messageEvent.source` must be the iframe's contentWindow.
 *  2. `messageEvent.origin` must exactly match the origin the iframe was loaded from.
 *  3. The provider adapter must accept and parse the payload shape.
 */
export const validateAndNormalizeMessage = (
  messageEvent: MessageEvent,
  iframe: HTMLIFrameElement | null,
  context: PlayableMediaContext,
): NormalizedPlayerEvent | null => {
  if (!iframe?.contentWindow || messageEvent.source !== iframe.contentWindow) {
    return null;
  }

  const loadedOrigin = embedOrigin(iframe.src);
  if (!loadedOrigin || messageEvent.origin !== loadedOrigin) {
    return null;
  }

  const adapter = getProviderAdapter(context.provider) ?? FALLBACK_ADAPTER;
  return adapter.parseEvent(messageEvent.data, context);
};

/**
 * Sends a validated command to the running iframe.
 *
 * Returns false when the provider does not document commands — callers should
 * disable unsupported controls instead of sending wire noise the embed page
 * never interprets (which embedded scripts could intercept).
 */
export const sendProviderCommand = (
  iframe: HTMLIFrameElement | null,
  context: PlayableMediaContext,
  command: PlayerCommand,
): boolean => {
  if (!iframe?.contentWindow) {
    return false;
  }

  const adapter = getProviderAdapter(context.provider) ?? FALLBACK_ADAPTER;
  if (!adapter.supportsCommands) {
    return false;
  }

  const wire = adapter.buildCommand(command);
  if (!wire) {
    return false;
  }

  const targetOrigin = embedOrigin(iframe.src);
  if (!targetOrigin) {
    return false;
  }

  iframe.contentWindow.postMessage(wire, targetOrigin);
  return true;
};
