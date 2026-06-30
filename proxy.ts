import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Lightweight optimistic guard: checks for the presence of the session cookie
 * to keep unauthenticated users out of the app shell. Authorization is still
 * re-verified in Server Components / Server Actions via `getSession()`.
 */
export function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);

  if (!sessionCookie) {
    const url = new URL("/", request.url);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/groups/:path*"],
};
