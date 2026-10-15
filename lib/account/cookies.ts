import { NextResponse } from "next/server";

import { clearSessionCookieHeader, sessionCookieHeader } from "@/lib/account/auth";

/**
 * Session cookie wiring for API routes.
 *
 * HttpOnly + SameSite=Lax always; Secure whenever the request itself is https
 * (so local http development keeps working without weakening production).
 */
const SESSION_COOKIE_NAME = "grubx_session";

export const isHttpsRequest = (request: Request) => {
  const proto = request.headers.get("x-forwarded-proto");
  if (proto) {
    return proto.split(",")[0].trim() === "https";
  }
  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return false;
  }
};

export const applySessionCookie = (response: NextResponse, request: Request, value: string, expiresAt: Date) => {
  const { name, parts, secureHint } = sessionCookieHeader(value, expiresAt);
  const isHttps = isHttpsRequest(request);
  response.cookies.set({
    name,
    value,
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps && secureHint,
    path: "/",
    expires: expiresAt,
  });
  return response;
};

export const clearSessionCookie = (response: NextResponse, request: Request) => {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: isHttpsRequest(request),
    path: "/",
    maxAge: 0,
  });
  return response;
};
