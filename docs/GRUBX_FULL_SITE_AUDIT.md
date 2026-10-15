# GrubX Full Site Audit

> **Second pass (2026-10-15, later in the day):** sections 1–9 document the audit and repair pass that produced the
> current working tree. Section 10 documents the follow-up rebuild work on top of it — a first-class Ani.pm anime
> experience, the shared anime catalogue/player layer under `lib/anime/`, a test suite, centralized environment
> configuration, and fresh build/route/server/browser verification. Where section 10 contradicts a row above, section 10
> is the current state.

Date: 2026-10-15
Repository: `C:\Users\sleepy\Documents\GrubX` (branch `main`, commit `299f65d`, remote `SRGuyYT/GrubX`)
Scope: full end-to-end audit, repair, test, and local server verification of GrubX (movies, TV, anime, manga, live TV,
search, My List / continue watching & reading). All changes are uncommitted in the working tree.

## 1. What was inspected

- Git state: branch `main`, 27 commits, remote `origin` = `https://github.com/SRGuyYT/GrubX.git`. Working tree had
  pre-existing user changes (removal of the YouTube/TikTok/Spotify/AI integrations) — these were preserved, not reset.
- Framework: Next.js 16.2.2 (App Router, Turbopack), React 19.2.4, TypeScript 5.9, Tailwind CSS 4, TanStack Query 5,
  sonner. Package manager `pnpm` (lockfile present, preserved).
- Route inventory (verified from the filesystem and from a live `next build`):

| Kind | Routes |
| --- | --- |
| Pages | `/`, `/movies`, `/tv`, `/anime`, `/manga`, `/manga/[id]`, `/manga/[id]/[chapter]`, `/mylist`, `/live`, `/search`, `/settings`, `/contact`, `/privacy`, `/safety`, `/terms`, `/under-13`, `/title/[mediaType]/[id]`, `/embed/movie/[provider]/[id]`, `/embed/tv/[provider]/[id]/[season]/[episode]`, `loading`, `error`, `not-found` |
| APIs | `/api/tmdb`, `/api/manga`, `/api/live/sports`, `/api/live/matches`, `/api/live/streams`, `/api/live/best` (POST), `/api/player/resolve`, `/api/feedback`, `/api/provider-report` |

- Removed integrations confirmed absent as code: `/youtube`, `/tiktok`, `/spotify`, `/ai` pages, all `app/api/youtube|tiktok|spotify`
  handlers, `components/external/*`, `lib/{youtube,tiktok,spotify,externalProxy}.ts`, `types/{external,spotify}.ts`,
  `hooks/useSpotifyWebPlayer.ts`. `git status` shows them as deletions.
- Deliberate retention (not part of the removed integrations): movie/TV **trailer** embeds through `TrailerModal`.

## 2. Issue categories found

1. Obsolete integration copy still shown to users (removed features advertised in the hero and settings).
2. A dead user-facing control: the 404 page search form submitted to `/search?q=…`, which the search page ignored.
3. Accessibility: unnamed toggle switches/selects/sliders/text inputs in Settings, an unnamed drawer close button, and
   off-canvas drawer links that stayed focusable and in the accessibility tree while the drawer was closed.
4. Mobile layout: an intrinsic-size blow-out that made most genre filter chips unreachable on small screens.
5. Unbounded server-side in-memory cache in the player resolver.
6. Minor: `next/image` `fill` without `sizes`, documentation gaps, stale ignored dev logs.

## 3. Fixes made (all verified)

### 3.1 Obsolete integration copy (removed features)

- `lib/settings.ts`: default `homeHeroSubtitle` changed from "Movies, TV, live streams, music, and external media in one
  quiet console." to "Movies, TV, anime, manga, and live streams in one quiet console." Added
  `LEGACY_STRING_MIGRATIONS` + `migrateLegacyString` so returning users with the old string persisted in
  `localStorage.grubx_settings` are migrated instead of keeping stale copy. Verified in the browser: stored
  `homeHeroSubtitle` is now the new text and the homepage hero renders it.
- `components/settings/SettingsPanel.tsx`: Navigation section description "Control nav visibility and how external AI
  opens." → "Control nav visibility, labels, and mobile menu behavior."

### 3.2 Dead search control (404 page → `/search?q=`)

`app/(routes)/search/page.tsx` never read the `q` query parameter, so `app/not-found.tsx`'s
`<form action="/search"><input name="q">` (the primary action of the 404 page) did nothing.

