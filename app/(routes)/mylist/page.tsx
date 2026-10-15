"use client";

import { FeatureGate } from "@/components/feedback/FeatureGate";
import { ContinueWatchingRow } from "@/components/user/ContinueWatchingRow";
import { WatchlistRow } from "@/components/user/WatchlistRow";

export default function MyListPage() {
  return (
    <FeatureGate feature="watchlist">
      <section className="page-shell space-y-10 py-8 md:space-y-12 md:py-12">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[var(--accent)]">My List</p>
          <h1 className="mt-4 text-5xl font-bold leading-none md:text-6xl">Saved and in-progress</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base font-medium leading-7 text-[var(--muted)]">
            Your watchlist and reading progress stay on this device. Movies, TV shows, anime, and manga all land here.
          </p>
        </div>

        <ContinueWatchingRow
          showEmpty
          title="Continue Watching & Reading"
          description="Pick up movies, shows, and manga exactly where you stopped."
          emptyTitle="Nothing to resume yet"
          emptyDescription="Start a title and your progress rail will appear here."
        />

        <WatchlistRow
          showEmpty
          title="My List"
          description="Everything you saved for later."
          emptyTitle="Your list is empty"
          emptyDescription="Save a movie, show, or manga and it will appear here."
        />
      </section>
    </FeatureGate>
  );
}
