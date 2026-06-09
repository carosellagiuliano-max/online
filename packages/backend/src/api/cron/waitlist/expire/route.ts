// BeautifyPRO - Waitlist Expiry Cron Job
// Scheduler: Run every 5 minutes

import { NextRequest, NextResponse } from 'next/server';
import { getWaitlistService } from '@/lib/services/waitlist-service';
import { logger } from '@/lib/logging/logger';

// Verify cron secret to prevent unauthorized access
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  // Verify authorization - CRON_SECRET is REQUIRED
  const authHeader = request.headers.get('authorization');

  if (!CRON_SECRET) {
    logger.error('CRON_SECRET not configured');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    logger.warn('Unauthorized cron access attempt', { path: '/api/cron/waitlist/expire' });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  logger.info('Starting waitlist expiry cron job');

  try {
    const service = getWaitlistService();
    const expiredCount = await service.expireOldNotifications();

    logger.info('Waitlist expiry cron completed', { expiredCount });

    return NextResponse.json({
      success: true,
      expiredCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Waitlist expiry cron failed', error as Error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
