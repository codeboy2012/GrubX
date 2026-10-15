import { ANI_PM_API_BASE } from "@/lib/anime/embed";
import type { AnimeProviderStatus } from "@/types/anime";

/**
 * Ani.pm needs no API key, and its catalogue is documented as CORS-open, so the
 * same base URL is used from the browser and from the server. `NEXT_PUBLIC_` is
 * correct here because this is a public endpoint, never a credential.
 *
 * The server-side fetch to ani.pm is blocked in some networks (Cloudflare
 * challenges non-browser clients, and some TLS filters reject the runtime
 * handshake), so the browser path is tried first and `/api/anime` is the
 * fallback. Point `NEXT_PUBLIC_ANIME_API_BASE` at a self-hosted proxy to route
 * catalogue calls through your own infrastructure.
 */
export const resolveAnimeApiBase = (): string => {
  const configured = process.env.NEXT_PUBLIC_ANIME_API_BASE?.trim();
  const base = configured && configured.length > 0 ? configured : ANI_PM_API_BASE;
  return base.replace(/\/+$/, "");
};

/**
 * Static provider facts. Reported without a network call so the UI can always
 * explain how anime is sourced, even when the catalogue is unreachable.
 */
export const ANIME_PROVIDER_STATUS: AnimeProviderStatus = {
  provider: "anipm",
  label: "Ani.pm",
  configured: true,
  requiresKey: false,
  notes:
    "Ani.pm streams and subtitles are served by Ani.pm inside its own player frame and are never re-hosted by GrubX. The public catalogue needs no API key.",
};