- Added `readUrlQuery()` and a mount effect that seeds the input from `?q=`; the URL query now takes precedence over
  the remembered last search so the deep link cannot be clobbered.
- Verified in-browser end to end: `/does-not-exist-page` → typed "fight club" → Enter → URL `/search?q=fight+club`,
  input value "fight club", 33 results including `/title/movie/550`. Also verified directly: `/search?q=demon` →
  input "demon", 40 results (Demon Slayer first).

### 3.3 Accessibility — accessible names for settings controls

- New `components/settings/settingRowLabel.tsx` exposes a `SettingRowLabelContext` + `useSettingRowLabel()`.
- `SettingRow` (`components/settings/SettingsPanel.tsx`) now renders its title with a `useId()` id and provides that id
  to its children, so every control inherits the row title as its accessible name.
- `ToggleSwitch`, `SelectControl`, `SliderControl`, `TextInputControl` and the local `SelectSetting` use the context as
  `aria-labelledby` when no explicit `label`/`ariaLabel` is supplied.
- The three custom-provider form inputs got explicit `aria-label`s.
- Measured in the browser on `/settings`: unnamed interactive controls went from switching/selects/inputs being unnamed
  to **3 of 125** (and those three are now explicitly labelled), e.g. `role=switch` now reports "Show logo"; selects
  report "Logo size", "Text size".

### 3.4 Accessibility — mobile navigation drawer

`components/shell/Navbar.tsx`:

- The drawer close button now has `aria-label="Close navigation"` (previously an unnamed icon button).
- The closed drawer and its scrim are marked `aria-hidden` and the drawer is `inert` while closed, so its duplicate nav
  links are no longer focusable or announced. Verified: closed → `inert=true`, `aria-hidden="true"`; open →
  `inert=false`, drawer at `left=0`, links focusable; Escape closes it and restores `inert`.

### 3.5 Mobile layout — unreachable filter chips

Symptom: on `/movies` at 375 px the genre chip row was 1987 px wide with no horizontal scroll: `body` is
`overflow-x: hidden`, and the grid track that sized the row blew out to the row's max-content width. Only ~4 of 20
genres were reachable (Comedy at `left=366`), the rest sat off-screen.

- `components/media/CatalogGrid.tsx`: added `min-w-0` to both children of the header grid so the auto track is capped
  at the container width.
- `components/filters/FilterPanel.tsx`: added `[&>*]:min-w-0` to the filter grid so the genre scroller's min-content no
  longer inflates its parent.
- Verified at 375 px: filter panel 328 px, genre row `clientW 294 / scrollW 1987 / scrollable true`, no element wider
  than the viewport, `document.scrollWidth 358 < 375`; scrolling the row by 900 px brings the "Horror" chip to `left=187`
  (visible). Wide viewports re-checked at 768/1440/1920 with no overflow.

### 3.6 Bounded server-side cache

`app/api/player/resolve/route.ts` had an unbounded module-level `playerHealthCache` keyed by probe URL (media ids are
caller-supplied). Added `PLAYER_HEALTH_CACHE_LIMIT = 250` with FIFO eviction via `rememberPlayerHealth()`, replacing both
`set` call sites.

### 3.7 Minor

- `app/(routes)/loading.tsx`: added `sizes` to the `fill` image (removes Next.js warning, produces correct srcset).
- `README.md`: documented the optional `NEXT_PUBLIC_MANGA_API_BASE` and `MATRIX_HOOKSHOT_WEBHOOK_URL` variables, and
  corrected the Matrix note (the bridge route is gone; the server-side feedback alert webhook remains).

## 4. Test and build results

