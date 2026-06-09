import type { Metadata } from 'next';
import { AdminAnalyticsView } from '@/components/admin/admin-analytics-view';
import { protectManagerPage } from '@/lib/auth/rbac';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getAnalyticsData, normalizeAnalyticsFilters } from '@/lib/domain/analytics';

export const metadata: Metadata = {
  title: 'Analytics',
};

export const dynamic = 'force-dynamic';

const DEFAULT_SALON_ID = '550e8400-e29b-41d4-a716-446655440001';

interface AnalyticsPageProps {
  searchParams: Promise<{
    period?: string;
    start?: string;
    end?: string;
    source?: string;
  }>;
}

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const staffMember = await protectManagerPage();
  const supabase = createServiceRoleClient();

  if (!supabase) {
    throw new Error('Analytics-Datenbank ist nicht verfügbar');
  }

  const params = await searchParams;
  const filters = normalizeAnalyticsFilters({
    period: params.period,
    startDate: params.start,
    endDate: params.end,
    source: params.source,
  });

  const salonId = staffMember.salon_id === 'all' ? DEFAULT_SALON_ID : staffMember.salon_id;
  const data = await getAnalyticsData(supabase, salonId, filters);

  return <AdminAnalyticsView data={data} />;
}
