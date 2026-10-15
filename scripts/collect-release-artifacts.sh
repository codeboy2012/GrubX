#!/usr/bin/env bash
#
# GrubX release artifact collection.
#
# Stages every produced artifact into release/, writes SHA-256 checksums,
# sizes, and version metadata, and assembles a release-notes scaffold.
# Intentionally does NOT create tags, GitHub releases, or uploads — publishing
# is a separate, explicit step (see docs/RELEASE.md "Publication guardrails").
#
# Usage:  bash scripts/collect-release-artifacts.sh
# Needs:  bash, sha256sum or shasum, python3 or python (for string dump), aapt2
#         from ANDROID_HOME/build-tools when staging Android artifacts.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

RELEASE_DIR="$ROOT_DIR/release"
VERSION="$(node -p "require('./package.json').version" 2>/dev/null || echo unknown)"
NATIVE_VERSION="$(node -p "require('./native/package.json').version" 2>/dev/null || echo unknown)"

log() { printf '[release] %s\n' "$*"; }
fail() { printf '[release] Error: %s\n' "$*" >&2; exit 1; }

# --- checksum helper (macOS has shasum, Linux/Git-Bash have sha256sum) -------
sha() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
  else
    fail "neither sha256sum nor shasum found"
  fi
}

mkdir -p "$RELEASE_DIR"

# --- Android APK artifacts ---------------------------------------------------
APK_DIR="$ROOT_DIR/native/android/app/build/outputs/apk/release"
APK_NAME="grubx-${VERSION}-android-universal-release.apk"
APK_SRC="$APK_DIR/app-release.apk"

