"use client";

import { useQuery } from "@tanstack/react-query";

import { AnimeCard } from "@/components/anime/AnimeCard";
import { useSettingsContext } from "@/context/SettingsContext";
import { getClientAnimeRecent, getClientAnimeTop } from "@/lib/anime/client";

/**
 * Homepage anime rails.
 *
 * Loaded on the client so a slow or unreachable anime catalogue can never block
 * the server-rendered homepage. A failure renders nothing instead of an empty
 * skeleton or fabricated content.
 */
export function AnimeHomeRails() {
  const { ready, settings } = useSettingsContext();
  const enabled = ready && settings.featureToggles.anime && settings.showTrendingRows;

  const trendingQuery = useQuery({
    queryKey: ["anime", "top", "week", null, "home"],
    enabled,
    staleTime: 1000 * 60 * 30,
    queryFn: ({ signal }) => getClientAnimeTop({ range: "week", limit: 18 }, signal),
  });

  const recentQuery = useQuery({
    queryKey: ["anime", "recent", "home"],
    enabled,
    staleTime: 1000 * 60 * 5,
    queryFn: ({ signal }) => getClientAnimeRecent({ limit: 18 }, signal),
  });

  if (!enabled) {
    return null;
  }

  const trending = trendingQuery.data ?? [];
  const recent = recentQuery.data ?? [];

  if (trending.length === 0 && recent.length === 0) {
    return null;
  }

  return (
    <div className="space-y-10 md:space-y-12">
      {trending.length > 0 ? (
        <Rail title="Trending Anime" description="What the Ani.pm catalogue is surfacing this week.">
          {trending.map((title) => (
            <div key={title.anilistId} className="w-[160px] shrink-0 sm:w-[184px] lg:w-[196px]">
              <AnimeCard anime={title} compact />
            </div>
          ))}
        </Rail>
      ) : null}

      {recent.length > 0 ? (
        <Rail title="Recently Updated Episodes" description="Newest episodes Ani.pm has added, with SUB and DUB flags.">
          {recent.map((entry) => (
            <div key={`${entry.anilistId}-${entry.episode}`} className="w-[160px] shrink-0 sm:w-[184px] lg:w-[196px]">
              <AnimeCard
                compact
                anime={{
                  anilistId: entry.anilistId,
                  malId: null,
                  title: entry.title,
                  nativeTitle: null,
                  format: `Episode ${entry.episode}`,
                  status: null,
                  year: null,
                  season: null,
                  score: null,
                  rating: null,
                  durationMinutes: null,
                  episodeCounts: {
                    total: entry.episode,
                    sub: entry.available.sub ? entry.episode : 0,
                    dub: entry.available.dub ? entry.episode : 0,
                  },
                  genres: [],
                  studios: [],
                  adult: false,
                  synopsis: entry.episodeTitle ?? "",
                  posterUrl: entry.posterUrl,
                  bannerUrl: null,
                  siteUrl: null,
                  embedUrl: entry.embedUrl,
                }}
              />
            </div>
          ))}
        </Rail>
      ) : null}
    </div>
  );
}

function Rail({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold md:text-3xl">{title}</h2>
        <p className="max-w-3xl text-sm leading-7 text-[var(--muted)]">{description}</p>
      </div>
      <div className="scrollbar-hidden -mx-[var(--shell-padding)] flex gap-[var(--card-gap)] overflow-x-auto px-[var(--shell-padding)] pb-5">
        {children}
      </div>
    </section>
  );
}
