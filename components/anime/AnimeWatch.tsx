"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Gauge,
  ListVideo,
  Maximize2,
  MonitorPlay,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
} from "lucide-react";

import { EmptyState } from "@/components/feedback/EmptyState";
import { useSettingsContext } from "@/context/SettingsContext";
import { cn } from "@/lib/cn";
import { buildAnimeEmbedUrl, hasAnimeLanguage, normalizeAnimeLanguage } from "@/lib/anime/embed";
import { createAnimePlayer, type AnimePlayerInstance, type AnimePlayerState } from "@/lib/anime/player";
import { dataLayer } from "@/lib/dataLayer";
import { queryKeys } from "@/lib/queryKeys";
import type { AnimeLanguage, AnimeSeries } from "@/types/anime";

/**
 * Anime playback.
 *
 * The documented Ani.pm player is served by Ani.pm itself; GrubX never proxies
 * or re-hosts the stream. When the SDK is available we drive it and show our own
 * controls; when it is not, the frame falls back to Ani.pm's own controls and
 * GrubX hides every control it cannot actually operate.
 */

const SAVE_INTERVAL_MS = 15_000;
const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2];

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "0:00";
  }
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`
    : `${minutes}:${String(rest).padStart(2, "0")}`;
};

export function AnimeWatch({
  series,
  episodeNumber,
  language,
  onSelectEpisode,
}: {
  series: AnimeSeries;
  episodeNumber: number;
  language: AnimeLanguage;
  onSelectEpisode: (episode: number, language: AnimeLanguage) => void;
}) {
  const { ready } = useSettingsContext();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<AnimePlayerInstance | null>(null);
  const lastSavedRef = useRef<number>(0);
  const stateRef = useRef<AnimePlayerState | null>(null);

  const [sdkStatus, setSdkStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const [playerState, setPlayerState] = useState<AnimePlayerState | null>(null);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [subtitleTrack, setSubtitleTrack] = useState<string>("off");
  const [episodePanelOpen, setEpisodePanelOpen] = useState(false);
  /**
   * The resume offset is resolved *before* the player mounts and then held in a
   * ref, so a late progress read can never tear down and rebuild a live player.
   * Rebuilding is what used to restart playback and could wedge the SDK.
   */
  const resumeStartRef = useRef(0);
  const resumeAppliedRef = useRef(false);

  const episode = useMemo(
    () => series.episodes.find((entry) => entry.number === episodeNumber) ?? null,
    [episodeNumber, series.episodes],
  );

  const languageAvailable = episode ? hasAnimeLanguage(episode, language) : false;
  const canPlay = Boolean(episode && (episode.available.sub || episode.available.dub));
  const resolvedLanguage: AnimeLanguage = languageAvailable
    ? language
    : episode?.available.sub
      ? "sub"
      : episode?.available.dub
        ? "dub"
        : language;

  const previousEpisode = useMemo(
    () =>
      [...series.episodes].filter((entry) => entry.number < episodeNumber).sort((a, b) => b.number - a.number)[0] ?? null,
    [episodeNumber, series.episodes],
  );

  const nextEpisode = useMemo(
    () => [...series.episodes].filter((entry) => entry.number > episodeNumber).sort((a, b) => a.number - b.number)[0] ?? null,
    [episodeNumber, series.episodes],
  );

  const progressQuery = useQuery({
    queryKey: queryKeys.progress(String(series.anilistId)),
    queryFn: () => dataLayer.getPlaybackProgress(String(series.anilistId)),
    enabled: ready,
    staleTime: 1000 * 30,
  });

  /**
   * The player is only mounted once the saved position is known (or its read has
   * finished), so the very first frame already starts in the right place.
   */
  const resumeResolved = !ready || progressQuery.isSuccess || progressQuery.isError;

  /**
   * Resume position for this exact episode only. A saved position from another
   * episode must never be applied to the episode the viewer just opened.
   */
  resumeStartRef.current = (() => {
    const progress = progressQuery.data;
    if (!progress || progress.episode !== episodeNumber) {
      return 0;
    }
    if (progress.progress >= 95 || progress.duration <= 0) {
      return 0;
    }
    return Math.max(0, Math.floor(progress.currentTime));
  })();

  const episodeRef = useRef(episode);
  episodeRef.current = episode;
  const selectEpisodeRef = useRef(onSelectEpisode);
  selectEpisodeRef.current = onSelectEpisode;
  const nextEpisodeRef = useRef(nextEpisode);
  nextEpisodeRef.current = nextEpisode;

  const persistProgress = useCallback(
    (state: AnimePlayerState | null, force = false) => {
      const currentEpisode = episodeRef.current;
      if (!state || !ready || !currentEpisode) {
        return;
      }

      const duration = state.duration;
      // Only a plausible, fully-realized playback window is ever recorded. A
      // zero-duration or out-of-range update would poison Continue Watching.
      if (!Number.isFinite(duration) || duration < 30 || state.currentTime < 0 || state.currentTime > duration) {
        return;
      }

      const now = Date.now();
      if (!force && now - lastSavedRef.current < SAVE_INTERVAL_MS) {
        return;
      }
      lastSavedRef.current = now;

      const percent = (state.currentTime / duration) * 100;
      void dataLayer.savePlaybackProgress({
        mediaId: String(series.anilistId),
        mediaType: "anime",
        title: series.title,
        posterPath: series.posterUrl,
        backdropPath: series.bannerUrl,
        season: null,
        episode: currentEpisode.number,
        chapterId: null,
        currentTime: state.currentTime,
        duration,
        progress: Math.min(100, Math.max(0, Math.round(percent))),
      });
    },
    [ready, series.anilistId, series.bannerUrl, series.posterUrl, series.title],
  );
  const persistRef = useRef(persistProgress);
  persistRef.current = persistProgress;

  /**
   * Rewinds to the saved position once, after the frame reports readiness.
   * Documented `start` is passed at construction too, but the seek is the part
   * GrubX can rely on regardless of how the SDK maps its options.
   */
  const applyResume = useCallback((instance: AnimePlayerInstance, state: AnimePlayerState) => {
    const target = resumeStartRef.current;
    if (resumeAppliedRef.current || target <= 0 || state.currentTime > 5) {
      return;
    }
    resumeAppliedRef.current = true;
    instance.seek(target);
  }, []);

  useEffect(() => {
    // Mounting waits for the saved position, and one create/destroy pair is
    // pinned to one episode: dependencies below never include read results.
    if (!canPlay || !resumeResolved || !containerRef.current) {
      return;
    }

    // React 19 StrictMode mounts effects twice in development; this guard keeps a
    // single live player instance per episode.
    if (playerRef.current) {
      return;
    }

    let cancelled = false;
    let player: AnimePlayerInstance | null = null;
    lastSavedRef.current = 0;
    resumeAppliedRef.current = false;
    setPlayerError(null);
    setPlayerState(null);
    setSdkStatus("loading");

    void createAnimePlayer({
      container: containerRef.current,
      anilistId: series.anilistId,
      episode: episodeNumber,
      lang: resolvedLanguage,
      autoplay: true,
      autoNext: false,
      start: resumeStartRef.current,
    }).then((instance) => {
      if (cancelled) {
        instance?.destroy();
        return;
      }

      if (!instance) {
        setSdkStatus("unavailable");
        return;
      }

      player = instance;
      playerRef.current = instance;
      setSdkStatus("ready");

      instance.on("ready", (state) => {
        setPlayerState(state);
        applyResume(instance, state);
      });
      instance.on("loaded", (state) => {
        setPlayerState(state);
        applyResume(instance, state);
      });
      instance.on("play", (state) => {
        setPlayerState(state);
        applyResume(instance, state);
      });
      instance.on("pause", (state) => {
        setPlayerState(state);
        persistRef.current(state, true);
      });
      instance.on("playing", (state) => {
        setPlayerState(state);
        applyResume(instance, state);
      });
      instance.on("timeupdate", (state) => {
        stateRef.current = state;
        setPlayerState(state);
        persistRef.current(state);
      });
      instance.on("seeking", (state) => setPlayerState(state));
      instance.on("seeked", (state) => setPlayerState(state));
      instance.on("volumechange", (state) => setPlayerState(state));
      instance.on("ratechange", (state) => setPlayerState(state));
      instance.on("qualitychange", (state) => setPlayerState(state));
      instance.on("subtitlechange", (state) => setPlayerState(state));
      instance.on("languagechange", (state) => setPlayerState(state));
      instance.on("episodechange", (state) => {
        setPlayerState(state);
        persistRef.current(state, true);
        if (state.episode && state.episode !== episodeNumber) {
          selectEpisodeRef.current(state.episode, resolvedLanguage);
        }
      });
      instance.on("error", (_state, error) => {
        setPlayerError(error?.message ?? "The player reported a problem for this episode.");
      });
    });

    return () => {
      cancelled = true;
      persistRef.current(stateRef.current, true);
      player?.destroy();
      playerRef.current = null;
      stateRef.current = null;
    };
  }, [applyResume, canPlay, episodeNumber, resolvedLanguage, resumeResolved, series.anilistId]);

  // A last-chance save when the tab is hidden or the viewer navigates away.
  useEffect(() => {
    const flush = () => persistRef.current(stateRef.current, true);
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", flush);
    };
  }, []);

  const controlsEnabled = sdkStatus === "ready" && Boolean(playerRef.current);

  const seekBy = (seconds: number) => playerRef.current?.seekBy(seconds);
  const togglePlay = () => playerRef.current?.togglePlay();

  useEffect(() => {
    if (!controlsEnabled) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }

      switch (event.key) {
        case " ":
        case "k":
          event.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          event.preventDefault();
          seekBy(-10);
          break;
        case "ArrowRight":
          event.preventDefault();
          seekBy(10);
          break;
        case "m":
          playerRef.current?.setMuted(!(playerState?.muted ?? false));
          break;
        case "f":
          playerRef.current?.requestFullscreen();
          break;
        case "n":
          if (nextEpisodeRef.current) {
            selectEpisodeRef.current(nextEpisodeRef.current.number, resolvedLanguage);
          }
          break;
        case "p":
          if (previousEpisode) {
            selectEpisodeRef.current(previousEpisode.number, resolvedLanguage);
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [controlsEnabled, playerState?.muted, previousEpisode, resolvedLanguage]);

  const embedUrl = buildAnimeEmbedUrl(series.anilistId, {
    episode: episodeNumber,
    lang: resolvedLanguage,
    autoplay: true,
    start: resumeStartRef.current,
  });

  if (!episode) {
    return (
      <EmptyState
        title="Episode not listed"
        description={`Ani.pm's catalogue does not list episode ${episodeNumber} for this title.`}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div
        className={cn(
          "relative overflow-hidden rounded-[1.25rem] border bg-black",
          playerError ? "border-red-500/40" : "border-white/10",
        )}
      >
        <div className="relative aspect-video w-full">
          {canPlay && resumeResolved ? (
            <div ref={containerRef} className="absolute inset-0 h-full w-full" />
          ) : canPlay ? (
            // The frame stays empty until the saved position is known, so the
            // player never has to be rebuilt (which would restart playback).
            <div className="absolute inset-0" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
              <div>
                <p className="text-lg font-semibold text-white">No stream listed for episode {episode.number}</p>
                <p className="mt-2 max-w-xl text-sm text-[var(--muted)]">
                  Ani.pm reports no SUB or DUB version for this episode, so there is nothing to play. Nothing is
                  substituted in its place.
                </p>
                <a
                  href={`https://ani.pm/ani/${series.anilistId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white"
                >
                  Check on Ani.pm
                </a>
              </div>
            </div>
          )}

          {canPlay && sdkStatus === "loading" ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <p className="text-sm text-[var(--muted)]">
                {resumeResolved ? "Starting the Ani.pm player…" : "Restoring your saved position…"}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {canPlay && sdkStatus === "unavailable" && embedUrl ? (
        <div className="space-y-3">
          <p className="text-xs text-[var(--muted)]">
            The Ani.pm player SDK could not load, so this episode is shown in Ani.pm&rsquo;s own frame with its own
            controls. GrubX will not present controls it cannot operate.
          </p>
          <iframe
            src={embedUrl}
            title={`${series.title} episode ${episodeNumber}`}
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media; screen-wake-lock"
            allowFullScreen
            referrerPolicy="origin"
            className="aspect-video w-full rounded-[1.25rem] border border-white/10 bg-black"
          />
        </div>
      ) : null}

      {playerError ? (
        <p className="rounded-2xl border border-red-500/30 bg-red-500/8 px-4 py-3 text-sm text-red-200">{playerError}</p>
      ) : null}

      {controlsEnabled && playerState ? (
        <div className="liquid-glass-soft space-y-4 rounded-[1.25rem] px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="w-14 text-right text-xs tabular-nums text-[var(--muted)]">
              {formatTime(playerState.currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={Math.max(1, Math.floor(playerState.duration))}
              value={Math.min(Math.floor(playerState.currentTime), Math.max(1, Math.floor(playerState.duration)))}
              onChange={(event) => playerRef.current?.seek(Number(event.target.value))}
              aria-label="Seek"
              className="h-1.5 w-full appearance-none rounded-full bg-white/15 accent-[var(--accent)]"
            />
            <span className="w-14 text-xs tabular-nums text-[var(--muted)]">{formatTime(playerState.duration)}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => (previousEpisode ? onSelectEpisode(previousEpisode.number, resolvedLanguage) : undefined)}
              disabled={!previousEpisode}
              aria-label="Previous episode"
              className="inline-flex size-11 items-center justify-center rounded-full border border-white/12 disabled:opacity-35"
            >
              <ChevronLeft className="size-4" />
            </button>

            <button
              type="button"
              onClick={() => seekBy(-10)}
              aria-label="Back 10 seconds"
              className="inline-flex size-11 items-center justify-center rounded-full border border-white/12"
            >
              <RotateCcw className="size-4" />
            </button>

            <button
              type="button"
              onClick={togglePlay}
              aria-label={playerState.paused ? "Play" : "Pause"}
              className="inline-flex size-12 items-center justify-center rounded-full bg-white text-black"
            >
              {playerState.paused ? <Play className="size-5 fill-current" /> : <Pause className="size-5 fill-current" />}
            </button>

            <button
              type="button"
              onClick={() => seekBy(10)}
              aria-label="Forward 10 seconds"
              className="inline-flex size-11 items-center justify-center rounded-full border border-white/12"
            >
              <RotateCw className="size-4" />
            </button>

            <button
              type="button"
              onClick={() => (nextEpisode ? onSelectEpisode(nextEpisode.number, resolvedLanguage) : undefined)}
              disabled={!nextEpisode}
              aria-label="Next episode"
              className="inline-flex size-11 items-center justify-center rounded-full border border-white/12 disabled:opacity-35"
            >
              <ChevronRight className="size-4" />
            </button>

            <button
              type="button"
              onClick={() => playerRef.current?.setMuted(!playerState.muted)}
              aria-label={playerState.muted ? "Unmute" : "Mute"}
              className="inline-flex size-11 items-center justify-center rounded-full border border-white/12"
            >
              {playerState.muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </button>

            <label className="flex items-center gap-2 rounded-full border border-white/12 px-3 py-2 text-xs text-[var(--muted)]">
              <Gauge className="size-4" />
              <span className="sr-only">Playback speed</span>
              <select
                value={playerState.rate}
                onChange={(event) => playerRef.current?.setPlaybackRate(Number(event.target.value))}
                className="bg-transparent text-xs text-white outline-none"
              >
                {PLAYBACK_RATES.map((rate) => (
                  <option key={rate} value={rate} className="bg-black">
                    {rate}x
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2 rounded-full border border-white/12 px-3 py-2 text-xs text-[var(--muted)]">
              <span className="sr-only">Subtitles</span>
              <select
                value={subtitleTrack}
                onChange={(event) => {
                  setSubtitleTrack(event.target.value);
                  playerRef.current?.setSubtitles(event.target.value);
                }}
                className="bg-transparent text-xs text-white outline-none"
              >
                <option value="off" className="bg-black">
                  Subtitles off
                </option>
                <option value="auto" className="bg-black">
                  Default track
                </option>
              </select>
            </label>

            <button
              type="button"
              onClick={() => playerRef.current?.setTheater(true)}
              aria-label="Theater mode"
              className="inline-flex size-11 items-center justify-center rounded-full border border-white/12"
            >
              <MonitorPlay className="size-4" />
            </button>

            <button
              type="button"
              onClick={() => playerRef.current?.requestFullscreen()}
              aria-label="Fullscreen"
              className="inline-flex size-11 items-center justify-center rounded-full border border-white/12"
            >
              <Maximize2 className="size-4" />
            </button>

            <button
              type="button"
              onClick={() => setEpisodePanelOpen((current) => !current)}
              aria-expanded={episodePanelOpen}
              className="ml-auto inline-flex items-center gap-2 rounded-full border border-white/12 px-4 py-2.5 text-xs font-semibold text-white"
            >
              <ListVideo className="size-4" />
              Episodes
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {(["sub", "dub"] as AnimeLanguage[]).map((option) => {
          const available = hasAnimeLanguage(episode, option);
          return (
            <button
              key={option}
              type="button"
              disabled={!available}
              onClick={() => onSelectEpisode(episodeNumber, option)}
              title={available ? `Switch to ${option.toUpperCase()}` : `Ani.pm reports no ${option.toUpperCase()} for this episode`}
              className={cn(
                "rounded-full border px-4 py-2.5 text-xs font-bold uppercase tracking-[0.18em] transition",
                resolvedLanguage === option
                  ? "border-white/18 bg-white text-black"
                  : "border-white/10 bg-white/6 text-[var(--muted)] hover:text-white",
                !available && "cursor-not-allowed opacity-40",
              )}
            >
              {option}
              {available ? "" : " unavailable"}
            </button>
          );
        })}
        <span className="text-xs text-[var(--muted)]">
          {series.episodes.filter((entry) => entry.available.sub).length} SUB ·{" "}
          {series.episodes.filter((entry) => entry.available.dub).length} DUB episodes listed
        </span>
      </div>

      {episodePanelOpen ? (
        <div className="grid max-h-[420px] grid-cols-1 gap-2 overflow-y-auto rounded-[1.25rem] border border-white/10 p-3 sm:grid-cols-2 lg:grid-cols-3">
          {series.episodes.map((entry) => {
            const playable = entry.available.sub || entry.available.dub;
            return (
              <button
                key={entry.number}
                type="button"
                disabled={!playable}
                onClick={() => onSelectEpisode(entry.number, resolvedLanguage)}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-3 py-2 text-left transition",
                  entry.number === episodeNumber
                    ? "border-white/18 bg-white/10"
                    : "border-white/8 hover:border-white/16",
                  !playable && "cursor-not-allowed opacity-50",
                )}
              >
                <span className="relative h-12 w-20 shrink-0 overflow-hidden rounded-lg bg-black">
                  {entry.thumbnail ? (
                    <Image
                      src={entry.thumbnail}
                      alt=""
                      fill
                      unoptimized
                      sizes="80px"
                      className="object-cover"
                    />
                  ) : null}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-white">Episode {entry.number}</span>
                  <span className="block truncate text-xs text-[var(--muted)]">
                    {entry.available.sub ? "SUB" : ""}
                    {entry.available.sub && entry.available.dub ? " · " : ""}
                    {entry.available.dub ? "DUB" : ""}
                    {!playable ? "Not listed" : ""}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <Link href={`/anime/${series.anilistId}`} className="text-[var(--muted)] underline-offset-4 hover:text-white hover:underline">
          Back to {series.title}
        </Link>
        <span className="text-xs text-[var(--muted)]">
          Playback by Ani.pm · episode {episodeNumber} · {normalizeAnimeLanguage(resolvedLanguage).toUpperCase()}
        </span>
      </div>
    </div>
  );
}