| Check | Command | Result |
| --- | --- | --- |
| Typecheck | `pnpm typecheck` (`tsc --noEmit`) | exit 0 (run after the final edits) |
| Production build | `pnpm build` | pass, 29 routes; `/` `/anime` `/live` `/manga` `/movies` `/mylist` `/privacy` `/safety` `/search` `/settings` `/terms` `/tv` `/under-13` static (`revalidate 5m`), dynamic routes server-rendered |
| Lint | — | **not run**: the project has no lint script and no ESLint config |
| Unit/integration tests | — | **not run**: the repository contains no test files or test runner |
| Route sweep (HTTP) | `curl` against `http://127.0.0.1:3000` | all 16 page routes 200; `/nonexistent-xyz` 404; removed routes `/youtube` `/spotify` `/tiktok` `/ai` 404 |
| Dynamic route validation | `/title/movie/abc`, `/title/book/550`, `/title/movie/99999999999`, `/title/tv/-1`, `/manga/not-a-uuid`, `/manga/<zero-uuid>`, `/manga/not-a-uuid/not-a-chapter` | HTTP 200 (streamed soft 404) but the body is the "We couldn't find that page" not-found view in every case — no crash, no leaked data |
| API validation | `/api/tmdb` (no path / non-allowlisted / absolute URL / `..` traversal) → 400; `/api/manga` (bad resource, bad kind, short search query, bad tag id, bad details id, bad pages id, bad language) → 400; `/api/player/resolve` (bad mediaType / bad id / missing id / `season=0`) → 400; `/api/live/matches?scope=live` → 200 | all as expected |
| Live provider data | `/api/tmdb?path=/trending/all/day` real TMDB payload; `/api/live/matches?scope=live` 200 (1 live match, Brisbane Bullets vs SEM Phoenix, 1 source); `/api/live/sports` 200; `/api/manga?resource=status|tags|list|chapters|pages` real MangaDex data | verified, not fixtures |
| Browser (Chromium, dev server) | `/`, `/movies`, `/tv` (768), `/anime` (375), `/manga`, `/manga/[id]`, `/manga/[id]/[chapter]`, `/mylist`, `/live`, `/search?q=`, `/settings`, `/title/movie/550`, 404 page, 375/768/1440/1920 px | renders, no horizontal overflow, no console errors, all images loaded |
| Manga reader (live) | Chainsaw Man Ch.1 at 375 px | 54/54 pages loaded, 0 broken, "Page 1 / 53", Prev/Next/Next chapter present |
| Watchlist round trip | "Save to watchlist" on `/title/movie/550` | button → "Saved locally", `localStorage.grubx_watchlist` entry with `mediaId/mediaType/title/posterPath`, `/mylist` shows "Fight Club · MOVIE"; un-saved afterwards to restore the original empty list |

## 5. Security review

- Client bundles: the TMDB API key is referenced only from `lib/env.ts`, which is imported by `server-only` modules.
  Verified by searching the production `.next/static` chunks for the key value — **not present**; no `api_key` string in
  client chunks either.
- `.env` was previously tracked by git. It is now gitignored and staged as a deletion (`D .env`), and the working copy is
  untouched. **Rotate/revoke the credentials that were committed** (values were never printed or modified, and git
  history was not rewritten).
- SSRF: TMDB access is path-allowlisted in `lib/tmdb/request.ts` (`https://`/backslash/`..` rejected; live 400s verified).
  Manga access is resource-dispatched with UUID/language validation and a fixed provider base. Live APIs use fixed
  upstream endpoints with `redirect: "error"` and timeouts. No arbitrary URL fetching found.
- No `dangerouslySetInnerHTML` / `eval` usage; no `any` types introduced; no leftover `console.log`.
- Security headers present in `next.config.ts` (Referrer-Policy, X-Content-Type-Options, X-Frame-Options,
  Permissions-Policy, a restrictive base CSP). `poweredByHeader: false`.
- No authentication layer exists (the bridge/auth routes were removed), so no private user data or cross-user boundary
  exists to test. All library/progress state is local to the browser.

## 6. Remaining issues and why they were not fixed

- **No lint and no test suite.** The project ships neither an ESLint config/script nor any test runner or test file, so
  `pnpm lint` and `pnpm test` cannot run. Adding a test framework was out of scope for this pass; kept as a follow-up.
- **Soft 404 status codes.** Invalid `/title/...` and `/manga/...` ids return HTTP 200 with the not-found view because the
  routes are dynamically streamed. Content is correct; the status code is a framework-streaming artifact.
