# GrubX

## Project lineage and license

GrubX is a **revival and continuation of the original GrubX project by [SRGuyYT](https://github.com/SRGuyYT/GrubX)**.
This repository ([CodeBoy2012/GrubX](https://github.com/CodeBoy2012/GrubX)) is a fork maintained by its current
contributors; it does **not** claim authorship or ownership of the original project or organization. The original
**MIT License with its SRGuyYT copyright notice is preserved** in [`LICENSE.md`](LICENSE.md) — attribution and original
copyright are inherited with the code and must not be removed.

**Official source and downloads:** [CodeBoy2012/GrubX](https://github.com/CodeBoy2012/GrubX) and its
[Releases](https://github.com/CodeBoy2012/GrubX/releases). Never trust third-party APK/IPA mirrors; verify
checksums from the official release notes. Details: [`/download`](app/(routes)/download/page.tsx).

---

GrubX is a local-first entertainment platform built with the Next.js App Router. It brings **five** categories into one
coherent, cinematic interface: **Movies, TV Shows, Anime, Manga, and Live TV**. Discovery, detail pages, search, My List,
Continue Watching / Continue Reading, and a real reader and player are all part of the product.

GrubX does not provide content. Every title, episode, chapter, channel, and stream comes from the configured provider and
is played or read inside that provider's own player or reader. Availability depends entirely on those providers.

## Categories and where their data comes from

| Category | Source | Key required |
| --- | --- | --- |
| Movies | TMDB via the server-side `/api/tmdb` proxy | Yes (`TMDB_API_KEY`) |
| TV Shows | TMDB (seasons, episodes, trailers) | Yes (`TMDB_API_KEY`) |
| Anime | Ani.pm public catalogue (`/api/partner/v1`) + Ani.pm player SDK and embeds | No |
| Manga | MangaDex public read API + GrubX's own chapter reader | No |
| Live TV | Public live sources wired into `app/api/live/*` | No |

Identifiers are never mixed: TMDB ids, AniList ids, MyAnimeList ids, MangaDex UUIDs, and provider-specific ids each stay
with their own provider. Anime and manga are structurally prevented from reaching TMDB endpoints.

## Highlights

- Cinematic dark UI: hero, poster rails, responsive grids, skeletons, empty and error states, reduced-motion support
- One search across movies, TV, anime, and manga, each using its own provider
- Anime discovery (trending, top rated, recently updated, airing schedule, genre filters), detail pages with real per
  episode SUB/DUB availability, and a player driven by the Ani.pm SDK with episode navigation and resume
- Manga discovery, detail pages, and a distraction-free reader with single-page and vertical modes
- Live TV guide with channels, categories, now-playing information, and favourites
- Local-first My List, Continue Watching, and Continue Reading with normalized progress records
- Movie/TV player with per-provider adapters, validated iframe messages, and a provider selector
- Offline-first app shell (service worker) and a local control panel for safety, providers, cache, and playback

## Stack

- Next.js 16 (App Router, Turbopack)
- React 19 + TypeScript
- TanStack Query 5
- Tailwind CSS 4

## Multi-platform apps

GrubX ships one API and one set of routes across every form factor:

| Platform | Where | Notes |
| --- | --- | --- |
| Website (desktop + general web) | `https://` host, e.g. `grub.sky0cloud.dpdns.org` | Top navigation, full settings panel |
| Mobile website | `mobile.` subdomain of the same host, e.g. `mobile.grub.sky0cloud.dpdns.org` | Mobile-first shell: compact top bar and bottom tab bar |
| Android phone/tablet | APK built from [`native/`](native/) (`eas build -p android --profile phone-production`) | Installable APK; WebView player |
| iOS | Unsigned IPA built from `native/` (`eas build -p ios --profile ios-unsigned`) | Signed by the user with their own certificate |
| Android TV | APK built from `native/` (`eas build -p android --profile tv-production`) | Leanback launcher enabled, D-pad focus order |
| Apple TV (tvOS) | Build from `native/` (`eas build -p ios --profile tvos-production`) | Same Expo app, TV layout tokens |

The native app (Expo / React Native, in [`native/`](native/)) consumes the **same Next.js API routes** (`/api/tmdb`,
`/api/anime`, `/api/manga`, `/api/live/*`, `/api/player/resolve`) and stores My List and playback progress locally with
the same record shape as the web's data layer — no server-side accounts, matching the website.

**Mobile website**: any request served from a `mobile.*` host (or a device that chose mobile via the persisted
`grubx-device` cookie, set with a one-time `?device=mobile` / `?device=desktop` visit) is rendered with
`components/shell/MobileShell.tsx` instead of the desktop shell. Pages and API routes are shared 1:1; only the shell
branches. Configure the subdomain in your reverse proxy as `mobile.<host>` → the same GrubX server — no separate
deployment is needed. Until DNS + TLS for the subdomain are verified, the same experience is reachable at
`https://grub.<host>/?device=mobile`.

Native apps need a `EXPO_PUBLIC_API_BASE` at bundle time pointing at the GrubX origin; EAS profiles set it via the
values in [`native/eas.json`](native/eas.json), and `development` uses the `grub.` origin by default.

## Install and run

```bash
pnpm install          # install dependencies (lockfile is committed; keep it)
cp .env.example .env  # then fill in the values you need
pnpm dev              # development server
pnpm build            # production build
pnpm start            # serve the production build
pnpm typecheck        # tsc --noEmit
pnpm test             # vitest run
```

`./manage.sh` wraps the same lifecycle commands.

### Native app checks (from `native/`)

```bash
pnpm install
pnpm exec tsc --noEmit   # typecheck
pnpm exec eslint src     # lint
pnpm dlx expo-doctor     # config + dependency validation
```

## Environment setup

Everything GrubX reads is documented in [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md); `.env.example` is the shareable
template, organized by feature. The short version:

| Variable | Required | Notes |
| --- | --- | --- |
| `TMDB_API_KEY` | For Movies/TV/Search | **Secret, server-side only.** |
| `TMDB_PROXY_BASE` | For Movies/TV/Search | TMDB-compatible base URL. |
| `NEXT_PUBLIC_ANIME_API_BASE` | No | Optional Ani.pm base override; the public endpoint needs no key. |
| `NEXT_PUBLIC_MANGA_API_BASE` | No | Optional MangaDex-compatible mirror. |
| `NEXT_PUBLIC_VIDKING_BASE` | No | Movie/TV embed base override. |
| `MATRIX_HOOKSHOT_WEBHOOK_URL` | No | Server-side admin alert webhook. |

Notes:

- `.env` is git-ignored and must never be committed.
- A missing provider key never breaks unrelated features **or the build**: configuration is validated lazily, the
  TMDB-backed rows are skipped, `/api/tmdb` answers `503 tmdb-not-configured`, and the homepage renders an explicit
  "Movie and TV metadata is unavailable" notice. Verified by building and running with the TMDB variables empty.
- Legacy `NEXT_PUBLIC_TMDB_*` names still work but are browser-visible by convention — treat any value stored there as
  compromised and rotate it.

## Provider configuration

- **TMDB**: the only required provider. Without it, Movies, TV, and Search explain that metadata is not configured while
  Anime, Manga, and Live TV keep working.
- **Ani.pm**: keyless. The browser calls the public catalogue directly and GrubX falls back to `/api/anime` when the
  direct call is blocked; the player is loaded from `https://ani.pm/embed/sdk/v1.js` only on anime watch pages. If the
  SDK cannot load, the page falls back to the provider's own frame and hides controls it cannot operate.
- **MangaDex**: keyless. Only `safe` and `suggestive` content ratings are requested.
- **Live TV**: no credential. Unavailable sources are reported honestly.
- **Embed allowlist**: movie/TV playback is restricted to the providers registered in `lib/grubx/providers.ts`. User
  input can never choose a server-side fetch destination.

## Architecture

- `app/` — routes and controlled API routes (`/api/tmdb`, `/api/anime`, `/api/manga`, `/api/live/*`, `/api/player/resolve`)
- `components/` — shell, media, anime, manga, live, settings, feedback, and system UI
- `lib/anime/` — Ani.pm types, identifiers, embed builder, normalizers, provider, client, and player adapter
- `lib/manga/` — MangaDex provider behind a `MangaProvider` interface
- `lib/tmdb/` — allowlisted, server-only TMDB access
- `lib/grubx/` — provider registry, iframe controller, safety matrix, watch party helpers
- `lib/env.ts` — centralized, lazily validated environment configuration
- `lib/dataLayer.ts` — the single local persistence boundary (settings, watchlist, progress, live history)
- `config/appConfig.ts` — feature flags, provider defaults, safe-browsing policy

## Testing

```bash
pnpm test        # unit suites under tests/
pnpm typecheck   # type-level verification
pnpm build       # production build must succeed
```

`tests/` covers anime identifier and embed-URL validation, `/api/anime` request validation, catalogue normalization,
route/image resolution across content types, settings migration/sanitization, the TMDB path allowlist, and the absence of
the removed integrations. External providers are not called by the test suite; provider behaviour is verified manually
against the live APIs and recorded in [`docs/GRUBX_FULL_SITE_AUDIT.md`](docs/GRUBX_FULL_SITE_AUDIT.md).

## Known limitations

- Ani.pm's catalogue is unreachable from **some** server networks (Cloudflare challenges non-browser clients). Anime
  pages therefore fetch in the browser first and use `/api/anime` as a fallback; `NEXT_PUBLIC_ANIME_API_BASE` can point at
  your own proxy for networks where both are blocked.
- Chapter, episode, and stream availability is whatever the provider reports. Titles the provider has not published show
  an explicit unavailable state rather than a placeholder.
- Live TV depends on the public sources already wired into `app/api/live/*`; when they are down, the guide says so.
- Accounts with cross-device synchronization are available when a `DATABASE_URL` (Neon Postgres) is configured;
  without it every GrubX feature except accounts keeps working fully offline. Outbox-queued sync writes flush on
  reconnection, and the sync API is schema-guarded per process.
- Invalid `/title/...` and `/manga/...` identifiers render the not-found view with a streamed 200 status (a Next.js
  streaming artifact).
- The web workspace runs on typecheck + vitest; ESLint is configured for the native workspace (`native/`), not the web.

## Deployment note

The intended production domains — `grubx.dpdns.org` (main website) and `mobile.grubx.dpdns.org` (mobile website) — are
**pending deployment by design**: they will go online via a Cloudflare Tunnel after this repository is cloned onto the
Linux server. A lack of DNS or HTTP responses is not a deployment failure; do not treat mirror domains as official in
the meantime. Deployment procedure and rollback plan live in [`docs/RELEASE.md`](docs/RELEASE.md).

## Legal

GrubX embeds third-party players and readers and re-hosts no content. See [`LEGAL.md`](LEGAL.md) and
[`SECURITY.md`](SECURITY.md).
