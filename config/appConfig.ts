import { GRUBX_PROVIDERS } from "@/lib/grubx/providers";

export const appConfig = {
  SAFE_MODE: true,
  providers: GRUBX_PROVIDERS,
  /**
   * Hosts the safe-browsing guard treats as expected destinations.
   *
   * The youtube.com entries are for trailer playback only: TMDB serves its
   * trailer catalogue through YouTube, and "Watch trailer" opens that link. No
   * YouTube account, search, or feed integration exists in GrubX.
   */
  whitelist: [
    "localhost",
    "127.0.0.1",
    "grubx.local",
    "youtube.com",
    "www.youtube.com",
    "youtu.be",
    "youtube-nocookie.com",
    "www.youtube-nocookie.com",
    "api.mangadex.org",
    "uploads.mangadex.org",
    "ani.pm",
    "mtd.sky0cloud.dpdns.org",
  ],
  featureFlags: {
    recommendations: true,
    liveSports: true,
    customProviders: true,
  },
} as const;
