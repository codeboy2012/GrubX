# GrubX environment configuration

GrubX reads every setting it uses from **real code**, and all of it goes through
one typed module: [`lib/env.ts`](../lib/env.ts). There are no speculative
variables in [`.env.example`](../.env.example).

Copy the template and fill it in:

```bash
cp .env.example .env
# then edit .env
```

`.env` is git-ignored. Never commit it, never paste its values into an issue, and
never add a secret with a `NEXT_PUBLIC_` prefix unless the value is genuinely
public.

**Nothing throws at import time.** A missing key is raised only when the feature
that needs it runs, so an unconfigured provider cannot break the production
build or an unrelated route. A missing TMDB key makes `/api/tmdb` answer
`503 { "code": "tmdb-not-configured" }` while Movies, TV, Anime, Manga, and Live
TV pages still render and explain themselves.

## 1. Application settings

| Variable | Required | Feature | Public/secret | Format | Default |
| --- | --- | --- | --- | --- | --- |
| `FRONTEND_URL` | Optional | Absolute links, provider redirect URIs | Public | `https://host` | Request origin |
| `NEXT_PUBLIC_APP_URL` | Optional | Client-side canonical URL | Public | `https://host` | Request origin |

Both are plain origins with no trailing path.

## 2. Movie and TV metadata — TMDB

Required for the Movies, TV, and Search features.

| Variable | Required | Public/secret | Format | Default |
| --- | --- | --- | --- | --- |
| `TMDB_PROXY_BASE` | **Required** for Movies/TV | Public base, key is not | `https://host[/path]` | none |
| `TMDB_API_KEY` | **Required** for Movies/TV | **Secret — server-side only** | TMDB v3 key or v4 token | none |
| `NEXT_PUBLIC_TMDB_PROXY_BASE` | Deprecated alias | Public | `https://host` | none |
| `NEXT_PUBLIC_TMDB_API_KEY` | Deprecated alias | **Must be treated as secret** | as above | none |

- What it does: `TMDB_PROXY_BASE` is the API host; `TMDB_API_KEY` is appended by
  server code as `api_key` on the upstream request.
- Where to obtain it: <https://www.themoviedb.org/settings/api>.
- Which feature needs it: movie/TV discovery, detail pages, trailers, genres, and
  the TMDB-backed half of Search.
- Troubleshooting:
  - `/api/tmdb` returns `503 tmdb-not-configured` → neither `TMDB_API_KEY` nor
    the legacy alias is set.
  - `/api/tmdb` returns `502` → the proxy host rejected the request, most often a
    wrong or expired key, or the proxy host itself is unreachable.
  - Only allowlisted TMDB paths are forwarded; any other path returns `400` by
    design (see [`lib/tmdb/request.ts`](../lib/tmdb/request.ts)).

### Secret hygiene

The legacy `NEXT_PUBLIC_TMDB_API_KEY` name is browser-visible **by convention**
and must be considered compromised if it was ever used. GrubX no longer reads it
in client code, but because the name exists, treat any value stored there as
public.

**Recommended action:** set `TMDB_API_KEY` (secret scope), remove
`NEXT_PUBLIC_TMDB_API_KEY`, and rotate the TMDB key if that variable's value was
ever present in the repository or in git history. The same applies to any
provider credential that was previously committed. Rotation is done in the
providers' dashboards; GrubX does not rewrite git history without explicit
authorization.

## 3. Anime catalogue — Ani.pm

| Variable | Required | Feature | Public/secret | Format | Default |
| --- | --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_ANIME_API_BASE` | Optional | Anime catalogue + playback | Public (no key needed) | `https://host/api/partner/v1` | `https://ani.pm/api/partner/v1` |

- What it does: sets the Ani.pm partner API base used by the browser-direct
  catalogue client and by the server route fallback.
- Where to obtain it: the default is Ani.pm's public endpoint
  (<https://ani.pm/developers>). No key, signup, or quota is required for public
  catalogue requests or standard embeds.
- Which feature needs it: the Anime category and anime results in Search.
- Troubleshooting:
  - Anime pages say the catalogue is unavailable → this network blocks
    `ani.pm` for non-browser clients. The browser normally reaches it directly;
    `/api/anime` is the fallback. Point this variable at your own proxy if the
    browser is blocked too.
  - Do **not** put an Ani.pm secret app key here. If a publishable app key
    (`pk_live_…`) is used, it is passed as the documented `key` embed parameter
    and is safe to expose; a secret key must stay server-side and is never read
    from a `NEXT_PUBLIC_` variable.

## 4. Embed providers

| Variable | Required | Feature | Public/secret | Default |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_VIDKING_BASE` | Optional | Movie/TV player | Public | `https://www.vidking.net/embed` |

VidFast, VidLink, VidCore, and VidRock are used through their documented public
embed URLs and need no configuration. Provider selection, message validation and
the allowlist live in [`lib/grubx/providers.ts`](../lib/grubx/providers.ts) and
[`lib/grubx/iframeController.ts`](../lib/grubx/iframeController.ts); a user can
never make the server fetch an arbitrary destination.

## 5. Manga — MangaDex

| Variable | Required | Feature | Public/secret | Format | Default |
| --- | --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_MANGA_API_BASE` | Optional | Manga discovery + reader | Public (no key needed) | `https://host` | `https://api.mangadex.org` |

- What it does: overrides the MangaDex base for self-hosted, API-compatible
  mirrors.
- The value is scheme-validated; anything that is not `http(s)` falls back to the
  default instead of being requested.
- Explicit content ratings are excluded by default in
  [`lib/manga/mangadex.ts`](../lib/manga/mangadex.ts).
- Troubleshooting: an empty or invalid value silently uses the default; chapters
  that MangaDex has not published are reported as unavailable rather than faked.

## 6. Live TV and live sports

No credential is required and none is supported. The live guide uses the public
endpoints already implemented under `app/api/live/*`. If those sources are
unreachable, the Live TV page shows an explicit unavailable state and the rest of
GrubX works normally.

## 7. Admin alerts — Matrix / Hookshot

| Variable | Required | Feature | Public/secret | Format |
| --- | --- | --- | --- | --- |
| `MATRIX_HOOKSHOT_WEBHOOK_URL` | Optional | Feedback and provider-report alerts | **Secret — server-side only** | `https://…` webhook URL |

- Used only in [`lib/grubx/matrix.ts`](../lib/grubx/matrix.ts), which is called
  from server routes.
- Leave blank to disable alerting; the routes then report that alerting is not
  configured instead of failing the user's request.

## Verifying your configuration

```bash
# Which variables does the code actually read?
grep -rn "process.env\." --include="*.ts" --include="*.tsx" lib app components hooks | grep -v node_modules

# Is the real env file ignored by git?
git check-ignore -v .env

# Are any secrets present in tracked files?
git grep -nE "sk-|pk_live|ClientSecret|PRIVATE KEY" -- .
```

## Rotating a leaked credential

1. Rotate the value in the provider's dashboard (TMDB, Firebase, Matrix, or an
   embed provider).
2. Put the new value in `.env` using the server-side variable name from this
   document — never a `NEXT_PUBLIC_` name for a secret.
3. Restart the server so the new value is loaded.
4. If the old value exists in git history, request history rewriting separately;
   GrubX never rewrites history on its own.
