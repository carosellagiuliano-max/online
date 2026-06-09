import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  await supabase.auth.signOut();

  const host = request.headers.get('host') || request.nextUrl.host;
  const protocol = request.headers.get('x-forwarded-proto') || request.nextUrl.protocol.replace(':', '');

  return NextResponse.redirect(new URL('/admin/login', `${protocol}://${host}`), {
    status: 302,
  });
}
