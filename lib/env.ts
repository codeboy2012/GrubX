/**
 * Centralized environment configuration.
 *
 * Rules this module enforces:
 * - Nothing throws at import time. A missing key must never crash an unrelated
 *   route or the production build; the error is raised only when the feature
 *   that needs the key actually runs.
 * - Server-only values are read from non-public names first (`TMDB_API_KEY`),
 *   falling back to the older `NEXT_PUBLIC_*` names for compatibility. A
 *   credential must not be public, and the fallback exists only so existing
 *   deployments keep working.
 *
 * See docs/ENVIRONMENT.md for the full variable reference.
 */

export type EnvIssue = {
  variable: string;
  message: string;
  hint: string;
};

export class ConfigError extends Error {
  readonly variable: string;
  readonly hint: string;

  constructor({ variable, message, hint }: EnvIssue) {
    super(`${message} (${variable})`);
    this.name = "ConfigError";
    this.variable = variable;
    this.hint = hint;
  }
}

/** Reads a server-side variable, trimmed, ignoring empty strings. */
export const readServerEnv = (name: string): string | undefined => {
  const value = process.env[name];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
};

/** First defined value wins; used for the public/secret name migration. */
const firstDefined = (...values: Array<string | undefined>) => values.find((value) => value !== undefined);

const requireValue = (variable: string, value: string | undefined, message: string, hint: string) => {
  if (!value) {
    throw new ConfigError({ variable, message, hint });
  }
  return value;
};

export const tmdbConfig = {
  /**
   * Base URL of the TMDB-compatible proxy. `TMDB_PROXY_BASE` is the preferred
   * server-side name; the `NEXT_PUBLIC_` form is still honoured.
   */
  get proxyBase(): string {
    const value = firstDefined(
      readServerEnv("TMDB_PROXY_BASE"),
      readServerEnv("NEXT_PUBLIC_TMDB_PROXY_BASE"),
    );
    return requireValue(
      "TMDB_PROXY_BASE",
      value,
      "The TMDB proxy base URL is not configured",
      "Set TMDB_PROXY_BASE (or NEXT_PUBLIC_TMDB_PROXY_BASE) in .env — see docs/ENVIRONMENT.md.",
    ).replace(/\/+$/, "");
  },

  /**
   * TMDB API key. Used only by server-side code; it is never sent to the
   * browser and never placed in a client bundle.
   */
  get apiKey(): string {
    const value = firstDefined(readServerEnv("TMDB_API_KEY"), readServerEnv("NEXT_PUBLIC_TMDB_API_KEY"));
    return requireValue(
      "TMDB_API_KEY",
      value,
      "The TMDB API key is not configured",
      "Set TMDB_API_KEY in .env (server-side only). The legacy NEXT_PUBLIC_TMDB_API_KEY name still works but is visible to the browser.",
    );
  },
};

export const isTmdbConfigured = () =>
  Boolean(
    firstDefined(readServerEnv("TMDB_PROXY_BASE"), readServerEnv("NEXT_PUBLIC_TMDB_PROXY_BASE")) &&
      firstDefined(readServerEnv("TMDB_API_KEY"), readServerEnv("NEXT_PUBLIC_TMDB_API_KEY")),
  );

/** Optional movie/TV embed provider base. */
export const getVidkingBase = () =>
  readServerEnv("NEXT_PUBLIC_VIDKING_BASE") ?? "https://www.vidking.net/embed";

/** Ani.pm catalogue base; the public endpoint needs no credential. */
export const getAnimeApiBase = () =>
  readServerEnv("NEXT_PUBLIC_ANIME_API_BASE") ?? "https://ani.pm/api/partner/v1";

/** MangaDex-compatible base; the public read API needs no credential. */
export const getMangaApiBase = () =>
  readServerEnv("NEXT_PUBLIC_MANGA_API_BASE") ?? "https://api.mangadex.org";

/** Optional admin alert webhook (server-side only). */
export const getMatrixWebhookUrl = () => readServerEnv("MATRIX_HOOKSHOT_WEBHOOK_URL");

/**
 * Legacy shape kept so existing imports keep working. Prefer `tmdbConfig`.
 */
export const env = {
  get tmdbProxyBase() {
    return tmdbConfig.proxyBase;
  },
  get tmdbApiKey() {
    return tmdbConfig.apiKey;
  },
  get vidkingBase() {
    return getVidkingBase();
  },
};
