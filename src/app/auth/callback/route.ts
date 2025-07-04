import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { env } from "~/env.js";

export async function GET(request: NextRequest) {
  console.log('OAuth callback received:', request.url);

  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const next = searchParams.get("next") ?? "/dashboard";

  // Handle OAuth errors
  if (error) {
    console.error('OAuth error:', error);
    return NextResponse.redirect(`${origin}/auth/login?error=oauth_error&message=${encodeURIComponent(error)}`);
  }

  if (!code) {
    console.log('No OAuth code found, redirecting to login');
    return NextResponse.redirect(`${origin}/auth/login?error=no_code`);
  }

  console.log('Processing OAuth code:', code);

  // Create response first
  const response = NextResponse.redirect(`${origin}${next}`);

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
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  try {
    // Exchange code for session
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error('Session exchange error:', exchangeError);
      return NextResponse.redirect(`${origin}/auth/login?error=session_exchange_failed&message=${encodeURIComponent(exchangeError.message)}`);
    }

    if (!data.session) {
      console.log('No session data received after code exchange');
      return NextResponse.redirect(`${origin}/auth/login?error=no_session_after_exchange`);
    }

    console.log('OAuth session created successfully:', data.session.user.email);

    // Create profile if it doesn't exist
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", data.session.user.id)
        .single();

      if (!profile) {
        console.log('Creating profile for new user');
        await supabase.from("profiles").insert({
          id: data.session.user.id,
          email: data.session.user.email!,
          full_name: data.session.user.user_metadata?.full_name || data.session.user.user_metadata?.name || null,
          avatar_url: data.session.user.user_metadata?.avatar_url || null,
          phone: data.session.user.phone || null,
        });
      }
    } catch (profileError) {
      console.error('Profile creation error (non-fatal):', profileError);
    }

    console.log('Redirecting to dashboard with session cookies set');
    return response;

  } catch (error) {
    console.error('Callback processing error:', error);
    return NextResponse.redirect(`${origin}/auth/login?error=callback_error&message=${encodeURIComponent('Authentication failed')}`);
  }
}