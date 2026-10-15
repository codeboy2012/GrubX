import { HomeContent } from "@/components/home/HomeContent";
import { safeServerMediaPage, safeTrendingHero } from "@/lib/tmdb/server";

export const revalidate = 300;

export default async function HomePage() {
  // Every call is non-throwing: a missing TMDB key or an outage yields empty
  // rows plus an explicit notice, never a failed build or a crashed homepage.
  const [hero, popularMovies, popularTv, topRatedMovies] = await Promise.all([
    safeTrendingHero(),
    safeServerMediaPage({ mediaType: "movie", category: "popular" }),
    safeServerMediaPage({ mediaType: "tv", category: "popular" }),
    safeServerMediaPage({ mediaType: "movie", category: "top_rated" }),
  ]);

  const catalogueAvailable = [hero, popularMovies, popularTv, topRatedMovies].some(
    (page) => (page?.results.length ?? 0) > 0,
  );

  return (
    <HomeContent
      catalogueAvailable={catalogueAvailable}
      hero={hero?.results ?? []}
      popularMovies={popularMovies?.results ?? []}
      popularTv={popularTv?.results ?? []}
      topRatedMovies={topRatedMovies?.results ?? []}
    />
  );
}
