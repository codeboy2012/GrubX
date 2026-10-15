"use client";

/**
 * Live TV channel directory + electronic program guide.
 *
 * Data comes from `/api/live/epg`, which groups the provider's own sports
 * schedule into per-category "channels" with real start/end program windows.
 * Nothing is fabricated: a channel exists only if the provider reports live
 * events for it today, and empty/error states say exactly that.
 *
 * Favorites and recently-watched channels persist locally per device through
 * the same dataLayer used by My List / Continue Watching.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { LoaderCircle, RefreshCw, Radio, Star, History, X } from "lucide-react";

import { EmptyState } from "@/components/feedback/EmptyState";
import { FeatureGate } from "@/components/feedback/FeatureGate";
import { LoadingState } from "@/components/feedback/LoadingState";
import { cn } from "@/lib/cn";
import { dataLayer } from "@/lib/dataLayer";
import {
  currentProgram,
  formatProgramRange,
  nextProgram,
  programProgress,
  programState,
  relativeTimeLabel,
  visiblePrograms,
} from "@/lib/live/epg";
import type { EpgChannel, EpgProgram } from "@/types/live";

const FAVORITES_KEY = "grubx_live_favorites";

const readFavorites = (): string[] => {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(FAVORITES_KEY);
    return raw ? (JSON.parse(raw) as string[]).filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
};

const writeFavorites = (ids: string[]) => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids.slice(0, 24)));
  window.dispatchEvent(new CustomEvent("grubx:storage", { detail: { key: FAVORITES_KEY } }));
};

const stateBadgeClass: Record<string, string> = {
  live: "bg-red-500 text-white",
  past: "bg-black/40 text-[var(--muted)]",
  upcoming: "bg-white/10 text-white/86",
};

function ProgramChip({
  program,
  nowMs,
  onSelect,
  isHighlighted,
}: {
  program: EpgProgram;
  nowMs: number;
  onSelect?: (program: EpgProgram) => void;
  isHighlighted?: boolean;
}) {
  const state = programState(program, nowMs);
  return (
    <button
      type="button"
      onClick={onSelect ? () => onSelect(program) : undefined}
      className={cn(
        "group min-w-[190px] max-w-[280px] shrink-0 rounded-[1.05rem] border p-3 text-left transition sm:min-w-[230px]",
        state === "live" ? "border-red-400/40 bg-red-500/8" : "border-white/8 bg-white/[0.035]",
        state === "past" && "opacity-55",
        onSelect && "hover:border-white/20 hover:bg-white/[0.06] active:scale-[0.985]",
        isHighlighted && "ring-1 ring-[var(--accent)]",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em]", stateBadgeClass[state])}>
          {state === "live" ? "Live" : state === "past" ? "Ended" : "Upcoming"}
        </span>
        <span className="text-[11px] text-[var(--muted)]">{relativeTimeLabel(program.startAt, nowMs)}</span>
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-semibold leading-snug text-white">{program.title}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">{formatProgramRange(program)}</p>
      {state === "live" ? (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/15">
          <div className="h-full rounded-full bg-red-400" style={{ width: `${Math.round(programProgress(program, nowMs) * 100)}%` }} />
        </div>
      ) : null}
    </button>
  );
}

function ChannelRow({ channel, nowMs, onWatch }: { channel: EpgChannel; nowMs: number; onWatch: (channel: EpgChannel) => void }) {
  const now = currentProgram(channel, nowMs);
  const next = nextProgram(channel, nowMs);
  const upcoming = visiblePrograms(channel, nowMs).filter((program) => program.id !== now?.id);

  return (
    <article className="liquid-glass-soft rounded-[1.3rem] border border-white/8 p-4">
      <div className="flex items-center gap-3">
        <span className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-black">
          {channel.logoUrl ? (
            <Image src={channel.logoUrl} alt="" fill sizes="48px" unoptimized className="object-cover" />
          ) : (
            <Radio className="size-5 text-[var(--muted)]" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-semibold text-white">{channel.name}</h3>
          <p className="truncate text-xs text-[var(--muted)]">
            {now ? `Now: ${now.title}` : next ? `Next: ${next.title} ${relativeTimeLabel(next.startAt, nowMs)}` : "No programs in the guide window"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onWatch(channel)}
          disabled={!now}
          className={cn(
            "shrink-0 rounded-full px-4 py-2.5 text-sm font-bold transition active:scale-[0.98]",
            now ? "inline-flex items-center gap-2 bg-white text-black hover:brightness-95" : "cursor-not-allowed border border-white/10 bg-white/5 text-[var(--muted)]",
          )}
        >
          {now ? "Watch now" : "Offline"}
        </button>
      </div>

      {upcoming.length > 0 ? (
        <div className="scrollbar-hidden -mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1">
          {upcoming.slice(0, 8).map((program) => (
            <ProgramChip key={program.id} program={program} nowMs={nowMs} isHighlighted={program.id === next?.id} />
          ))}
        </div>
      ) : null}
    </article>
  );
}

export default function LiveGuidePage() {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [favorites, setFavorites] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [activeChannel, setActiveChannel] = useState<EpgChannel | null>(null);
  const recentLoaded = useRef(false);
  const recentChannels = useRef<Array<{ matchId: string; title: string }>>([]);

  // Ticking clock: guide stays accurate without polling the server more often
  // than needed (the query below already revalidates every 60s).
  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setFavorites(readFavorites());
    const onCustom = () => setFavorites(readFavorites());
    window.addEventListener("grubx:storage", onCustom);
    return () => window.removeEventListener("grubx:storage", onCustom);
  }, []);

  // Resume behavior: pull recently watched match ids and surface them first.
  useEffect(() => {
    if (recentLoaded.current) {
      return;
    }
    recentLoaded.current = true;
    void dataLayer.loadRecentLive().then((items) => {
      recentChannels.current = items.slice(0, 6).map((item) => ({ matchId: item.matchId, title: item.title }));
    });
  }, []);

  const guideQuery = useQuery({
    queryKey: ["live", "epg"],
    queryFn: async ({ signal }) => {
      const response = await fetch("/api/live/epg", { credentials: "same-origin", signal });
      if (!response.ok) {
        throw new Error((await response.json().catch(() => null))?.error ?? "The program guide is unavailable.");
      }
      return (await response.json()) as { generatedAt: string; channels: EpgChannel[] };
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const channels = useMemo(() => {
    const all = guideQuery.data?.channels ?? [];
    const filtered = query.trim().length > 0
      ? all.filter(
          (channel) =>
            channel.name.toLowerCase().includes(query.trim().toLowerCase()) ||
            channel.programs.some((program) => program.title.toLowerCase().includes(query.trim().toLowerCase())),
        )
      : all;
    // Favorites first, then most programs first.
    return [...filtered].sort((left, right) => {
      const leftFav = favorites.includes(left.id) ? 0 : 1;
      const rightFav = favorites.includes(right.id) ? 0 : 1;
      if (leftFav !== rightFav) {
        return leftFav - rightFav;
      }
      return right.programs.length - left.programs.length;
    });
  }, [guideQuery.data?.channels, favorites, query]);

  const toggleFavorite = (channelId: string) => {
    const next = favorites.includes(channelId) ? favorites.filter((id) => id !== channelId) : [...favorites, channelId];
    setFavorites(next);
    writeFavorites(next);
  };

  const closeOverlay = () => setActiveChannel(null);

  return (
    <FeatureGate feature="live">
      <div className="pb-14 md:pb-16">
        <section className="page-shell space-y-6 py-8 md:space-y-7 md:py-12">
          <div className="liquid-glass rounded-[2.1rem] px-5 py-5 md:px-6 md:py-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[var(--accent)]">Program guide</p>
                <h1 className="mt-2 text-4xl font-bold leading-none md:text-5xl">Live TV channels</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
                  Each “channel” is a real sports category from the live provider; programs are the provider’s own
                  scheduled events with actual start times. Times render in your local timezone.
                </p>
              </div>
              {guideQuery.isFetching ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-2 text-xs text-[var(--muted)]">
                  <LoaderCircle className="size-3.5 animate-spin" />
                  Updating guide
                </span>
              ) : null}
            </div>

            <div className="liquid-glass-soft mt-5 flex items-center gap-3 rounded-full px-5 py-4">
              <RefreshCw className="size-4 text-[var(--muted)]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search channels and programs"
                aria-label="Search channels and programs"
                className="w-full bg-transparent text-base text-white outline-none placeholder:text-[var(--muted)]"
              />
            </div>
          </div>

          {guideQuery.isPending ? (
            <LoadingState title="Loading the program guide" description="Fetching today’s schedule from the provider." />
          ) : guideQuery.isError ? (
            <div className="space-y-4">
              <EmptyState
                title="Program guide unavailable"
                description={
                  guideQuery.error instanceof Error
                    ? guideQuery.error.message
                    : "The guide provider could not be reached. Playback for movies, shows, anime, and manga is unaffected."
                }
              />
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => void guideQuery.refetch()}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-black transition hover:brightness-95"
                >
                  <RefreshCw className="size-4" />
                  Retry
                </button>
              </div>
            </div>
          ) : channels.length === 0 ? (
            <EmptyState
              title={query ? "No channels match" : "No programs right now"}
              description={
                query
                  ? "Try a different channel or program search."
                  : "The provider reports no live events for today yet. Channels appear here the moment events are scheduled."
              }
            />
          ) : (
            <div className="space-y-3">
              {channels.map((channel) => (
                <ChannelRow
                  key={channel.id}
                  channel={channel}
                  nowMs={nowMs}
                  onWatch={(target) => {
                    const program = currentProgram(target, Date.now());
                    if (program) {
                      setActiveChannel(target);
                    }
                  }}
                />
              ))}
            </div>
          )}

          {recentLoaded.current && recentChannels.current.length > 0 && !guideQuery.isPending ? (
            <div className="liquid-glass-soft rounded-[1.3rem] border border-white/8 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <History className="size-4 text-[var(--accent)]" />
                Recently watched events
              </div>
              <p className="mt-1 text-xs text-[var(--muted)]">Pick up where you left off; streams reopen with your last chosen source.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {recentChannels.current.map((entry) => (
                  <span key={entry.matchId} className="rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-xs text-[var(--muted)]">
                    {entry.title}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        {activeChannel ? (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 px-3 backdrop-blur-xl">
            <div className="liquid-glass relative z-[201] w-[min(96vw,720px)] rounded-[1.6rem] p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Channel schedule</p>
                  <h2 className="mt-1 text-2xl font-bold text-white">{activeChannel.name}</h2>
                </div>
                <button
                  type="button"
                  onClick={closeOverlay}
                  className="rounded-full border border-white/10 bg-black/45 p-2.5 text-[var(--muted)] transition hover:text-white"
                  aria-label="Close channel schedule"
                >
                  <X className="size-5" />
                </button>
              </div>
              <div className="mt-4 max-h-[55vh] space-y-2 overflow-y-auto pr-1">
                {activeChannel.programs.map((program) => {
                  const state = programState(program, nowMs);
                  return (
                    <div
                      key={program.id}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-[0.9rem] border px-4 py-3",
                        state === "live" ? "border-red-400/40 bg-red-500/8" : "border-white/8 bg-black/20",
                      )}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{program.title}</p>
                        <p className="text-xs text-[var(--muted)]">{formatProgramRange(program)}</p>
                      </div>
                      <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em]", stateBadgeClass[state])}>
                        {state === "live" ? "Live" : state === "past" ? "Ended" : "Soon"}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-[var(--muted)]">Favorites live on this device, like your watchlist.</span>
                <button
                  type="button"
                  onClick={() => toggleFavorite(activeChannel.id)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition",
                    favorites.includes(activeChannel.id)
                      ? "border-[var(--accent)] bg-[var(--accent-soft)] text-white"
                      : "border-white/10 bg-black/25 text-[var(--muted)] hover:text-white",
                  )}
                >
                  <Star className={cn("size-4", favorites.includes(activeChannel.id) && "fill-[var(--accent)] text-[var(--accent)]")} />
                  {favorites.includes(activeChannel.id) ? "Favorited" : "Add to favorites"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </FeatureGate>
  );
}
