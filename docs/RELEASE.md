GrubX release pipeline (v4.0.0)

## Official distribution points (trust anchors)

- **Official repository (the only download source):** https://github.com/CodeBoy2012/GrubX — **published publicly and verified reachable (HTTP 200)**; release assets are linked either to actual published assets or to the releases page (never invented download URLs while assets don't exist yet).
- **Lineage and license:** GrubX is a fork/revival of the original [SRGuyYT/GrubX](https://github.com/SRGuyYT/GrubX). [`LICENSE.md`](LICENSE.md) is the original MIT License with the SRGuyYT copyright notice, preserved intact; the fork does not claim authorship of inherited work.
- Intended official domains: `grubx.dpdns.org` (main), `mobile.grubx.dpdns.org` (mobile), with `grubx.xx.kg` and `mobile.grubx.xx.kg` as secondaries currently unavailable with no known restoration date.
- Domain status on 2026-10-15: **pending deployment by design** — they intentionally do not resolve until the repository is cloned to the Linux server and a Cloudflare Tunnel is configured. This is not a deployment failure, and no domain is presented as official or online until verified after deployment.
- Never link third-party APK/IPA mirrors. A GrubX logo, filename, or banner is not proof of authenticity; only checksum-verified official release assets count.
- The user-facing notice lives in the website's `/download` page ([components/legal/SecurityNotice.tsx](components/legal/SecurityNotice.tsx)), in the app's own install documentation, and in every generated `release/RELEASE_NOTES.md` scaffold.

## Targets and current status

| Target | Artifact | Status | Where |
| --- | --- | --- | --- |
| Main web application | Next.js production build, served from source via `./manage.sh stable` | verified locally (`pnpm build` exit 0) | this repository |
| Mobile website | the same Next.js app (responsive); no separate codebase | verified | same deployment |
| Android phone/tablet | `grubx-<version>-android-universal-release.apk` | built, checksummed | see §4 |
| Android TV | same universal APK semantics (below) | built, checksummed | see §4 |
| iOS/iPadOS unsigned IPA | **not produced** — requires a macOS Xcode toolchain | blocked; documented route native/eas.json `ios-unsigned`, docs/APPLE_TV.md | — |
| tvOS | **not produced** — macOS + Xcode 16 + react-native-tvos swap required | blocked; verified route in docs/APPLE_TV.md | — |

Nothing in this repository is released to the Apple App Store or Google Play.
No signed store builds exist. Do not trust, and do not produce, artifacts that
claim store distribution.

## 1. Publication guardrails

Publishing (creating a GitHub Release, tagging, or uploading release assets) is
an explicit, human-approved action:

- `.github/workflows/release.yml` runs with `workflow_dispatch` and **refuses to
  publish unless the `confirm_publish` input is literally `true`**. With
  `false`, the workflow only builds and validates, attaching artifacts to the
  (workflow run, not a public release).
- Locally, `scripts/collect-release-artifacts.sh` stages files into `release/`
  and never publishes anything.
- Releases, when published, must be **draft** first for final review
  (`gh release create -d`), then promoted manually.
- Nothing in the pipeline pushes, force-pushes, deletes branches, or overwrites
  existing release assets. If an asset name collides, the pipeline fails instead
  of overwriting.

## 2. Reproducible Android build

Toolchain (pinned by version, not "latest"):

- OpenJDK 21 — `JAVA_HOME` must point to it
- Android SDK: platform 36 (compile/license default via AGP auto-install),
  build-tools (any ≥35), NDK 27.1.x (matching AGP's requested version is fine)
- pnpm 9 with `node-linker=hoisted` (committed in `native/.npmrc`) — the
  default pnpm symlinked store creates paths >260 chars that break the NDK
  build on Windows; on Linux it is harmless and still faster than the default
  for this pipeline
- ninja 1.12+ replaces the SDK-bundled ninja 1.10 that cannot stat >260-char
  object paths (`cmake/*/bin/ninja.exe` swap; keep the `.bak`)

Commands:

```bash
# native app
cd native && pnpm install               # lockfile-frozen
npx tsc --noEmit                        # typecheck gate
cd android
./gradlew :app:assembleRelease          # produces app/build/outputs/apk/release/app-release.apk
```

Then `bash scripts/collect-release-artifacts.sh` stages
`grubx-<web-version>-android-universal-release.apk`, `SHA256SUMS.txt`, and a
release-notes scaffold with aapt2-read package/SDK info into `release/`.

Verify integrity yourself:

```bash
sha256sum -c release/SHA256SUMS.txt
$ANDROID_HOME/build-tools/<v>/aapt2 dump badging <apk>   # confirm package + leanback
```

### Why one "universal" APK instead of phone/TV variants

The APK intentionally declares BOTH the phone launcher intent and
`LEANBACK_LAUNCHER` (leanback feature `required=false`). The React Native app
decides phone vs 10-foot UI at runtime via `Platform.isTV`. The EAS profiles
differ only in their `GRUBX_DEVICE_KIND` env marker, which no build output code
consumes today, so two built artifacts would be byte-equal double work. If a
future change makes phone/TV configurations actually differ (different versions,
remove-on-phone features), add Gradle product flavors then and record both
checksums — until then this document is the source of truth for the decision.

## 3. iOS / tvOS: what is real and what is not

- This pipeline has no macOS host. `xcodebuild` cannot run on Linux/Windows, so
  **no IPA or tvOS artifact exists**. There is no "unsigned IPA" placeholder
  either — the report above shows the honest state.
- Supported route when a macOS host exists: `native/eas.json` profiles
  (`ios-unsigned`, `tvos-production`) via EAS Build, or plain `npx expo run:ios`
  after the documented `EXPO_TV` prebuild (docs/APPLE_TV.md §2).
- `ios-unsigned` builds require no Apple Developer account when sharing as a
  simulator-independent unsigned archive; but installing requires the user's
  own device, own Apple ID, signing method (e.g. free-provision via Xcode) and
  comports with Apple's current restrictions (7-day free-profile expiry for
  personal methods). GrubX does not provide certificates, profiles, or
  credentials anywhere.
- tvOS stays a **separate target and artifact** — never an iOS bundle renamed.

## 4. Secrets policy — including the incident found in this repo

Rules (enforced by CI where possible, reviewed by humans always):

- `.env` is git-ignored AFTER untracking in this repo (staged via
  `git rm --cached .env`); only `.env.example` with placeholder or documented
  non-secret defaults is committed. Any key file (`*.jks`, `*.keystore`,
  `*.p8`, `*.p12`, `mobileprovision`) stays out of git (`native/.gitignore`
  already covers them). Android release APKs remain unsigned; the release
  keystore (if later created for versioned updates) lives only on the signing
  host and is backed up outside git.
- **Incident:** `.env` containing real values (Firebase Admin credentials,
  Spotify and YouTube client secrets, TMDB key) is committed in git history
  up to now. Untracking fixes future commits but NOT history. Because the
  repository is public, treat those values as compromised:
  1. rotate every value in `.env` (Firebase Admin keys, OAuth client secrets,
     TMDB key, Matrix webhook),
  2. purge history (e.g. `git filter-repo --path .env --invert-paths`, then
     force-push — coordinate with collaborators and expect changed SHAs),
  3. acquire fresh Firebase admin credentials before the server restart.

  These are destructive/external operations, deliberately **not** executed
  by the release pipeline or this automation without explicit approval.

## 5. Open-source distribution and media licensing limits

- The git checkout is the entire distribution of GrubX's own work; no media
  files are shipped with the project (artwork is loaded at runtime from
  TMDB/Ani.pm/MangaDex/streamed.pk).
- Catalog content belongs to those providers and rights-holders; their API
  terms govern use. GrubX does not mirror, re-host, or cache-ttl-abuse provider
  media.
The project license is the **original MIT License (`LICENSE.md`), copyright
SRGuyYT**, inherited with the fork; the revival's fork does not claim original
authorship and preserves the attribution intact. Release notes carry the
official-source warning (generated by scripts/collect-release-artifacts.sh).
- Apple/Android platform terms govern what users may install and how; the
  project makes no claims about store distribution, sideloading on locked
  hardware, ordrm circumvention.
