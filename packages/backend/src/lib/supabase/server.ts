import { createServerClient as createSupabaseServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { Database } from '@/lib/db/types';

// ============================================
// SERVER SUPABASE CLIENT
// ============================================

/**
 * Derives the Supabase auth storage key from a URL.
 * Must match how @supabase/ssr derives it internally so cookie names align.
 */
function getStorageKey(url: string): string {
  const hostname = new URL(url).hostname;
  const ref = hostname.split('.')[0];
  return `sb-${ref}-auth-token`;
}

export async function createServerClient(): Promise<any> {
  // Use internal URL for API calls (required in Docker where localhost is unreachable)
  const supabaseUrl = process.env.SUPABASE_URL_INTERNAL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Support both NEXT_PUBLIC_SUPABASE_ANON_KEY and ANON_KEY for flexibility
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.ANON_KEY;

  // Throw error if env vars are not available (helps debugging)
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables:', {
      hasUrl: !!supabaseUrl,
      hasAnonKey: !!supabaseAnonKey,
    });
    throw new Error('Missing required Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY)');
  }

  // When SUPABASE_URL_INTERNAL differs from NEXT_PUBLIC_SUPABASE_URL (e.g. Docker),
  // the cookie name derived from the API URL won't match the browser's cookies.
  // Explicitly set storageKey to match the browser client's cookie name.
  const needsStorageKey = publicUrl && supabaseUrl !== publicUrl;
  const storageKey = needsStorageKey ? getStorageKey(publicUrl) : undefined;

  const cookieStore = await cookies();

  return createSupabaseServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    ...(storageKey ? { auth: { storageKey } } : {}),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  }) as any;
}

// ============================================
// SERVICE ROLE CLIENT (bypasses RLS)
// Use only for admin operations
// ============================================

export function createServiceRoleClient(): any {
  // Use internal URL for Docker (server-side), fall back to public URL
  const supabaseUrl = process.env.SUPABASE_URL_INTERNAL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

  // Return null if env vars are not available (e.g., during build)
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[createServiceRoleClient] Missing environment variables:', {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey,
    });
    return null;
  }

  // Use direct createClient for true service role access (bypasses RLS)
  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }) as any;
}
