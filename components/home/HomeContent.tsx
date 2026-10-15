"use client";

import { Info } from "lucide-react";

import { AnimeHomeRails } from "@/components/anime/AnimeHomeRails";
import { HeroCarousel } from "@/components/hero/HeroCarousel";
import { MediaRow } from "@/components/media/MediaRow";
import { HomeRecommendations } from "@/components/recommendations/HomeRecommendations";
import { ContinueWatchingRow } from "@/components/user/ContinueWatchingRow";
import { WatchlistRow } from "@/components/user/WatchlistRow";
import { useSettingsContext } from "@/context/SettingsContext";
import type { MediaItem } from "@/types/media";

export function HomeContent({
  hero,
  popularMovies,
  popularTv,
  topRatedMovies,
  catalogueAvailable = true,
}: {
  hero: MediaItem[];
  popularMovies: MediaItem[];
  popularTv: MediaItem[];
  topRatedMovies: MediaItem[];
  /** False when TMDB returned nothing for any row. */
  catalogueAvailable?: boolean;
}) {
  const { settings } = useSettingsContext();

  return (
    <div className="space-y-10 pb-14 md:space-y-12">
      {settings.showHomeHero && hero.length > 0 ? <HeroCarousel items={hero.slice(0, 5)} /> : null}

      <div className="page-shell space-y-10 md:space-y-12">
        {!catalogueAvailable ? (
          <section className="liquid-glass-soft flex items-start gap-3 rounded-[1.1rem] px-5 py-4">
            <Info className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-white">Movie and TV metadata is unavailable</p>
              <p className="text-sm leading-6 text-[var(--muted)]">
                The TMDB provider is either not configured on this server or not responding, so the movie and TV rows
                are empty. Anime, Manga, Live TV, My List, and Continue Watching still work. Set{" "}
                <code className="text-white">TMDB_API_KEY</code> and <code className="text-white">TMDB_PROXY_BASE</code>{" "}
                to enable movies and TV — see <code className="text-white">docs/ENVIRONMENT.md</code>.
              </p>
            </div>
          </section>
        ) : null}

        {settings.featureToggles.continueWatching ? <ContinueWatchingRow /> : null}
        {settings.featureToggles.watchlist ? <WatchlistRow /> : null}

        <HomeRecommendations />

        {settings.showTrendingRows ? (
          <>
            {hero.length > 1 ? (
              <MediaRow
                title="Trending Now"
                description="Fresh picks people are opening tonight."
                items={hero.slice(1, 9)}
              />
            ) : null}
            <AnimeHomeRails />
            {popularMovies.length > 0 ? (
              <MediaRow
                title="Popular Movies"
                description="Big-screen films with momentum."
                items={popularMovies.slice(0, 10)}
              />
            ) : null}
            {popularTv.length > 0 ? (
              <MediaRow title="Popular TV" description="Series worth adding to your queue." items={popularTv.slice(0, 10)} />
            ) : null}
            {topRatedMovies.length > 0 ? (
              <MediaRow
                title="Top Rated"
                description="Critic and audience favorites with staying power."
                items={topRatedMovies.slice(0, 10)}
              />
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
