import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';

// Secret for revalidation requests
const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET;

export async function POST(request: NextRequest) {
  // ========================================
  // SECURITY: Require secret token
  // ========================================
  const authHeader = request.headers.get('authorization');
  const secretParam = request.nextUrl.searchParams.get('secret');

  // Accept secret from either Authorization header or query param
  const providedSecret = authHeader?.replace('Bearer ', '') || secretParam;

  if (!REVALIDATE_SECRET) {
    console.error('[Revalidate API] REVALIDATE_SECRET not configured');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  if (!providedSecret || providedSecret !== REVALIDATE_SECRET) {
    console.warn('[Revalidate API] Unauthorized revalidation attempt');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ========================================
  // Process revalidation
  // ========================================
  const tag = request.nextUrl.searchParams.get('tag');
  console.log('[Revalidate API] Called with tag:', tag);

  if (!tag) {
    return NextResponse.json({ error: 'Missing tag parameter' }, { status: 400 });
  }

  // Whitelist of allowed tags
  const allowedTags = [
    'salon',
    'services',
    'staff',
    'booking',
    'products',
    'gallery',
    'opening-hours',
    'appointments',
  ];

  if (!allowedTags.includes(tag)) {
    console.warn(`[Revalidate API] Invalid tag attempted: ${tag}`);
    return NextResponse.json({ error: 'Invalid tag' }, { status: 400 });
  }

  try {
    revalidateTag(tag, 'max');
    console.log('[Revalidate API] Successfully revalidated tag:', tag);
    return NextResponse.json({ revalidated: true, tag });
  } catch (error) {
    console.error('[Revalidate API] Error:', error);
    return NextResponse.json({ error: 'Failed to revalidate' }, { status: 500 });
  }
}
