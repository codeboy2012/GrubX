"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BookOpenText,
  ChevronLeft,
  ChevronRight,
  Hash,
  LoaderCircle,
  MoveVertical,
  RectangleHorizontal,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";

import { EmptyState } from "@/components/feedback/EmptyState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { useSettingsContext } from "@/context/SettingsContext";
import { dataLayer } from "@/lib/dataLayer";
import { cn } from "@/lib/cn";
import { getClientMangaChapterPages, getClientMangaChapters } from "@/lib/manga/client";
import type { MangaReaderMode, MangaReadingDirection } from "@/types/settings";

const buildPageUrl = (baseUrl: string, hash: string, file: string, dataSaver: boolean) =>
  `${baseUrl}/${dataSaver ? "data-saver" : "data"}/${hash}/${file}`;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function MangaReader({
  mangaId,
  mangaTitle,
  coverUrl,
  chapterId,
  chapterNumber,
}: {
  mangaId: string;
  mangaTitle: string;
  coverUrl: string | null;
  chapterId: string;
  chapterNumber: string | null;
}) {
  const { settings, saveSettings } = useSettingsContext();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [retryToken, setRetryToken] = useState(0);
  const pageRefs = useRef<Array<HTMLDivElement | null>>([]);
  const topRef = useRef<HTMLDivElement | null>(null);

  // Reader preferences live in the normal settings store, so they persist per
  // device and mirror to the account's settings sync like every other toggle.
  const mode: MangaReaderMode = settings.mangaReaderMode;
  const direction: MangaReadingDirection = settings.mangaReadingDirection;
  const fitWidth = settings.mangaReaderFit === "width";

  const pagesQuery = useQuery({
    queryKey: ["manga", "pages", chapterId, retryToken],
    queryFn: ({ signal }) => getClientMangaChapterPages(chapterId, signal),
    staleTime: 1000 * 60 * 30,
    retry: 2,
  });

  const chaptersQuery = useQuery({
    queryKey: ["manga", "chapters", mangaId],
    queryFn: ({ signal }) => getClientMangaChapters(mangaId, "en", signal),
    staleTime: 1000 * 60 * 30,
  });

  const images = useMemo(() => {
    const payload = pagesQuery.data;
    if (!payload) {
      return [];
    }
    const useSaver = settings.dataSaver && payload.dataSaver.length > 0;
    const files = useSaver ? payload.dataSaver : payload.data;
    return files.map((file) => buildPageUrl(payload.baseUrl, payload.hash, file, useSaver));
  }, [pagesQuery.data, settings.dataSaver]);

  const chapters = chaptersQuery.data ?? [];
  const index = chapters.findIndex((chapter) => chapter.id === chapterId);
  const previousChapter = direction === "rtl" ? (index >= 0 && index < chapters.length - 1 ? chapters[index + 1] : null) : index > 0 ? chapters[index - 1] : null;
  const nextChapter = direction === "rtl" ? (index > 0 ? chapters[index - 1] : null) : index >= 0 && index < chapters.length - 1 ? chapters[index + 1] : null;

  const chapterLabel = chapterNumber ? `Chapter ${chapterNumber}` : "Chapter";
  const numericChapter = chapterNumber ? Number(chapterNumber) : Number.NaN;
  const totalPages = images.length;

  const persistProgress = useCallback(
    (pageNumber: number, pageCount: number) => {
      if (pageCount <= 0) {
        return;
      }
      // Cap below 100 so a finished chapter still surfaces in Continue Reading.
      const percent = clamp(Math.round((pageNumber / pageCount) * 100), 1, 90);
      void dataLayer.savePlaybackProgress({
        mediaId: mangaId,
        mediaType: "manga",
        title: mangaTitle,
        posterPath: coverUrl,
        backdropPath: null,
        season: null,
        episode: Number.isFinite(numericChapter) ? numericChapter : index + 1,
        chapterId,
        currentTime: 0,
        duration: pageCount,
        progress: percent,
      });
    },
    [chapterId, coverUrl, index, mangaId, mangaTitle, numericChapter],
  );

  // Restore last page for this chapter when pages arrive.
  useEffect(() => {
    if (totalPages <= 0) {
      return;
    }
    const restored = window.sessionStorage.getItem(`grubx_reader_page:${chapterId}`);
    const restoredPage = restored ? Number.parseInt(restored, 10) : 1;
    const startPage = Number.isFinite(restoredPage) ? clamp(restoredPage, 1, totalPages) : 1;
    if (mode === "continuous") {
      const node = pageRefs.current[startPage - 1];
      if (node && restoredPage > 1) {
        node.scrollIntoView({ block: "start" });
      }
    }
    setPage(startPage);
    persistProgress(startPage, totalPages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId, totalPages]);

  useEffect(() => {
    if (totalPages > 0 && page >= 1 && page <= totalPages) {
      window.sessionStorage.setItem(`grubx_reader_page:${chapterId}`, String(page));
      persistProgress(page, totalPages);
    }
  }, [page, totalPages, chapterId, persistProgress]);

  const scrollToPage = useCallback(
    (target: number) => {
      const next = clamp(target, 1, totalPages || 1);
      setPage(next);
      if (mode === "single-page") {
        topRef.current?.scrollIntoView({ block: "start" });
      } else {
        pageRefs.current[next - 1]?.scrollIntoView({ block: "start" });
      }
    },
    [mode, totalPages],
  );

  const step = direction === "rtl" ? -1 : 1;
  const goNext = useCallback(
    () => scrollToPage(page + step),
    [page, scrollToPage, step],
  );
  const goPrev = useCallback(
    () => scrollToPage(page - step),
    [page, scrollToPage, step],
  );

  // Keyboard navigation: arrows follow the current reading direction.
  useEffect(() => {
    if (totalPages === 0) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (event.key === "ArrowRight") {
        (direction === "rtl" ? goPrev : goNext)();
      } else if (event.key === "ArrowLeft") {
        (direction === "rtl" ? goNext : goPrev)();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [direction, goNext, goPrev, totalPages]);

  // Track the visible page in continuous mode.
  useEffect(() => {
    if (mode !== "continuous") {
      return;
    }
    const onScroll = () => {
      const next = pageRefs.current.findIndex((node) => {
        if (!node) {
          return false;
        }
        const rect = node.getBoundingClientRect();
        return rect.bottom > window.innerHeight * 0.35;
      });
      if (next >= 0) {
        setPage((current) => (current === next + 1 ? current : next + 1));
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [mode]);

  useEffect(() => {
    setPage(1);
  }, [chapterId]);

  const updateReaderPref = (patch: { mangaReaderMode?: MangaReaderMode; mangaReadingDirection?: MangaReadingDirection; mangaReaderFit?: "width" | "original" }) => {
    void saveSettings(patch);
  };

  const readerSettings = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 rounded-full border border-white/12 bg-black/30 p-1" role="group" aria-label="Reader mode">
        <button
          type="button"
          onClick={() => updateReaderPref({ mangaReaderMode: "single-page" })}
          aria-pressed={mode === "single-page"}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition",
            mode === "single-page" ? "bg-white text-black" : "text-[var(--muted)] hover:text-white",
          )}
        >
          <RectangleHorizontal className="size-3.5" />
          Pages
        </button>
        <button
          type="button"
          onClick={() => updateReaderPref({ mangaReaderMode: "continuous" })}
          aria-pressed={mode === "continuous"}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition",
            mode === "continuous" ? "bg-white text-black" : "text-[var(--muted)] hover:text-white",
          )}
        >
          <MoveVertical className="size-3.5" />
          Scroll
        </button>
      </div>

      <div className="flex items-center gap-1 rounded-full border border-white/12 bg-black/30 p-1" role="group" aria-label="Reading direction">
        <button
          type="button"
          onClick={() => updateReaderPref({ mangaReadingDirection: "ltr" })}
          aria-pressed={direction === "ltr"}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-bold tracking-widest transition",
            direction === "ltr" ? "bg-white text-black" : "text-[var(--muted)] hover:text-white",
          )}
        >
          LTR
        </button>
        <button
          type="button"
          onClick={() => updateReaderPref({ mangaReadingDirection: "rtl" })}
          aria-pressed={direction === "rtl"}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-bold tracking-widest transition",
            direction === "rtl" ? "bg-white text-black" : "text-[var(--muted)] hover:text-white",
          )}
        >
          RTL
        </button>
      </div>

      <button
        type="button"
        onClick={() => updateReaderPref({ mangaReaderFit: fitWidth ? "original" : "width" })}
        className="rounded-full border border-white/12 bg-black/30 px-3 py-1.5 text-xs font-semibold text-[var(--muted)] transition hover:text-white"
        title={fitWidth ? "Showing page at fit-to-width; click for original size" : "Showing original page size; click to fit width"}
      >
        {fitWidth ? "Fit width" : "Original"}
      </button>
    </div>
  );

  const prevTarget = previousChapter;
  const nextTarget = nextChapter;

  const nav = (
    <div className="flex items-center justify-between gap-3">
      {prevTarget ? (
        <Link
          href={`/manga/${mangaId}/${prevTarget.id}`}
          className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/30 px-4 py-2.5 text-sm font-semibold text-white transition hover:border-white/25"
        >
          <ChevronLeft className="size-4" />
          Prev
        </Link>
      ) : (
        <span className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-black/20 px-4 py-2.5 text-sm text-[var(--muted)]">
          <ChevronLeft className="size-4" />
          Prev
        </span>
      )}

      <span className="text-sm text-[var(--muted)]" aria-live="polite">
        {totalPages > 0 ? `Page ${Math.min(page, totalPages)} / ${totalPages}` : chapterLabel}
      </span>

      {nextTarget ? (
        <Link
          href={`/manga/${mangaId}/${nextTarget.id}`}
          className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/30 px-4 py-2.5 text-sm font-semibold text-white transition hover:border-white/25"
        >
          Next
          <ChevronRight className="size-4" />
        </Link>
      ) : (
        <span className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-black/20 px-4 py-2.5 text-sm text-[var(--muted)]">
          Next
          <ChevronRight className="size-4" />
        </span>
      )}
    </div>
  );

  const singlePageNav = totalPages > 0 ? (
    <div className="flex items-center justify-center gap-3">
      <button
        type="button"
        onClick={goPrev}
        disabled={direction === "rtl" ? page >= totalPages : page <= 1}
        className="grid size-11 place-items-center rounded-full border border-white/12 bg-black/30 text-white transition hover:border-white/25 disabled:opacity-40"
        aria-label={`Previous page${direction === "rtl" ? " (in RTL reading this is forward)" : ""}`}
      >
        <ChevronLeft className="size-4" />
      </button>
      <span className="text-sm text-[var(--muted)]" aria-live="polite">
        Page {page} / {totalPages}
      </span>
      <button
        type="button"
        onClick={goNext}
        disabled={direction === "rtl" ? page <= 1 : page >= totalPages}
        className="grid size-11 place-items-center rounded-full border border-white/12 bg-black/30 text-white transition hover:border-white/25 disabled:opacity-40"
        aria-label={`Next page${direction === "rtl" ? " (in RTL reading this is backward)" : ""}`}
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  ) : null;

  const isStale = pagesQuery.isError && retryToken > 0;

  return (
    <section className="page-shell space-y-6 py-6 md:py-8">
      <div className="liquid-glass sticky top-[calc(env(safe-area-inset-top)+0.5rem)] z-30 flex flex-col gap-3 rounded-[1.3rem] px-4 py-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/manga/${mangaId}`}
            className="grid size-10 place-items-center rounded-full border border-white/10 bg-black/30 text-[var(--muted)] transition hover:text-white"
            aria-label="Back to manga details"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{mangaTitle}</p>
            <p className="text-xs text-[var(--muted)]">{chapterLabel}</p>
          </div>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
          {readerSettings}
          {nav}
        </div>
      </div>

      {pagesQuery.isPending ? (
        <LoadingState title="Loading chapter" description="Fetching pages from MangaDex." />
      ) : pagesQuery.isError ? (
        <div className="space-y-4">
          <EmptyState
            title={isStale ? "Still unavailable" : "Chapter unavailable"}
            description={
              pagesQuery.error instanceof Error
                ? `${pagesQuery.error.message} This can happen when the chapter was removed, the CDN is unreachable, or your network is offline. Nothing was invented to fill the gap.`
                : "This chapter could not be loaded from the data source."
            }
          />
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setRetryToken((token) => token + 1);
                queryClient.invalidateQueries({ queryKey: ["manga", "pages", chapterId] });
              }}
              className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-black transition hover:brightness-95"
            >
              <RefreshCw className="size-4" />
              Retry
            </button>
            {chapters.length > 0 && index >= 0 ? (
              <Link
                href={`/manga/${mangaId}/${(nextChapter ?? previousChapter)?.id ?? mangaId}`}
                className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/30 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/25"
              >
                <BookOpenText className="size-4" />
                Try another chapter
              </Link>
            ) : null}
          </div>
        </div>
      ) : totalPages === 0 ? (
        <div className="space-y-4">
          <EmptyState title="No pages found" description="This chapter has no readable pages for the selected language. It may be a placeholder entry awaiting uploads." />
          <div className="flex justify-center">
            <Link
              href={`/manga/${mangaId}`}
              className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/30 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/25"
            >
              <Hash className="size-4" />
              Back to chapter list
            </Link>
          </div>
        </div>
      ) : (
        <>
          {pagesQuery.isFetching ? (
            <p className="flex items-center justify-center gap-2 text-sm text-[var(--muted)]">
              <LoaderCircle className="size-4 animate-spin" />
              Refreshing pages...
            </p>
          ) : null}

          {mode === "single-page" ? (
            <div className="space-y-4">
              <div
                className="mx-auto w-full overflow-hidden rounded-[0.6rem] border border-white/8 bg-black"
                style={{ maxWidth: fitWidth ? undefined : "min(100%, 860px)" }}
                dir={direction}
              >
                {/* MangaDex serves pages from rotating CDN nodes, so a plain img keeps hostnames dynamic and safe. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={images[clamp(page, 1, totalPages) - 1]}
                  alt={`${mangaTitle} ${chapterLabel} page ${page}`}
                  className={cn("h-auto", fitWidth ? "w-full" : "mx-auto w-auto max-w-full")}
                />
              </div>
              {singlePageNav}
            </div>
          ) : (
            <div
              className="mx-auto flex w-full flex-col gap-2"
              dir={direction}
            >
              {images.map((src, pageIndex) => (
                <div
                  key={src}
                  ref={(node) => {
                    pageRefs.current[pageIndex] = node;
                  }}
                  className="relative w-full overflow-hidden rounded-[0.6rem] border border-white/8 bg-black"
                  style={{ maxWidth: fitWidth ? undefined : "min(100%, 860px)", marginInline: fitWidth ? undefined : "auto" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={`${mangaTitle} ${chapterLabel} page ${pageIndex + 1}`}
                    loading="lazy"
                    className={cn("h-auto select-none", fitWidth ? "w-full" : "mx-auto w-auto max-w-full")}
                  />
                  <span
                    aria-hidden
                    className="pointer-events-none absolute bottom-2 end-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white/80"
                  >
                    {pageIndex + 1}
                  </span>
                </div>
              ))}
            </div>
          )}

          {nextTarget ? (
            <div className="mx-auto flex w-full max-w-3xl justify-center pb-6">
              <Link
                href={`/manga/${mangaId}/${nextTarget.id}`}
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-bold text-black transition hover:brightness-95"
              >
                {direction === "rtl" ? "Previous chapter" : "Next chapter"}
                <ChevronRight className="size-4 rtl:rotate-180" />
              </Link>
            </div>
          ) : (
            <EmptyState
              title={direction === "rtl" ? "This is the first chapter" : "No further chapters"}
              description={
                direction === "rtl"
                  ? "There is no earlier chapter than this one for the selected language."
                  : "Ani.pm-style providers list chapters in ascending order; when the next is published, it will appear here automatically."
              }
            />
          )}

          <div className="flex items-center justify-center gap-2 text-xs text-[var(--muted)]">
            <TriangleAlert className="size-3.5" />
            Pages are streamed from MangaDex and are not stored by GrubX.
          </div>

          <div className="mx-auto w-full max-w-3xl pb-10">{nav}</div>
        </>
      )}

      <p className="text-center text-[11px] text-[var(--muted)]">Reader prefs sync with your account settings.</p>
    </section>
  );
}
