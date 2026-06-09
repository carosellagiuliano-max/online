import { createBrowserClient as createSupabaseBrowserClient } from '@supabase/ssr';
import type { Database } from '@/lib/db/types';

// ============================================
// BROWSER SUPABASE CLIENT
// ============================================

export function createBrowserClient(): any {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createSupabaseBrowserClient<Database>(supabaseUrl, supabaseAnonKey) as any;
}
