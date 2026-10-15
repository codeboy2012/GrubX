/**
 * GrubX service worker — offline shell + stale-while-revalidate catalogue.
 *
 * Scope policy (keep conservative; this file is auditable security surface):
 * - CACHE: same-origin static build assets only (immutable, cache-first).
 * - STALE-WHILE-REVALIDATE: safe, public catalogue metadata GETs from the
 *   explicit allowlist below (TMDB proxy, anime, manga). These responses are
 *   non-sensitive; allowlist changes require a cache version bump.
 * - NEVER cached: everything else, including /api/auth (sessions), /api/sync
 *   (private per-user progress/library/settings), /api/feedback, any POST,
 *   non-same-origin responses, HTML navigations.
 * - Live match data (/api/live/*) is network-first with a cache fallback so a
 *   sudden drop shows the last guide instead of an error page. It is proven
 *   transient data, not a promise of offline streaming.
 */

const VERSION = "grubx-shell-v2";
const STATIC_CACHE = `${VERSION}-static`;
const DATA_CACHE = `${VERSION}-data`;

const CATALOGUE_ALLOWLIST = [
  /^\/api\/tmdb($|\?|\/)/,
  /^\/api\/anime($|\?|\/)/,
  /^\/api\/manga($|\?|\/)/,
];

const LIVE_ALLOWLIST = [/^\/api\/live($|\?|\/)/];

const DENYLIST = [/^\/api\/auth($|\?|\/)/, /^\/api\/sync($|\?|\/)/, /^\/api\/feedback($|\?|\/)/];

/** Static, effectively-immutable assets (Next build chunks + app icons). */
const STATIC_ALLOWLIST = [/^\/_next\/static\//, /^\/(64x64|512x512|favicon\.svg)(\?|$)/];

const isStaticAsset = (url) => STATIC_ALLOWLIST.some((test) => test.test(url.pathname));
const isCatalogue = (url) => CATALOGUE_ALLOWLIST.some((test) => test.test(url.pathname));
const isLive = (url) => LIVE_ALLOWLIST.some((test) => test.test(url.pathname));
const isDenied = (url) => DENYLIST.some((test) => test.test(url.pathname));

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(STATIC_CACHE));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") {
    return; // Never cache writes.
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || isDenied(url)) {
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) {
          return hit;
        }
        const response = await fetch(request);
        if (response.ok) {
          await cache.put(request, response.clone());
        }
        return response;
      }),
    );
    return;
  }

  if (isCatalogue(url)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  if (isLive(url)) {
    event.respondWith(networkFirst(request));
    return;
  }
});

/** Public catalogue metadata: serve cached instantly, refresh in background. */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DATA_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        await cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);
  if (cached) {
    eventually(network);
    return cached;
  }
  const response = await network;
  return response ?? offlineResponse();
}

/** Live guide: fresh when possible, cached guide when the network drops. */
async function networkFirst(request) {
  const cache = await caches.open(DATA_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached ?? offlineResponse();
  }
}

const eventually = (promise) => void promise.catch(() => undefined);

const offlineResponse = () => new Response(
  JSON.stringify({ offline: true, error: "no cached copy and no network" }),
  {
    status: 503,
    headers: { "Content-Type": "application/json", "X-GrubX-Offline": "1" },
  },
);