- **Manga availability.** MangaDex hosts 0 chapters for several licensed titles (e.g. Solo Leveling, Frieren, Chainsaw
  Man's sibling titles); those detail pages show the honest "No English chapters are available for this title right
  now." state. Verified live with `Chainsaw Man` (98 chapters) working and `Na Honjaman Level-Up` (0 chapters).
- **LCP eager-loading hints.** Next.js warns that some above-the-fold posters/covers are `loading="lazy"`. Fixing this
  properly means threading a `priority` prop through `MovieCard`/`MangaCard`; without an LCP measurement this was left as
  a documented performance opportunity rather than an unverified change.
- **`/favicon.ico` returns 404.** Metadata declares `/512x512.png` as the icon, but browsers still probe `/favicon.ico`.
  No ICO asset exists and no generator is available; not faked with a mis-typed asset.
- **No `robots.txt` / `sitemap.xml`.** The app is a private, self-hosted shell with no canonical public domain
  configured, so adding crawl metadata would be guesswork.
- **`matcher`/CSP**: the CSP is intentionally minimal (no `script-src`), so it does not yet restrict scripts; tightening it
  would require auditing inline styles/scripts and was not done blindly.
- Stale gitignored dev logs from an earlier checkout (`C:\Users\Lincoln\Documents\GrubedX`) exist as `.next-dev.log`;
  they are ignored by git and were not treated as repository content.

## 7. External configuration required

- `NEXT_PUBLIC_TMDB_PROXY_BASE` and `NEXT_PUBLIC_TMDB_API_KEY` (required; TMDB is proxied server-side via `/api/tmdb`).
- `NEXT_PUBLIC_MANGA_API_BASE` (optional; blank uses the MangaDex public read API — no key needed).
- `MATRIX_HOOKSHOT_WEBHOOK_URL` (optional; server-side only, used for feedback alerts).
- **Credential rotation**: rotate the TMDB and any other secrets that were previously committed in `.env`.

## 8. Server

- Command: `node node_modules/next/dist/bin/next dev -H 127.0.0.1 -p 3000`
- URL: <http://127.0.0.1:3000> — running and verified (homepage, Movies, TV Shows, Anime, Manga, Live TV, Search, My List,
  Settings, title pages, 404 page, and all API routes answered as expected after the final code changes).
- Started cleanly after `.next` was removed (the earlier production build had written to the same directory).

## 9. Confirmation

- No commit, push, merge, or deployment was performed; every change is uncommitted in the working tree.
- No user data was deleted. The only browser-state change made during testing (one watchlist entry) was reversed.
- No NetVoid recreation and no reintroduction of the removed YouTube/TikTok/Spotify integrations.

## 10. Second pass — first-class anime, shared provider layer, tests, and configuration

Scope for this pass: both supplied API documentation files were read in full and compared; the anime category was
rebuilt on Ani.pm; the anime catalogue/player code was consolidated into one shared layer; a real test suite was added;
environment configuration was centralized and hardened; and the build, all routes, the API surface, and the anime
journey were verified in a browser against the production build.

### 10.1 Documentation review (both files, compared)

- `api-docs.txt` (1108 lines, curated) and `api-docs-RAW.txt` (2211 lines, raw scrape) are **not** identical. Both were
  read; the curated file is authoritative for the Ani.pm SDK (§6.4–6.6), the versioned `postMessage` protocol, the
  analytics endpoints, and the per-provider summaries, while the RAW file carries the complete VidCore/VidRock payload
  examples, the full embed-parameter tables, and the changelog.
- Recorded discrepancies: VidCore ships **more than one** message schema in its own examples (top-level event names and
  `PLAYER_EVENT` wrappers). No VidCore control was enabled on the strength of a single example; the existing adapter only
  acts on messages it can validate. VidRock's list endpoints are not relied upon because their live response structure is
  not confirmed in either document.
- Both files were treated as read-only inputs and remain untouched.

### 10.2 Ani.pm anime category (replaced the TMDB-filtered placeholder)

The previous `/anime` page was a TMDB TV grid filtered to Japanese animation. That is gone; anime is now its own
first-class category driven by the documented Ani.pm partner API.

New code:

