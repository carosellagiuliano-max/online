import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { isMockMode } from '@/lib/mock/mock-auth';

export async function POST(request: NextRequest) {
  const host = request.headers.get('host') || request.nextUrl.host;
  const protocol = request.headers.get('x-forwarded-proto') || request.nextUrl.protocol.replace(':', '');
  const redirectUrl = new URL('/admin/login', `${protocol}://${host}`);

  // Mock mode: clear the mock session cookies, no Supabase available
  if (isMockMode()) {
    const response = NextResponse.redirect(redirectUrl, { status: 302 });
    response.cookies.delete('mock_session');
    response.cookies.delete('mock_user');
    return response;
  }

  const supabase = await createServerClient();
  await supabase.auth.signOut();

  return NextResponse.redirect(redirectUrl, { status: 302 });
}
