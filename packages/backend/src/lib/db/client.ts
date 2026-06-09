import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './types';

// Lazy-initialized clients to avoid build-time errors
let _supabaseClient: any = null;

// Client-side Supabase client (uses anon key, respects RLS)
// Uses @supabase/ssr for proper cookie-based session handling
export function getSupabaseClient(): any {
  if (_supabaseClient) return _supabaseClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
  }

  if (!supabaseAnonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable');
  }

  // Use createBrowserClient from @supabase/ssr for cookie-based auth
  // This shares sessions with server-side auth (login via server actions)
  // Cookie name is derived automatically from the Supabase URL
  _supabaseClient = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey) as any;

  return _supabaseClient;
}

// Legacy export for backwards compatibility
// Note: This will throw if env vars are not set at import time
export const supabase = new Proxy({} as any, {
  get(_, prop) {
    return Reflect.get(getSupabaseClient(), prop);
  },
});

// Server-side Supabase client (uses service role key, bypasses RLS)
// Only use this for admin operations and background jobs
// Returns null if env vars are not available (e.g., during build)
export function createServerClient(): any {
  // Use internal URL for Docker (server-side), fall back to public URL
  const supabaseUrl = process.env.SUPABASE_URL_INTERNAL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

  // Return null if env vars are not available (safe for build time)
  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }) as any;
}

// Type export for convenience
export type SupabaseClientType = any;
