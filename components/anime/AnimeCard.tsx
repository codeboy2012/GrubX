"use client";

import Image from "next/image";
import Link from "next/link";
import { Play, Star } from "lucide-react";

import { useSettingsContext } from "@/context/SettingsContext";
import { cn } from "@/lib/cn";
import type { AnimeTitle } from "@/types/anime";

/**
 * Anime poster card. Anime identifiers are AniList/MyAnimeList ids from Ani.pm,
 * never TMDB ids, and the card links to the anime route accordingly.
 */
export function AnimeCard({
  anime,
  progress,
  compact = false,
}: {
  anime: AnimeTitle;
  progress?: number | null;
  compact?: boolean;
}) {
  const { settings } = useSettingsContext();
  const imageWidth = settings.posterQuality === "high" ? "w500" : "w342";
  const year = anime.year ? Math.trunc(anime.year) : null;

  return (
    <article className="group relative flex h-full w-full flex-col transition-transform duration-300 hover:-translate-y-1 active:scale-[0.985]">
      <Link
        href={`/anime/${anime.anilistId}`}
        prefetch={settings.prefetchRoutes && !settings.lowBandwidthMode}
        className={cn(
          "relative flex h-full flex-col overflow-hidden rounded-[var(--card-radius)] border border-white/8 bg-white/[var(--panel-opacity,0.035)]",
          compact ? "p-2.5" : "p-3",
        )}
      >
        <div className="relative block aspect-[2/3] w-full overflow-hidden rounded-[var(--poster-radius)] border border-white/8 bg-black">
          <Image
            src={anime.posterUrl ?? "/512x512.png"}
            alt={anime.title}
            fill
            sizes="(max-width: 640px) 180px, (max-width: 1024px) 230px, 260px"
            loading="lazy"
            // Provider-hosted covers are absolute URLs; `unoptimized` avoids
            // re-encoding third-party art through our image pipeline.
            unoptimized
            className="object-cover transition duration-500 group-hover:scale-[1.045]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/78 via-black/12 to-transparent opacity-90" />

          <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-3 text-xs text-[var(--muted)]">
            <span className="rounded-full border border-white/10 bg-black/58 px-2.5 py-1 uppercase tracking-[0.16em] text-white/82 backdrop-blur-md">
              anime
            </span>
            {anime.episodeCounts.dub > 0 ? (
              <span className="rounded-full border border-white/10 bg-black/58 px-2.5 py-1 backdrop-blur-md">DUB</span>
            ) : null}
          </div>

          {progress && progress > 0 ? (
            <div className="absolute inset-x-3 bottom-3 h-1.5 overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${Math.min(100, progress)}%` }} />
            </div>
          ) : null}

          <div className="absolute inset-x-0 bottom-0 p-3 opacity-0 transition duration-300 group-hover:opacity-100">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-bold text-black shadow-[0_12px_30px_rgba(0,0,0,0.32)]">
              <Play className="size-3.5 fill-current" />
              Open
            </span>
          </div>
        </div>

        <div className={cn("flex flex-1 flex-col px-0.5 pb-0.5", compact ? "gap-2 pt-3" : "gap-2.5 pt-3.5")}>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
            {settings.showRatings && anime.score ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/28 px-2.5 py-1">
                <Star className="size-3 fill-[var(--accent)] text-[var(--accent)]" />
                {anime.score.toFixed(1)}
              </span>
            ) : null}
            {settings.showReleaseYear && year ? (
              <span className="rounded-full border border-white/10 bg-black/28 px-2.5 py-1">{year}</span>
            ) : null}
            {anime.format ? (
              <span className="rounded-full border border-white/10 bg-black/28 px-2.5 py-1">{anime.format}</span>
            ) : null}
          </div>

          <h3 className="line-clamp-2 text-base font-semibold leading-tight text-white">{anime.title}</h3>

          {settings.showCardMetadata ? (
            <p className="text-xs text-[var(--muted)]">
              {anime.episodeCounts.sub > 0
                ? `${anime.episodeCounts.sub} episode${anime.episodeCounts.sub === 1 ? "" : "s"} sub`
                : "Episode list pending"}
              {anime.episodeCounts.dub > 0 ? ` · ${anime.episodeCounts.dub} dub` : ""}
            </p>
          ) : null}
        </div>
      </Link>
    </article>
  );
}
