import { NextResponse } from 'next/server';
import { checkSetupStatus } from '@/lib/setup/check-setup';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const status = await checkSetupStatus();
    return NextResponse.json(status);
  } catch (error) {
    console.error('[GET /api/setup/status] Error:', error);
    return NextResponse.json(
      { needsSetup: false, wizardEnabled: false, reason: 'setup_complete' },
      { status: 500 }
    );
  }
}
