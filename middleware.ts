import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "~/env.js";

export async function middleware(request: NextRequest) {
  // Create response early to handle cookies properly
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const pathname = request.nextUrl.pathname;

  // Skip middleware for auth callback - let it handle session creation
  if (pathname.startsWith("/auth/callback")) {
    return response;
  }

  const isDashboardRoute = pathname.startsWith("/dashboard");
  const isAuthRoute =
    pathname.startsWith("/auth/login") || pathname.startsWith("/auth/signup");

  // Performance optimization: skip Supabase auth network round-trip for public routes
  // (e.g. /matches/[id], /overlay/[matchId], clubs, teams, landing page)
  if (!isDashboardRoute && !isAuthRoute) {
    return response;
  }

  // Create supabase client with proper cookie handling only when auth is needed
  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // Get user session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Only protect dashboard routes
  if (isDashboardRoute) {
    if (!user) {
      return NextResponse.redirect(new URL("/auth/login", request.url));
    }
  }

  // Redirect authenticated users away from auth pages
  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api (API routes)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|api|public).*)",
  ],
};