APK_RECORD=""
if [[ -f "$APK_SRC" ]]; then
  cp "$APK_SRC" "$RELEASE_DIR/$APK_NAME"
  SIZE=$(wc -c < "$RELEASE_DIR/$APK_NAME" | tr -d ' ')
  SUM=$(sha "$RELEASE_DIR/$APK_NAME")
  APK_RECORD="$APK_NAME|$SIZE|$SUM"
  log "APK staged: $APK_NAME (size=$SIZE)"
  # Version + manifest metadata straight from the artifact (aapt2, not docs).
  for bt in "${ANDROID_HOME:-}"/build-tools/*/aapt2.exe /usr/local/lib/android/sdk/build-tools/*/aapt2 "${ANDROID_SDK_ROOT:-}"/build-tools/*/aapt2; do
    if [[ -f "$bt" ]]; then
      AAPT2=$(cygpath -u "$bt" 2>/dev/null || echo "$bt")
      break
    fi
  done
  if [[ -n "${AAPT2:-}" ]]; then
    set +e
    BADGING=$("$AAPT2" dump badging "$APK_SRC" 2>/dev/null)
    set -e
    PKG_INFO=$(printf '%s\n' "$BADGING" | grep -E "^package:" | head -1 || true)
    SDK_INFO=$(printf '%s\n' "$BADGING" | grep -E "^sdkVersion|^minSdkVersion|^targetSdkVersion" | head -3 | tr '\n' ' ')
    LEANBACK=$(printf '%s\n' "$BADGING" | grep -c "leanback-launchable" || true)
    if [[ -z "$PKG_INFO" ]]; then
      PKG_INFO="badging unavailable"
    fi
    log "aapt2 badging: $PKG_INFO"
    log "sdk: $SDK_INFO | leanback-launchable=${LEANBACK:-0}"
  else
    PKG_INFO="aapt2 not found; badging not captured"
    SDK_INFO=""
    LEANBACK=""
  fi
else
  log "No APK found at $APK_SRC — Android artifacts skipped (must be built separately)."
  PKG_INFO="not built"
  SDK_INFO=""
  SIZE=0
  SUM=""
fi

# --- native JS typecheck/test signatures (provenance) ------------------------
NODE_VER=$(node --version 2>/dev/null || echo missing)
PNPM_VER=$(pnpm --version 2>/dev/null || corepack pnpm --version 2>/dev/null || echo missing)
GIT_HASH=$(git rev-parse HEAD 2>/dev/null || echo unknown)
GIT_DIRTY=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')

# --- website check: Next.js build output present and non-trivial -------------
WEB_STATUS="not built"
if [[ -d .next ]]; then
  WEB_FILES=$(find .next -type f 2>/dev/null | wc -l | tr -d ' ')
  if [[ "$WEB_FILES" -gt 100 ]]; then
    WEB_STATUS="built (${WEB_FILES} files; served from source via manage.sh, no separate deploy artifact)"
  else
    WEB_STATUS="suspiciously small (${WEB_FILES} files)"
  fi
fi

# --- checksums file ----------------------------------------------------------
SUM_FILE="$RELEASE_DIR/SHA256SUMS.txt"
: > "$SUM_FILE"
if [[ -n "$SUM" ]]; then
  printf '%s  %s\n' "$(sha "$RELEASE_DIR/$APK_NAME")" "$APK_NAME" >> "$SUM_FILE"
fi

# --- release notes scaffold ---------------------------------------------------
NOTES="$RELEASE_DIR/RELEASE_NOTES.md"
cat > "$NOTES" <<EOF
# GrubX v${VERSION} — release notes (scaffold, edit before publishing)

**Download GrubX only from the official repository: https://github.com/CodeBoy2012/GrubX**

For your safety, avoid downloading GrubX APKs, IPAs, or other installers from unofficial websites, re-uploads, file-sharing links, or accounts claiming to represent GrubX without verification. Unofficial copies may be modified, contain malicious code, collect unnecessary information, or compromise your privacy. Websites can also collect information about your browser and device; do not assume an unfamiliar mirror is safe. Only treat a domain as an official GrubX service when its ownership and configuration have been verified — similar-looking domains do not establish authenticity.

- GrubX git commit: \`${GIT_HASH}\` (uncommitted changes: ${GIT_DIRTY} files)
- Web version: ${VERSION} — ${WEB_STATUS}
- Native version: ${NATIVE_VERSION} — node ${NODE_VER}, pnpm ${PNPM_VER}

## Android (universal APK — phone/tablet + Android TV in one artifact)

- Package: ${PKG_INFO}
- SDK info: ${SDK_INFO}
- Leanback launcher present: ${LEANBACK}
- File: \`${APK_NAME}\`
- Size: ${SIZE} bytes
- SHA-256: \`${SUM}\`

A single universal APK contains both the phone/tablet launcher activity and the
Android TV LEANBACK_LAUNCHER. The app switches its phone UI or 10-foot D-pad UI
at runtime based on the device (Platform.isTV), so separate phone/TV artifacts
would be identical; they are intentionally not duplicated here.

## Installation

1. Download the APK and the SHA256SUMS.txt **from this official release only** (never from mirrors).
2. Verify before installing (Windows: `certutil -hashfile <file> SHA256`), or: sha256sum -c SHA256SUMS.txt
3. An unsigned iOS IPA, when published in later releases, requires your own compatible signing and installation method — it cannot be installed directly on its own.
3. Android 8+: allow "Install unknown apps" for your file manager, install the
   APK, then on Android TV launch it from the TV home ("Apps" row).

## What is NOT in this release (and why)

- **iOS/iPadOS IPA**: unsigned IPAs require a macOS Xcode toolchain. This
  release pipeline runs on hosted Linux runners or a Windows build host; no
  macOS toolchain is involved, so no IPA exists. The EAS profile
  \`ios-unsigned\` in native/eas.json documents the supported route (see
  docs/APPLE_TV.md). Never trust an "iOS" artifact produced by renaming an
  Android APK or any non-IPArchive file.
- **tvOS**: documented route only (react-native-tvos@0.86.3-0), needs macOS +
  Xcode 16+; see docs/APPLE_TV.md §2–4.

## Licensing / open-source distribution limits

GrubX ships only its own code and no media. All catalog content comes from
third-party providers (TMDB metadata, Ani.pm, MangaDex, streamed.pk); their
terms govern redistribution of that content, and GrubX does not mirror or
re-host provider media. Shipping the app does not grant rights to provider,
TMDB, or Apple/Google platform content. The git checkout is the source
distribution; no store publication is assumed.
EOF

log "Release notes scaffold: $NOTES"
log "Staged artifacts:"
ls -la "$RELEASE_DIR"
