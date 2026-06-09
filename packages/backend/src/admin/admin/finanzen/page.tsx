import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AdminFinanceView } from '@/components/admin/admin-finance-view';
import { features } from '@/lib/config/features';
import { getFinanceData, normalizeFinanceFilters } from '@/lib/domain/finance';
import { protectManagerPage } from '@/lib/auth/rbac';
import { createServiceRoleClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Finanzen',
};

export const dynamic = 'force-dynamic';

const DEFAULT_SALON_ID = '550e8400-e29b-41d4-a716-446655440001';

interface FinancePageProps {
  searchParams: Promise<{
    period?: string;
    start?: string;
    end?: string;
    source?: string;
    state?: string;
    method?: string;
  }>;
}

export default async function FinancePage({ searchParams }: FinancePageProps) {
  if (!features.financeEnabled) {
    redirect('/admin');
  }

  const staffMember = await protectManagerPage();
  const supabase = createServiceRoleClient();

  if (!supabase) {
    throw new Error('Finanzdatenbank ist nicht verfügbar');
  }

  const params = await searchParams;
  const filters = normalizeFinanceFilters({
    period: params.period,
    startDate: params.start,
    endDate: params.end,
    source: params.source,
    paymentState: params.state,
    paymentMethod: params.method,
  });

  const salonId = staffMember.salon_id === 'all' ? DEFAULT_SALON_ID : staffMember.salon_id;
  const financeData = await getFinanceData(supabase, salonId, filters);

  return <AdminFinanceView data={financeData} />;
}