| File | Role |
| --- | --- |
| `types/anime.ts` | Normalized anime model (AniList + MyAnimeList ids preserved side by side) |
| `lib/anime/embed.ts` | Isomorphic id validation, embed-URL builder, cover/site URLs, availability helper |
| `lib/anime/normalize.ts` | One set of defensive parsers shared by the server provider and the browser client |
| `lib/anime/config.ts` | API-base resolution + static provider status (reported without a network call) |
| `lib/anime/params.ts` | `/api/anime` request validation (resources, ids, pagination, genre/format charset, range) |
| `lib/anime/provider.ts` / `lib/anime/anipm.ts` / `lib/anime/server.ts` | Provider interface, Ani.pm implementation, server entry point |
| `lib/anime/client.ts` | Browser client: calls Ani.pm directly, falls back to `/api/anime` on transport failure only |
| `lib/anime/player.ts` | Ani.pm SDK adapter: load-once script, sanitized state, typed commands, listener cleanup |
| `app/api/anime/route.ts` | Validated, edge-cached catalogue proxy (`status`, `search`, `title`, `series`, `episodes`, `recent`, `schedule`, `top`) |
| `app/(routes)/anime/page.tsx` | Discovery: trending/top with range + genre filters, recently updated, airing schedule, search |
| `app/(routes)/anime/[id]/page.tsx` | Detail: artwork, metadata, real per-episode SUB/DUB availability, resume action |
| `app/(routes)/anime/[id]/watch/page.tsx` | Watch route with `?episode=&lang=` handling inside a Suspense boundary |
| `components/anime/*` | `AnimeCard`, `AnimeTitleActions`, `AnimeWatch`, `AnimeHomeRails` |

Behavioural guarantees implemented (and verified, see 10.6):

- AniList and MyAnimeList ids are kept distinct (`mal-` prefix); nothing that does not parse as a real id reaches a
  request, and a non-id can never become an embed destination.
- Only documented endpoints and documented embed parameters are used. `key` accepts only a publishable `pk_…` app key;
  a secret-looking value is dropped instead of being placed in a browser URL.
- Genre chips, score, format, episode counts, and the airing schedule all come from real provider responses. Nothing is
  fabricated to fill a section: an empty provider response renders an explicit empty state.
- A DUB badge appears **only** when the catalogue's own availability flag for that episode says so.
- The homepage anime rails load on the client, so a slow or unreachable catalogue can never block the homepage; a
  failure renders nothing at all.

### 10.3 Player architecture and resume correctness

- The Ani.pm SDK is loaded on demand from the documented `https://ani.pm/embed/sdk/v1.js` and wrapped in a narrow typed
  surface (`lib/anime/player.ts`). Every value coming back from the framed player is treated as untrusted and sanitized
  (numbers clamped to plausible ranges, booleans read strictly, qualities filtered, episode lists counted defensively).
  Commands are fire-and-forget with swallowed rejections, and listeners are cleared on destroy.
- If the SDK does not load, the page renders the documented plain embed with the provider's own controls and hides the
  GrubX control bar — GrubX never presents a control it cannot operate.
- **Resume is resolved before the player mounts.** The watch component waits for the saved-position read to settle, then
  creates exactly one player with the documented `start` parameter and additionally seeks once when the frame reports
  `ready`/`loaded`/`play`. This was a deliberate fix: an earlier revision created the player and then rebuilt it when the
  async progress read arrived, which restarted playback and could wedge the SDK.
- Progress is only written when the update is plausible (`duration >= 30`, position within duration, finite numbers),
  at most every 15 seconds, forced on pause, `episodechange`, `pagehide`, and `visibilitychange`. A position saved for
  another episode is never applied to the episode the viewer just opened.

### 10.4 Content-type model

`MediaType` now covers `movie | tv | anime | manga`, and a new `TmdbMediaType` plus `isTmdbMediaType` guard mark
TMDB-only surfaces. `lib/tmdb/client.ts` and `lib/tmdb/server.ts` refuse any non-TMDB content type with an explicit
error, so an anime or manga value can never be turned into a TMDB request. The dead `anime` flag that used to mean
"TMDB TV filtered to Japanese animation" was removed from `CatalogGrid`, `useInfiniteMedia`, and both TMDB data layers.
`mediaHref` routes anime to `/anime/{id}/watch?episode=N` and manga to `/manga/{id}/{chapterId}`, and Continue Watching
labels anime rows as `Episode N`.

### 10.5 Environment configuration and secret handling

- `lib/env.ts` is now the single typed configuration module, with `ConfigError`, lazy validation, and a compatibility
  path that prefers the server-side names `TMDB_PROXY_BASE` / `TMDB_API_KEY` while still honouring the legacy
  `NEXT_PUBLIC_TMDB_*` names. **Nothing throws at import time any more**, so a missing key can no longer break the
  production build or an unrelated route.
- `/api/tmdb` now answers `503 { code: "tmdb-not-configured" }` with a safe message and logs the variable name and hint
  server-side only.
- `.env.example` was rewritten into labelled sections containing only variables that real code reads (verified by
  grepping every `process.env.` usage in the project).
- `docs/ENVIRONMENT.md` documents every variable: purpose, requirement, format, default, where to obtain it, secret vs
  public, and troubleshooting steps.
