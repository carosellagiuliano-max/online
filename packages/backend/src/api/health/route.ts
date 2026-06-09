import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// ============================================
// TYPES
// ============================================

interface HealthCheck {
  status: 'up' | 'down' | 'degraded';
  latency_ms?: number;
  error?: string;
}

interface HealthResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  uptime_seconds: number;
  checks: {
    database: HealthCheck;
    supabase_auth: HealthCheck;
  };
}

// ============================================
// UPTIME TRACKING
// ============================================

const startTime = Date.now();

function getUptimeSeconds(): number {
  return Math.floor((Date.now() - startTime) / 1000);
}

// ============================================
// HEALTH CHECKS
// ============================================

async function checkDatabase(): Promise<HealthCheck> {
  const start = performance.now();

  try {
    const supabase = await createServerClient();

    // Simple query to check database connectivity
    const { error } = await supabase
      .from('salons')
      .select('id')
      .limit(1)
      .single();

    const latency = Math.round(performance.now() - start);

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned, which is fine
      return {
        status: 'down',
        latency_ms: latency,
        error: error.message,
      };
    }

    return {
      status: latency < 1000 ? 'up' : 'degraded',
      latency_ms: latency,
    };
  } catch (error) {
    return {
      status: 'down',
      latency_ms: Math.round(performance.now() - start),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkSupabaseAuth(): Promise<HealthCheck> {
  const start = performance.now();

  try {
    const supabase = await createServerClient();

    // Check if we can reach the auth service
    const { error } = await supabase.auth.getSession();

    const latency = Math.round(performance.now() - start);

    if (error) {
      return {
        status: 'down',
        latency_ms: latency,
        error: error.message,
      };
    }

    return {
      status: latency < 500 ? 'up' : 'degraded',
      latency_ms: latency,
    };
  } catch (error) {
    return {
      status: 'down',
      latency_ms: Math.round(performance.now() - start),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// HEALTH ENDPOINT
// ============================================

export async function GET() {
  try {
    // Run health checks in parallel
    const [database, supabaseAuth] = await Promise.all([
      checkDatabase(),
      checkSupabaseAuth(),
    ]);

    const checks = {
      database,
      supabase_auth: supabaseAuth,
    };

    // Determine overall status
    const allChecks = Object.values(checks);
    const hasDown = allChecks.some((c) => c.status === 'down');
    const hasDegraded = allChecks.some((c) => c.status === 'degraded');

    let overallStatus: HealthResponse['status'] = 'healthy';
    if (hasDown) {
      overallStatus = 'unhealthy';
    } else if (hasDegraded) {
      overallStatus = 'degraded';
    }

    const response: HealthResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime_seconds: getUptimeSeconds(),
      checks,
    };

    // Return appropriate HTTP status code
    const httpStatus = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;

    return NextResponse.json(response, { status: httpStatus });
  } catch (error) {
    console.error('Health check failed:', error);

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        uptime_seconds: getUptimeSeconds(),
        error: error instanceof Error ? error.message : 'Unknown error',
        checks: {},
      },
      { status: 503 }
    );
  }
}

// ============================================
// LIVENESS PROBE (Simple)
// ============================================

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
