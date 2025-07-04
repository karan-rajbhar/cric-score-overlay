import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "~/env.js";

export async function middleware(request: NextRequest) {
  // Create response early to handle cookies properly
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Skip middleware for auth callback - let it handle session creation
  if (request.nextUrl.pathname.startsWith("/auth/callback")) {
    return response;
  }

  // Create supabase client with proper cookie handling
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
    }
  );

  // Get user session
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  // Log for debugging
  console.log('Middleware:', {
    path: request.nextUrl.pathname,
    user: user?.email || 'none',
    error: error?.message || 'none'
  });

  // Only protect dashboard routes
  if (request.nextUrl.pathname.startsWith("/dashboard")) {
    if (!user) {
      return NextResponse.redirect(new URL("/auth/login", request.url));
    }
  }

  // Redirect authenticated users away from auth pages
  if (
    user &&
    (request.nextUrl.pathname.startsWith("/auth/login") ||
     request.nextUrl.pathname.startsWith("/auth/signup"))
  ) {
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