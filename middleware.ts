import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "~/env.js";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  // Handle auth callback route - let it process without interference
  if (request.nextUrl.pathname.startsWith("/auth/callback")) {
    console.log('Middleware: Allowing auth callback to process');
    return supabaseResponse;
  }

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Get user session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  console.log('Middleware: Path:', request.nextUrl.pathname, 'User:', user?.email || 'none');

  // Protect dashboard and other authenticated routes
  if (request.nextUrl.pathname.startsWith("/dashboard")) {
    if (!user) {
      console.log('Middleware: Redirecting to login - no user for dashboard');
      return NextResponse.redirect(new URL("/auth/login", request.url));
    }
    console.log('Middleware: Allowing dashboard access for user:', user.email);
  }

  // Protect overlay routes (they should be public for streaming)
  // Skip auth check for overlay routes to allow public access
  if (request.nextUrl.pathname.startsWith("/overlay")) {
    return supabaseResponse;
  }

  // Redirect logged-in users away from auth pages (except callback)
  if (
    (request.nextUrl.pathname.startsWith("/auth/login") ||
      request.nextUrl.pathname.startsWith("/auth/signup")) &&
    user
  ) {
    console.log('Middleware: Redirecting authenticated user to dashboard');
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return supabaseResponse;
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