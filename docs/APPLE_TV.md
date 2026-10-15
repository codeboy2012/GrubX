# GrubX — Apple TV (tvOS) Route

Status: **verified route, not produced here**. This host (Windows) has no
macOS/Xcode, so no tvOS build artifact or IPA exists, and none should be
claimed. Nothing below fabricates a build; it documents the exact verified
route, its requirements, and its open blockers.

## 1. Verification of the current stack

- Native app stack (**native/**): Expo SDK 57 (`expo ~57.0.30`), React Native
  `0.86.3` (official Meta release), `react-native-screens`, `expo-router`,
  `expo-screen-orientation`, `react-native-webview`.
- `native/app.json` declares an `ios` target but no `tvos` target and no
  TV config plugin. `npx expo prebuild` / `expo run:ios` on this SDK produces an
  **iOS** app, not a tvOS app.
- Conclusion: **the stack as-is cannot produce a valid tvOS application.**
  Do NOT rename the iOS `.ipa` and present it as an Apple TV app.

## 2. The supported tvOS route (verified against Expo docs + npm registry)

Expo's official TV guide (https://docs.expo.dev/guides/building-for-tv/) and the
community fork, both checked on 2026-10-15:

1. **Version match exists.** Expo SDK 57 depends on React Native 0.86.3, and
   the TV fork publishes exactly `react-native-tvos@0.86.3-0` on npm.
   In `native/package.json`:
   - `"react-native": "npm:react-native-tvos@0.86.3-0"`
   - add `"expo": { "install": { "exclude": ["react-native"] } }` so
     `expo install` version validation does not fight the fork.
2. **Add the TV config plugin:** `npx expo install @react-native-tvos/config-tv`
   (listed in `app.json` → `plugins`; `@react-native-tvos/config-tv@0.1.7`
   current). It rewrites `ios/` (Podfile, Xcode project, splash) for tvOS when
   `EXPO_TV=1`; Android unchanged — our existing `withGrubxTv` plugin keeps the
   Android TV leanback wiring.
3. **Prebuild for TV:** `EXPO_TV=1 npx expo prebuild --clean` (requires `--clean`
   because committed `android/`/`ios/` directories exist via CNG).
4. **Build on macOS only:** requirements are macOS with **Xcode 16+** and
   tvOS SDK 17+ (`xcodebuild -downloadAllPlatforms`). `npx expo run:ios` builds
   and runs on an Apple TV simulator; `xcodebuild -archive`/`exportArchive`
   produce the real artifacts. Windows cannot run these steps.

## 3. Signing, provisioning, installation

- An Apple Developer account is required for distribution (and for device
  install beyond the free-profile limits). tvOS reuses the iOS bundle ID and
  distribution certificates but **does not use iOS provisioning profiles** —
  create a tvOS profile in the Apple developer portal for the bundle ID
  (`org.grubx.app`) and attach it at export.
- An **unsigned IPA does not install directly** on any Apple TV. Unsigned
  artifacts can only run via Xcode/simulator development workflows. Device
  installs require the Apple TV to be registered with the same Apple ID used
  for the development provisioning profile.
- **User-facing install note (used verbatim on the /download page):** an
  unsigned IPA requires a compatible, user-controlled signing and installation
  method (personal Xcode install, your own certificate, or your chosen tool).
  GrubX provides no certificates and cannot promise a direct install; free
  personal signing profiles expire on Apple's schedule.
- App Store distribution is **not** required for personal installs (per above),
  but Ad-hoc/TestFlight routes cover anything else. If using EAS with a
  tvOS-only build, credentials go into EAS manually (see Expo guide §8);
  for combined iOS+tvOS use local tvOS credentials.
- **Only download GrubX artifacts from the official repository
  (https://github.com/CodeBoy2012/GrubX). Never third-party APK/IPA mirrors;**
  a GrubX logo or filename proves nothing — verify SHA-256 checksums from the
  official release notes before trusting any artifact.

## 4. tvOS product behavior (if/when produced)

- Navigation: React Navigation/Tabs already used; on tvOS focus follows the
 UIKit focus engine; our `TvTabBar`/`Poster` focus-ring work transfers.
- Search: remote-keyboard input (`TextInput`) uses tvOS `TextInput` behavior — verify.
- Playback: current movie/TV/anime playback renders the provider's player page
  in `react-native-webview`. **Webview is not a supported tvOS capability**
  (`WKWebView` is unavailable to tvOS apps outside clip contexts), so the
  provider-embed playback path will NOT work on tvOS as built today. A tvOS
  client must implement playback natively (e.g. AVPlayer for direct HLS
  sources the app itself resolves) or with an Expo Video integration — this is
  the largest real product gap, larger than tooling.
- Live TV: `app/api/live/*` endpoints are plain HTTP; a tvOS client can consume
  them the same way the mobile app does (`native/src/lib/api.ts`).

## 5. Cross-checks (mobile parity)

- The iOS phone target keeps building exactly as before: do steps 6 of the
  Expo guide (`unset EXPO_TV && npx expo prebuild --clean`) to revert TV
  changes before phone releases.
- The Android TV APK is unaffected by any of the above (`native/android` is
  generated from the committed config regardless of `EXPO_TV`).

## 6. Exact blockers (in order)

1. No macOS host / Xcode toolchain on this Windows machine — no compile,
   simulator, or archive possible.
2. No Apple Developer account on record — no signing identity,
   provisioning profile, or device registration.
3. Playback redesign for tvOS (webview gap, §4).
4. fork/dependency audit: full `pnpm install` of the tvOS fork and running the
   app's test suite against it must be done on the mac host before committing
   the swap to `main`.

Next step when a mac host is available: perform §2.1–2.4 in a branch
(`expo-tvos-prototype`), build against the Apple TV simulator, then evaluate §4.
