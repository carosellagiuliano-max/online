import { NextResponse } from 'next/server';
import { csvResponse, formatDate, requireExportAdmin } from '../_utils';

export async function GET() {
  try {
    const auth = await requireExportAdmin();
    if ('response' in auth) return auth.response;

    const { data, error } = await (auth.supabase.from('customer_loyalty') as any)
      .select(`
        id,
        points_balance,
        lifetime_points,
        annual_spend_cents,
        annual_visits,
        annual_period_start,
        created_at,
        updated_at,
        customers!inner (
          first_name,
          last_name,
          email,
          phone,
          salon_id
        ),
        loyalty_tiers (
          name
        )
      `)
      .eq('customers.salon_id', auth.salonId)
      .order('updated_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return csvResponse(
      'treuepunkte',
      [
        'Kunde',
        'E-Mail',
        'Telefon',
        'Punktestand',
        'Lifetime Punkte',
        'Stufe',
        'Jahresumsatz (Rp.)',
        'Jahresbesuche',
        'Jahresperiode Start',
        'Erstellt',
        'Aktualisiert',
      ],
      (data || []).map((entry: any) => [
        `${entry.customers?.first_name || ''} ${entry.customers?.last_name || ''}`.trim(),
        entry.customers?.email || '',
        entry.customers?.phone || '',
        entry.points_balance || 0,
        entry.lifetime_points || 0,
        entry.loyalty_tiers?.name || '',
        entry.annual_spend_cents || 0,
        entry.annual_visits || 0,
        entry.annual_period_start || '',
        formatDate(entry.created_at),
        formatDate(entry.updated_at),
      ])
    );
  } catch (error) {
    console.error('Loyalty export error:', error);
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 });
  }
}
