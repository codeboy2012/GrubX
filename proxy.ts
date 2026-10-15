import { NextResponse, type NextRequest } from "next/server";

const MOBILE_COOKIE = "grubx-device";
const FORCE_PARAM = "device";

/**
 * Mobile web routing for the dedicated mobile subdomain.
 *
 * Any request served from a `mobile.*` host (or explicitly forced via
 * `?device=mobile` / `?device=desktop`, or the `grubx-device` cookie) gets the
 * mobile-first shell (compact top bar + bottom tab bar) on the same pages and
 * API layer — no duplicated routes, no duplicated business logic.
 *
 * Mobile-mode requests also carry an `x-grubx-mobile` header so server
 * components can branch without waiting for client hydration.
 */
export function proxy(request: NextRequest) {
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").toLowerCase();
  const url = request.nextUrl;

  const forced = url.searchParams.get(FORCE_PARAM);
  const cookieMode = request.cookies.get(MOBILE_COOKIE)?.value;
  const validCookie = cookieMode === "mobile" || cookieMode === "desktop" ? cookieMode : null;

  // An explicit `?device=` choice wins; then the cookie; then the subdomain.
  const mode = forced === "mobile" || forced === "desktop" ? forced : (validCookie ?? (host.startsWith("mobile.") ? "mobile" : null));

  const requestHeaders = new Headers(request.headers);
  if (mode === "mobile") {
    requestHeaders.set("x-grubx-mobile", "1");
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (mode === "mobile") {
    response.headers.set("x-grubx-mobile", "1");
  }

  // Persist an explicit choice so it survives navigation; the subdomain itself
  // is re-derived per request and never needs a cookie.
  if (forced === "mobile" || forced === "desktop") {
    response.cookies.set(MOBILE_COOKIE, forced, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|sw\.js|favicon\.ico|site\.webmanifest).*)"],
};