- `config/appConfig.ts` whitelist gained `ani.pm` and the TMDB proxy host, and the retained youtube.com entries are now
  commented as trailer-only (TMDB serves trailers through YouTube; no YouTube account, search, or feed integration
  exists).
- **Secret exposure:** the real `.env` was previously committed. It is now git-ignored, staged as a deletion
  (`D .env`), and the local file was left untouched — no value was printed, copied, or rewritten, and git history was
  not altered. The committed variables that must be rotated are: `NEXT_PUBLIC_TMDB_API_KEY`, `FIREBASE_ADMIN_PRIVATE_KEY`,
  `YOUTUBE_*`, `SPOTIFY_*`, `TIKTOK_*`, and `MATRIX_HOOKSHOT_WEBHOOK_URL`.
- **A missing TMDB key used to fail the production build, and did so on unrelated pages.** `app/not-found.tsx` awaited
  `getTrendingHero()`, and `app/(routes)/page.tsx` awaited four TMDB calls with no error handling. Because Next.js
  prerenders the 404 boundary alongside static routes, an unconfigured server failed while generating pages such as
  `/terms` (measured: `next build` exited 1 with `ConfigError: The TMDB proxy base URL is not configured` against
  `/terms`), and a runtime outage would have produced a 500 homepage. Fixed at the cause: `lib/tmdb/server.ts` now also
  exports non-throwing `safeTrendingHero` and `safeServerMediaPage` wrappers that log the problem server-side (variable
  name and hint only, never a credential), the 404 boundary and homepage use them, empty rows are skipped instead of
  rendering an empty rail, and the homepage shows an explicit "Movie and TV metadata is unavailable" notice pointing at
  `docs/ENVIRONMENT.md`.

### 10.6 Verification for this pass (commands actually run)

All commands were run from the project root with `PATH` prefixed by the local Node/pnpm directory
(`C:\Users\sleepy\bin`), invoking the tools directly (`node ./node_modules/...`) because the project's
`pnpm` scripts cannot see `node` on the Windows PATH.

