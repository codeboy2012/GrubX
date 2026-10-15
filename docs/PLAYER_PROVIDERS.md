# GrubX player providers

GrubX embeds provider players in an iframe; it never proxies or re-hosts a
stream. Behavior modeled here reflects only what each provider's official
documentation (see `api-docs.txt`) states. This file records capabilities,
limitations, and how each adapter is verified.

## Adapter architecture

- `lib/grubx/playerEvents.ts` — normalized event model (`ready`, `play`,
  `pause`, `seeked`, `timeupdate`, `ended`), strict `embedOrigin()` extraction.
- `lib/grubx/playerAdapters.ts` — one adapter per provider: documented origin
  allowlist, inbound schema validation, outbound command allowlist.
- `lib/grubx/progressEngine.ts` — debounced persistence (10s), monotonic guard,
  pause/seek/ended forced flushes, `ended`/95% watched detection.
- `lib/grubx/useStrictPlayerBridge.ts` — binds a live iframe to both: every
  message must come from the exact same iframe (`event.source`) and match the
  origin the iframe was actually loaded from. Commands are sent with the
  iframe's real origin, never `"*"`.

Providers without a documented message API use `FALLBACK_ADAPTER`: no inbound
messages are trusted, no commands are sent.

## Providers

| Provider | Origin | Progress | Commands | Subtitles param | Next-episode params | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| VidFast | `vidfast.vc` + 7 documented mirrors | Yes (`PLAYER_EVENT`) | play/pause/seek/volume/mute/getStatus | `sub` | `nextButton`, `autoNext` | Documented §2 |
| VidLink | `vidlink.pro` | Yes (`PLAYER_EVENT`, `MEDIA_DATA`) | **Not documented** | `sub_file`/`sub_label` | `nextbutton` | Media id field documented as `mtmdbId`; not relied on |
| VidCore | `vidcore.io` | Yes (`PLAYER_EVENT`) | play/pause/seek/volume/mute/getStatus | `sub` | `nextButton`, `autoNext` | Documentation shows two message schemas; only `PLAYER_EVENT` is trusted |
| VidRock | `vidrock.net` | Yes (`PLAYER_EVENT`, `MEDIA_DATA`) | **Not documented** | `lang` | `nextbutton`, `autonext`, `episodeselector` | Documented §5 |
| Ani.pm | `ani.pm` | Yes (SDK / `ns=anipm.player` v1) | Full SDK + versioned postMessage | `subtitles` | `autonext` | SDK adapter: `lib/anime/player.ts` |
| Others (vidking, vidfun, videasy, zxcstream, custom) | various | Not documented | Not documented | varies | varies | `FALLBACK_ADAPTER`: messages never trusted, commands never sent |

Anime playback uses the Ani.pm SDK adapter (`components/anime/AnimeWatch.tsx`)
with its own episode navigation, subtitle/audio selection, and progress flow.

## Verified / unverified status

- **Verified by unit tests** (`tests/player-progress-engine.test.ts`):
  message origin/source validation, unknown-shape rejection, provider command
  allowlists, progress engine debounce, monotonic guard, watched-state
  derivation (including the not-false-marked-watched case), duration
  validation, manual correction.
- **Not verifiable from this environment**: live end-to-end playback for each
  provider (requires a browser + current network access to each provider).
  The provider ranking layer (`/api/player/resolve`) probes each provider's
  reachability before ranking a candidate and marks unreachable hosts
  `failed`, so a down provider is skipped automatically.
- **Known limitation**: VidCore's public documentation describes two message
  schemas. Only `PLAYER_EVENT` with documented fields is trusted; messages
  matching the other shape are dropped rather than guessed at.
- **Known limitation**: VidLink and VidRock do not document send-command APIs.
  Their on-screen theater controls are disabled rather than sending wire noise
  an embed script could intercept.

## Security invariants

1. Every inbound message must pass `event.source === iframe.contentWindow`.
2. Every inbound message must carry `event.origin` equal to the origin the
   iframe's `src` resolves to.
3. Outbound commands are only sent to providers that document them, and only
   with the iframe's actual origin.
4. Privileged/embedded page messages are treated as untrusted input even when
   they come from an expected provider (`api-docs.txt` §9).
5. A provider cannot mark a title watched without a plausible
   currentTime/duration pair or an explicit `ended` event.
