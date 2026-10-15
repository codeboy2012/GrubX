import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));

const REMOVED_PATHS = [
  "app/(routes)/youtube",
  "app/(routes)/tiktok",
  "app/(routes)/spotify",
  "app/(routes)/ai",
  "app/api/youtube",
  "app/api/tiktok",
  "app/api/spotify",
  "components/external",
  "lib/youtube.ts",
  "lib/tiktok.ts",
  "lib/spotify.ts",
  "lib/externalProxy.ts",
  "types/external.ts",
  "types/spotify.ts",
  "hooks/useSpotifyWebPlayer.ts",
];

const RETAINED_PATHS = [
  "app/(routes)/movies/page.tsx",
  "app/(routes)/tv/page.tsx",
  "app/(routes)/anime/page.tsx",
  "app/(routes)/manga/page.tsx",
  "app/(routes)/manga/[id]/page.tsx",
  "app/(routes)/manga/[id]/[chapter]/page.tsx",
  "app/(routes)/live/page.tsx",
  "app/(routes)/mylist/page.tsx",
  "app/(routes)/search/page.tsx",
  "app/api/manga/route.ts",
  "app/api/tmdb/route.ts",
  "app/api/live/matches/route.ts",
];

describe("removed integrations stay removed", () => {
  it("has no pages, API routes, or modules left for YouTube, TikTok, Spotify, or the AI server", () => {
    for (const relativePath of REMOVED_PATHS) {
      expect(existsSync(join(root, relativePath)), relativePath).toBe(false);
    }
  });

  it("does not carry removed-integration settings keys any more", () => {
    const settingsSource = readFileSync(join(root, "lib/settings.ts"), "utf8");
    const settingsTypes = readFileSync(join(root, "types/settings.ts"), "utf8");

    expect(settingsTypes).not.toMatch(/youtube|tiktok|spotify|aiServer/i);
    expect(settingsSource).not.toMatch(/youtube|tiktok|spotify|aiServer/i);

    for (const removedKey of ["tiktokEmbedMode", "youtubeSafeSearch", "youtubeResultCount", "spotifyEmbedSize"]) {
      expect(settingsSource, removedKey).not.toContain(removedKey);
    }
  });

  it("keeps every retained route on disk", () => {
    for (const relativePath of RETAINED_PATHS) {
      expect(existsSync(join(root, relativePath)), relativePath).toBe(true);
    }
  });

  it("keeps the retained features linked from the navigation", () => {
    const navbar = readFileSync(join(root, "components/shell/Navbar.tsx"), "utf8");

    for (const href of ["/movies", "/tv", "/anime", "/manga", "/live", "/mylist", "/search", "/settings"]) {
      expect(navbar).toContain(`href: "${href}"`);
    }
    for (const href of ["/youtube", "/tiktok", "/spotify", "/ai"]) {
      expect(navbar).not.toContain(`href: "${href}"`);
    }
  });
});
