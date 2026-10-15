# GrubX recommendation ranking logic

> Explainable, rules-based personalization. No external ML service, no server
> calls, no fabricated data. This document describes exactly how scores are
> computed so the behavior is auditable and testable
> (`tests/recommendation-engine.test.ts`).

## Where recommendations live

- Engine (pure functions, unit-tested): `lib/recommendationEngine.ts`
- React binding: `hooks/useRecommendations.ts`
- Cross-catalog home rail: `components/recommendations/HomeRecommendations.tsx`
- Catalog pages (movies/TV grid, live): `components/media/CatalogGrid.tsx`, `app/(routes)/live/page.tsx`
- Storage key: `grubx.recommendations` (localStorage, per device/profile)

## Signals collected (all on-device)

Every interaction turns a catalogue object into a `RecommendationItem`:
`id`, `title`, `genres[]`, `rating`, `year`, `mediaType`
(`movie | tv | anime | manga | live`), `teams[]` for sports.

| Signal | Recorded when | Cap |
| --- | --- | --- |
| `viewedItems` | an item's detail page/view is tracked | 80 |
| `clickedItems` | a card/action button is opened | 80 |
| `searchHistory` | a search is submitted (2+ chars) | 30 |
| `notInterestedItems` | the user taps **Not for me** on a rail card | 120 |
| `savedItems` | the user taps **Later** on a rail card | 120 |

Timestamps ride along (`lastInteractedAt`) for recency decay.

## Score composition (`scoreRecommendationItem`)

Starting at 0, for a candidate item against the profile state and current filters:

1. **Filter match** — genre overlap with active filter genres: +5; rating-class
   match: +3; year inside `yearFrom..yearTo`: +2.
2. **Viewed similarity** — best similarity to a viewed item times recency
   decay, then +4 if > 0. Similarity itself is `genreOverlap*2 + teamOverlap*2`
   + rating proximity (+1 when within 1.5 for numeric ratings) + year windows
   (+1 when within 5 years) + same-mediaType (+0.5).
3. **Clicked similarity** — same shape as viewed, bonus +3.
4. **Search keyword match** — item title/genres/teams contain any history
   token of 2+ chars: +2.
5. **Dismissals (hard negative)** — identical item id: -100; similar-dismissed
   genre cluster: -8. This is what makes "Not for me" actually remove
   recommendations in that lane.
6. **Saved items** — exact: +6; similar: +4.

Only positive scores render. Ties keep the provider's original relevance order
because ranking sorts by score only.

## Recency decay

`decayWeight(age) = max(0.2, exp(-ageDays / 30))` — interactions age to
near-zero influence after about 30 days without ever fully resetting.

## Cross-catalog identity

`mediaType` is always set (movie/tv/anime/manga/live) and ids are namespaced
(`anime:154587`, `manga:<uuid>`, TMDB numeric ids) so a 1984 Dune movie and a
"Dune"-named anime entry can never merge. Similarity still crosses catalogs
through genres — watching a TMDB sci-fi movie lifts anime sci-fi candidates
too, with a +0.5 same-type bonus favoring the home catalog first.

## Explanation and transparency

Every rail's description states what generated it. The home rail and the
Settings panel expose **Clear personalization data**, which deletes the whole
graph and re-broadcasts `grubx:recommendations-updated` so every mounted rail
resets immediately.

## Cold start

New profile, empty state, all scores 0, so personal rails render nothing
(never fabricated). Real provider-backed rails keep serving, clearly labeled
by provider: TMDB trending/popular, Ani.pm top, MangaDex popular, live
schedule. Users seed personalization by browsing; searches also feed the
engine.

## Privacy controls

- `recommendationsEnabled` (Settings) turns the engine off entirely.
- `trackingEnabled` gates new signal recording.
- **Clear personalization data** (Settings + home rail footer) wipes the graph.
- Everything is per-device localStorage; nothing leaves the device.

## Stability across devices

State is local, so devices personalize independently. Implicit
personalization is intentionally not synced; account sync covers watchlist and
continue-watching only. This is a privacy-first decision.

## Exclusions

- Dismissed items (score -100) never render.
- Duplicated ids across feeds are de-duplicated by id + mediaType before ranking.
- Hidden/unavailable titles cannot enter the candidate pool: candidates come
  from provider-backed catalogue queries that already respect existence
  (and the anime catalogue's adult-content handling).
- Live suggestions ignore events without playable sources.
