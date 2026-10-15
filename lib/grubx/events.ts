import type { GrubXEventName, GrubXEventPayload } from "@/types/grubx";

/**
 * Registrable-domain allowlist for cross-window messages.
 *
 * provider embeds (`lib/grubx/providers.ts`) and the Ani.pm anime embed are
 * the only senders whose playback events GrubX consumes. Because providers
 * rotate subdomains freely, matching uses the registrable domain (suffix over
 * `vidking.net`, not one host), which is still far stricter than the previous
 * behavior of accepting every origin. Custom providers configured by the user
 * extend the list per deployment via `extraDomains`.
 */
export const GRUBX_EVENT_ORIGIN_DOMAINS = [
  "vidfast.pro",
  "vidking.net",
  "vidfast.in",
  "vidfast.io",
  "vidfast.me",
  "vidfast.net",
  "vidfast.pm",
  "vidfast.xyz",
  "vidcore.net",
  "vidlink.pro",
  "vidfun.pro",
  "vidrock.net",
  "videasy.net",
  "zxcstream.xyz",
  "ani.pm",
] as const;

const matchesTrustedDomain = (hostname: string, domains: readonly string[]) =>
  domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));

export const isAllowedGrubxEventOrigin = (origin: string, extraDomains: readonly string[] = []) => {
  if (origin === "null") {
    return false;
  }
  try {
    const { protocol, hostname } = new URL(origin);
    const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
    if (protocol !== "https:" && !isLocal) {
      return false;
    }
    if (isLocal) {
      return true;
    }
    return matchesTrustedDomain(hostname, [...GRUBX_EVENT_ORIGIN_DOMAINS, ...extraDomains]);
  } catch {
    return false;
  }
};

export const GRUBX_EVENT_NAME = "grubx:event";

export const GRUBX_SUPPORTED_EVENTS = new Set<GrubXEventName>([
  "play",
  "pause",
  "seeked",
  "ended",
  "timeupdate",
  "mediaReady",
  "providerSwitch",
  "popupToggle",
]);

export const isGrubXEventPayload = (payload: unknown): payload is GrubXEventPayload => {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as Partial<GrubXEventPayload>;
  return (
    candidate.type === "GRUBX_EVENT" &&
    typeof candidate.provider === "string" &&
    typeof candidate.data?.event === "string" &&
    GRUBX_SUPPORTED_EVENTS.has(candidate.data.event as GrubXEventName)
  );
};

export const dispatchGrubXEvent = (payload: GrubXEventPayload) => {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent<GrubXEventPayload>(GRUBX_EVENT_NAME, { detail: payload }));
};

export const registerGrubXEventBridge = (
  onEvent?: (payload: GrubXEventPayload) => void,
  options: { extraDomains?: readonly string[] } = {},
) => {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const onMessage = (event: MessageEvent) => {
    if (!isAllowedGrubxEventOrigin(event.origin, options.extraDomains)) {
      return;
    }
    if (!isGrubXEventPayload(event.data)) {
      return;
    }

    dispatchGrubXEvent(event.data);
    onEvent?.(event.data);
  };

  window.addEventListener("message", onMessage);
  return () => window.removeEventListener("message", onMessage);
};

export const subscribeToGrubXEvents = (listener: (payload: GrubXEventPayload) => void) => {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const onEvent = (event: Event) => listener((event as CustomEvent<GrubXEventPayload>).detail);
  window.addEventListener(GRUBX_EVENT_NAME, onEvent);
  return () => window.removeEventListener(GRUBX_EVENT_NAME, onEvent);
};
