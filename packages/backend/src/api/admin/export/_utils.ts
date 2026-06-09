import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/client';
import { requireAdminAction } from '@/lib/actions/admin-auth';

const DEFAULT_SALON_ID = '550e8400-e29b-41d4-a716-446655440001';
const EXPORT_ADMIN_ROLES = ['admin', 'manager', 'hq'];

export type DbClient = NonNullable<ReturnType<typeof createServerClient>>;

export async function requireExportAdmin(): Promise<
  | { success: true; supabase: DbClient; salonId: string; userId: string }
  | { success: false; response: NextResponse }
> {
  const supabase = createServerClient();
  if (!supabase) {
    return {
      success: false,
      response: NextResponse.json({ error: 'Service nicht verfügbar' }, { status: 503 }),
    };
  }

  const auth = await requireAdminAction(supabase, { allowedRoles: EXPORT_ADMIN_ROLES });
  if (!auth.success) {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'error' in auth ? auth.error : 'Keine Berechtigung' },
        { status: 401 }
      ),
    };
  }

  return {
    success: true,
    supabase,
    salonId: auth.context.salonId === 'all' ? DEFAULT_SALON_ID : auth.context.salonId,
    userId: auth.context.userId,
  };
}

export function csvResponse(filename: string, headers: string[], rows: Array<Array<unknown>>) {
  const csv = toCsv(headers, rows);

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}_${new Date().toISOString().split('T')[0]}.csv"`,
    },
  });
}

export function toCsv(headers: string[], rows: Array<Array<unknown>>): string {
  return [
    headers.join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ].join('\n');
}

export function escapeCsvCell(value: unknown): string {
  const stringValue = value == null ? '' : String(value);
  return `"${stringValue.replace(/"/g, '""')}"`;
}

export function centsToCurrency(cents: number | null | undefined): string {
  return (((cents || 0) / 100)).toFixed(2);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '';
  return new Date(value).toLocaleDateString('de-CH');
}

export function normalizeDateFilter(value: string | null, endOfDay = false): string | null {
  if (!value) return null;
  return `${value}T${endOfDay ? '23:59:59' : '00:00:00'}`;
}
