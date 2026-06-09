/**
 * BeautifyPRO - Public Feedback API
 * POST /api/feedback - Submit public feedback
 */

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { submitPublicFeedback } from '@/lib/actions';
import { logger } from '@/lib/logging/logger';

// ============================================
// RATE LIMITING (Simple in-memory)
// ============================================

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS_PER_WINDOW = 5; // 5 feedback submissions per hour per IP

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - 1 };
  }

  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - entry.count };
}

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (entry.resetAt < now) {
      rateLimitMap.delete(ip);
    }
  }
}, 60 * 60 * 1000); // Clean up every hour

// ============================================
// POST /api/feedback
// ============================================

export async function POST(request: NextRequest) {
  try {
    // Get client IP
    const headersList = await headers();
    const forwarded = headersList.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() ||
      headersList.get('x-real-ip') ||
      'unknown';

    // Check rate limit
    const rateLimit = checkRateLimit(ip);
    if (!rateLimit.allowed) {
      logger.warn('Rate limit exceeded for feedback submission', { ip });
      return NextResponse.json(
        { error: 'Zu viele Anfragen. Bitte versuchen Sie es später erneut.' },
        {
          status: 429,
          headers: {
            'Retry-After': '3600',
          },
        }
      );
    }

    // Parse request body
    const body = await request.json();

    // Validate required fields
    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json(
        { error: 'Name ist erforderlich.' },
        { status: 400 }
      );
    }

    if (!body.rating || typeof body.rating !== 'number' || body.rating < 1 || body.rating > 5) {
      return NextResponse.json(
        { error: 'Bewertung (1-5) ist erforderlich.' },
        { status: 400 }
      );
    }

    // Submit feedback
    const result = await submitPublicFeedback(
      {
        name: body.name,
        rating: body.rating,
        comment: body.comment,
        website: body.website, // Honeypot field
      },
      ip
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    logger.info('Public feedback submitted via API', { ip, rating: body.rating });

    return NextResponse.json(
      {
        success: true,
        message: 'Vielen Dank für Ihre Bewertung! Sie wird nach Prüfung veröffentlicht.',
      },
      {
        headers: {
          'X-RateLimit-Remaining': String(rateLimit.remaining),
        },
      }
    );
  } catch (error) {
    logger.error('Error in feedback API', error);
    return NextResponse.json(
      { error: 'Ein Fehler ist aufgetreten.' },
      { status: 500 }
    );
  }
}
