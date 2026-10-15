import { posterUrl } from "./urls";
import type { MediaDetails, MediaItem, MediaPage } from "./types";

/** Combined popular/top-rated list for a catalog screen, de-duplicated. */
export const catalogueItems = (pages: (MediaPage | null)[]): MediaItem[] => {
  const seen = new Set<string>();
  const items: MediaItem[] = [];
  for (const page of pages) {
    for (const row of page?.results ?? []) {
      if (!row?.id || seen.has(row.id) || row.mediaType === undefined) {
        continue;
      }
      seen.add(row.id);
      items.push(row);
    }
  }
  return items;
};

export const catalogCard = (item: MediaItem) => ({
  key: `${item.mediaType}-${item.id}`,
  uri: posterUrl(item.posterPath, "w342"),
  title: item.title,
  subtitle: item.releaseDate ? item.releaseDate.slice(0, 4) : null,
});

export const searchCard = (item: MediaItem) => ({
  key: `${item.mediaType}-${item.id}`,
  uri: posterUrl(item.posterPath, "w342"),
  title: item.title,
  subtitle: item.overview ? item.overview.slice(0, 80) : null,
});

export const detailSummary = (details: MediaDetails) => ({
  ratingLine: [details.rating ? details.rating.toFixed(1) : null, details.runtime, details.status].filter(Boolean).join(" · "),
});