| Check | Command | Result |
| --- | --- | --- |
| Typecheck | `node ./node_modules/typescript/bin/tsc --noEmit` | exit 0, no errors (re-run after the final edits) |
| Unit tests | `node ./node_modules/vitest/vitest.mjs run` | **6 files, 44 tests, all passing** |
| Test quality (mutation check) | temporarily broke `normalizeAnimeId` and `normalizeAnimeEpisodeList`, re-ran the suite, then restored both files | each mutation produced a failure (43/44 passing), proving the suites are not vacuous; files were restored from backup and re-verified at 44/44 |
| Production build | `node ./node_modules/next/dist/bin/next build` | pass; 32 routes including the new `/anime/[id]` and `/anime/[id]/watch`; `/anime` is static (5m revalidate) |
| Route sweep (HTTP) | `curl` against `http://127.0.0.1:3000` | `/`, `/movies`, `/tv`, `/anime`, `/manga`, `/live`, `/search`, `/mylist`, `/settings`, `/contact`, `/privacy`, `/terms`, `/safety`, `/under-13`, `/anime/154587`, `/anime/154587/watch`, `/title/movie/550`, `/title/tv/1399` → 200; `/nonexistent-xyz` → 404; `/youtube`, `/tiktok`, `/spotify`, `/ai` → 404 |
| API surface | `curl` | `/api/anime?resource=status` → provider facts (200, no network call); `/api/anime?resource=top` → 502 `anipm-unreachable` on this network (documented limitation, see 10.7); `/api/manga?resource=list&kind=popular` → 200 with real data (Na Honjaman Level-Up, 200 chapters); `/api/tmdb?path=/trending/all/day` → 200 with 20 real results; `/api/live/matches` and `/api/live/sports` → 200; `/api/live/best` → 405 for GET (it is a POST endpoint, called that way by `lib/live/client.ts`) |
| Homepage content | `curl http://127.0.0.1:3000/` | server-rendered rows present (Trending Now, Popular Movies, Popular TV, Top Rated) carrying real TMDB ids |
| Anime discovery (browser, production build) | browser preview on `/anime` | 30 real Ani.pm cards (Black Clover, One Piece, Naruto: Shippuden, Bleach, …); the browser-direct fetch to `ani.pm/api/partner/v1/top` returned **200** with real items; no error text rendered |
| Anime detail (browser) | `/anime/97940` | Black Clover; 170 episode buttons; "170 / 170" SUB/DUB counts; watch link `/anime/97940/watch?episode=1`; AniList id shown with its MyAnimeList counterpart |
| Anime player (browser) | `/anime/97940/watch?episode=1` | `window.AniPM.Player` loaded from the documented SDK; frame `https://ani.pm/embed/ani/97940/1/sub?autoplay=1`; custom controls rendered (seek, previous/next episode, ±10 s, mute, speed, subtitles, theater, fullscreen); playback advanced (0:38 / 23:56) |
| Resume correctness (browser) | wrote a 600 s saved position into `localStorage.grubx_progress`, reloaded the watch page | frame became `…/1/sub?start=600&autoplay=1`, the seek slider read 600/1436, and the record advanced 600 → 601 without restarting playback; a different episode (`?episode=2`) received **no** `start` parameter |
| Progress persistence (browser) | played an episode, then read `localStorage.grubx_progress` | one record written: `{ mediaId: "97940", mediaType: "anime", title: "Black Clover", episode: 1, currentTime, duration: 1436, progress }` |
| Continue Watching / My List (browser) | `/mylist` | anime row labelled "EPISODE 2" with a working `/anime/97940/watch?episode=2` resume link, alongside the pre-existing manga rows |
| Missing-provider build | `TMDB_API_KEY= NEXT_PUBLIC_TMDB_API_KEY= TMDB_PROXY_BASE= NEXT_PUBLIC_TMDB_PROXY_BASE= node ./node_modules/next/dist/bin/next build` | exit 0 — the production build no longer depends on provider credentials (this exact command exited 1 before the fix, failing on `/terms`) |
| Missing-provider runtime | a second `next start` on `127.0.0.1:3100` with the same empty variables | `/`, `/movies`, `/tv`, `/anime`, `/manga`, `/live`, `/search`, `/mylist`, `/terms`, `/settings` → 200; `/nonexistent-xyz` → 404; `/api/tmdb` → `503 {"code":"tmdb-not-configured"}`; `/api/anime?resource=status` → 200; the homepage rendered the "Movie and TV metadata is unavailable" notice; the server log line carried the variable name and hint and no credential. That server was then stopped |
| Console health (browser) | fresh tab on the watch route | no console errors and no failed requests; only benign warnings from the third-party SDK frame about setting both `allow` and `allowfullscreen` |
| Lint | — | **not run**: the project has no ESLint config and no lint script. Reported as a limitation rather than as a pass. |

Test data created during browser verification (one injected anime progress record) was deleted afterwards; the two
pre-existing manga progress entries were left untouched.

### 10.7 Remaining limitations after this pass

- **Ani.pm is unreachable from this machine's server runtime.** Both `curl` and Node `fetch` calls to
  `ani.pm/api/partner/v1` fail on this network (Cloudflare challenges non-browser clients). That is why the anime
  catalogue client calls the provider directly from the browser first and uses `/api/anime` only as a fallback. The
  browser path is verified working; the server path is verified to fail *clearly* (502 with `anipm-unreachable`) rather
  than silently. Operators on a similar network should set `NEXT_PUBLIC_ANIME_API_BASE` to their own proxy.
- No lint step exists in the project, so no lint result is claimed.
- Live TV still runs on the pre-existing public sources. It was smoke-verified (guide renders, APIs 200) but was not
  rebuilt in this pass.
- Providers whose documentation contradicts itself about their live message schema (VidCore) or whose list endpoints are
  unconfirmed (VidRock) were deliberately left at their documented, validated behaviour rather than being extended on a
  guess.
- Account-based sync still does not exist. Progress and My List are local-first, and the UI states that plainly.

### 10.8 Server (current)

- Command: `node ./node_modules/next/dist/bin/next start -p 3000 -H 127.0.0.1` serving the production build, with the
  log at `.tmp/grubx-server.log` and the listener PID recorded in `.tmp/grubx-server.pid`.
- URL: <http://127.0.0.1:3000> — verified responding (homepage 200) with the anime, manga, movie, TV, live, search, and
  My List journeys exercised against this production server.
- The `next dev` server left running by the previous session was identified as this project's own process before being
  stopped, and was replaced by the production server above.
- No commit, push, merge, deploy, or git-history rewrite was performed; every change remains uncommitted in the working
  tree.
