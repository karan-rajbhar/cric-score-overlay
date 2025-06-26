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

  if (code) {
    console.log('Processing OAuth code:', code);
    
    const supabase = createServerClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            // This is crucial - we need to collect the cookies to set them on the response
            cookiesToSet.forEach(({ name, value }) => {
              request.cookies.set(name, value);
            });
          },
        },
      }
    );

    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    
    if (exchangeError) {
      console.error('Session exchange error:', exchangeError);
      return NextResponse.redirect(`${origin}/auth/login?error=session_exchange_failed&message=${encodeURIComponent(exchangeError.message)}`);
    }

    if (data.session) {
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

      // Create the response with proper cookie handling
      const response = NextResponse.redirect(`${origin}${next}`);
      
      // Re-create the supabase client with proper cookie setting for the response
      const responseSupabase = createServerClient(
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

      // This ensures the session is properly set in the response cookies
      await responseSupabase.auth.getSession();

      console.log('Redirecting to dashboard with session cookies set');
      return response;
    } else {
      console.log('No session data received after code exchange');
      return NextResponse.redirect(`${origin}/auth/login?error=no_session_after_exchange`);
    }
  }

  console.log('No OAuth code found, redirecting to login');
  return NextResponse.redirect(`${origin}/auth/login?error=no_code`);
} 