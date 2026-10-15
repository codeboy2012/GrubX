"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LoaderCircle, Search } from "lucide-react";

import { EmptyState } from "@/components/feedback/EmptyState";
import { FeatureGate } from "@/components/feedback/FeatureGate";
import { LoadingState } from "@/components/feedback/LoadingState";
import { MangaCard } from "@/components/manga/MangaCard";
import { cn } from "@/lib/cn";
import { getClientMangaList, getClientMangaStatus, getClientMangaTags } from "@/lib/manga/client";
import type { MangaListKind } from "@/types/manga";

const tabs: Array<{ id: MangaListKind; label: string; description: string }> = [
  { id: "popular", label: "Popular", description: "Most-followed manga across MangaDex." },
  { id: "recent", label: "Recently Updated", description: "Titles with the newest uploaded chapters." },
  { id: "search", label: "Search", description: "Find a title by name." },
];

export default function MangaPage() {
  const [tab, setTab] = useState<MangaListKind>("popular");
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(queryInput.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [queryInput]);

  const statusQuery = useQuery({
    queryKey: ["manga", "status"],
    queryFn: ({ signal }) => getClientMangaStatus(signal),
    staleTime: 1000 * 60 * 10,
  });

  const tagsQuery = useQuery({
    queryKey: ["manga", "tags"],
    queryFn: ({ signal }) => getClientMangaTags(signal),
    staleTime: 1000 * 60 * 60,
  });

  const listQuery = useQuery({
    queryKey: ["manga", "list", tab, tag, query],
    enabled: tab !== "search" || query.length > 1,
    staleTime: 1000 * 60 * 5,
    queryFn: ({ signal }) =>
      getClientMangaList(
        {
          kind: tab,
          query: tab === "search" ? query : undefined,
          tag: tab === "tag" ? tag ?? undefined : undefined,
          limit: 30,
        },
        signal,
      ),
  });

  const items = listQuery.data?.items ?? [];
  const topTags = (tagsQuery.data ?? []).slice(0, 24);

  return (
    <FeatureGate feature="manga">
      <section className="page-shell space-y-7 py-8 md:space-y-9 md:py-12">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[var(--accent)]">Manga</p>
          <h1 className="mt-4 text-5xl font-bold leading-none md:text-6xl">Read without leaving GrubX</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base font-medium leading-7 text-[var(--muted)]">
            Browse popular and recently updated manga, search by title, then read chapters in a focused reader.
          </p>

          <div className="mt-7 flex flex-col gap-4">
            <div className="liquid-glass-soft flex items-center gap-3 rounded-full px-5 py-4">
              <Search className="size-4 text-[var(--muted)]" />
              <input
                value={queryInput}
                onChange={(event) => {
                  setQueryInput(event.target.value);
                  setTab("search");
                  setTag(null);
                }}
                placeholder="Search manga by title"
                className="w-full bg-transparent text-base text-white outline-none placeholder:text-[var(--muted)]"
              />
              {listQuery.isFetching ? <LoaderCircle className="size-4 animate-spin text-[var(--accent)]" /> : null}
            </div>

            <div className="flex flex-wrap justify-center gap-3">
              {tabs.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setTab(option.id);
                    setTag(null);
                  }}
                  className={cn(
                    "rounded-full border px-4 py-2.5 text-sm font-semibold transition",
                    tab === option.id ? "border-white/18 bg-white text-black" : "border-white/10 bg-white/6 text-[var(--muted)] hover:text-white",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {topTags.length > 0 ? (
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hidden">
                <button
                  type="button"
                  onClick={() => {
                    setTag(null);
                    setTab("popular");
                  }}
                  className={cn(
                    "shrink-0 rounded-full border px-3.5 py-2 text-xs font-semibold transition",
                    tag === null ? "border-[var(--accent)] bg-[var(--accent-soft)] text-white" : "border-white/10 bg-white/5 text-[var(--muted)] hover:text-white",
                  )}
                >
                  All genres
                </button>
                {topTags.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setTag(item.id);
                      setTab("tag");
                    }}
                    className={cn(
                      "shrink-0 rounded-full border px-3.5 py-2 text-xs font-semibold transition",
                      tag === item.id ? "border-[var(--accent)] bg-[var(--accent-soft)] text-white" : "border-white/10 bg-white/5 text-[var(--muted)] hover:text-white",
                    )}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {statusQuery.data && !statusQuery.data.configured ? (
          <EmptyState
            title="Manga source not configured"
            description={`${statusQuery.data.label} is not configured. ${statusQuery.data.notes}`}
          />
        ) : tab === "search" && query.length <= 1 ? (
          <EmptyState title="Search manga" description="Type at least two characters to search the manga catalog by title." />
        ) : listQuery.isPending ? (
          <LoadingState title="Loading manga" description="Bringing the latest titles into view." />
        ) : listQuery.isError ? (
          <EmptyState
            title="Manga feed unavailable"
            description={listQuery.error instanceof Error ? listQuery.error.message : "Unable to load manga right now."}
          />
        ) : items.length === 0 ? (
          <EmptyState title="No manga found" description="Try a different title or genre." />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-[var(--card-gap)] sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
              {items.map((manga) => (
                <MangaCard key={manga.id} manga={manga} />
              ))}
            </div>
            {statusQuery.data ? (
              <p className="text-center text-xs text-[var(--muted)]">
                Source: {statusQuery.data.label} · {statusQuery.data.notes}
              </p>
            ) : null}
          </>
        )}
      </section>
    </FeatureGate>
  );
}
