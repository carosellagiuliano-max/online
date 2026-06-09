import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

// Hardcoded salon ID (must match migrations)
const SALON_ID = '550e8400-e29b-41d4-a716-446655440001';

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const pathname = request.nextUrl.pathname;

  // Use internal URL for server-side (Docker), fallback to public URL
  const supabaseUrl = process.env.SUPABASE_URL_INTERNAL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

  // Skip if env vars not available
  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  // ============================================
  // SETUP WIZARD REDIRECT LOGIC
  // ============================================
  const wizardEnabled = process.env.ENABLE_WIZARD === 'true';

  if (wizardEnabled && supabaseServiceKey) {
    const isSetupPath = pathname.startsWith('/setup');
    const isApiPath = pathname.startsWith('/api');
    const isStaticPath = pathname.startsWith('/_next') || pathname.includes('.');

    // Only check setup status for non-API, non-static paths
    if (!isApiPath && !isStaticPath) {
      try {
        // Create service role client for setup check (bypasses RLS)
        const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        });

        // Check if salon exists
        const { count: salonCount } = await serviceClient
          .from('salons')
          .select('*', { count: 'exact', head: true });

        const hasSalon = (salonCount || 0) > 0;

        // Check if setup is complete
        let setupComplete = false;
        if (hasSalon) {
          const { data: setupSetting } = await serviceClient
            .from('settings')
            .select('value')
            .eq('salon_id', SALON_ID)
            .eq('key', 'admin_setup_completed')
            .single();

          setupComplete = setupSetting?.value === true || setupSetting?.value === 'true';
        }

        const needsSetup = !hasSalon || !setupComplete;

        // Redirect to setup if needed and not already on setup page
        if (needsSetup && !isSetupPath) {
          return NextResponse.redirect(new URL('/setup', request.url));
        }

        // Redirect away from setup if already set up
        if (!needsSetup && isSetupPath) {
          return NextResponse.redirect(new URL('/', request.url));
        }
      } catch (error) {
        console.error('[middleware] Setup check error:', error);
        // Don't block on errors, continue normally
      }
    }
  }

  // ============================================
  // REGULAR AUTH MIDDLEWARE
  // ============================================
  // Use the internal URL for API calls (reachable in Docker), but when it
  // differs from the public URL, explicitly set storageKey so the cookie
  // name matches what the browser client uses.
  const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const needsStorageKey = publicUrl && supabaseUrl !== publicUrl;
  const storageKey = needsStorageKey
    ? `sb-${new URL(publicUrl).hostname.split('.')[0]}-auth-token`
    : undefined;

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    ...(storageKey ? { auth: { storageKey } } : {}),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // IMPORTANT: Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make your app
  // slow or vulnerable to security issues.

  // Refresh session if expired - required for Server Components
  await supabase.auth.getUser();

  // Add pathname header for server components to access
  supabaseResponse.headers.set('x-pathname', request.nextUrl.pathname);

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
