import { NextResponse, type NextRequest } from "next/server";

/**
 * Route guard (Next.js 16 `proxy`). The session cookie is verified by the
 * Admin SDK inside server components and actions; here we only check for its
 * presence so the redirect happens before anything renders.
 */
const SESSION_COOKIE_NAME = "cric_session";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  const guarded =
    pathname.startsWith("/dashboard") || pathname.startsWith("/invitations");
  if (guarded && !hasSession) {
    const login = new URL("/auth/login", request.url);
    login.searchParams.set("redirect", pathname);
    return NextResponse.redirect(login);
  }

  if (pathname.startsWith("/auth/login") && hasSession) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/invitations/:path*", "/auth/login"],
};
