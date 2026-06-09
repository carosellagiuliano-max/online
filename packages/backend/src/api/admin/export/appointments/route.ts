import { NextRequest, NextResponse } from 'next/server';
import { requireExportAdmin } from '../_utils';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireExportAdmin();
    if ('response' in auth) return auth.response;
    const supabase = auth.supabase;

    const searchParams = request.nextUrl.searchParams;
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const status = searchParams.get('status');

    let query = supabase
      .from('appointments')
      .select(`
        id, start_time, end_time, status, total_cents, duration_minutes, customer_notes, internal_notes, booked_online,
        customers (first_name, last_name, email, phone),
        appointment_services (service_name, duration_minutes, price_cents),
        staff (display_name)
      `)
      .eq('salon_id', auth.salonId)
      .order('start_time', { ascending: false });

    if (from) {
      query = query.gte('start_time', `${from}T00:00:00`);
    }
    if (to) {
      query = query.lte('start_time', `${to}T23:59:59`);
    }
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: appointments, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const headers = ['ID', 'Datum', 'Uhrzeit', 'Ende', 'Dauer (Min)', 'Kunde', 'E-Mail', 'Telefon', 'Services', 'Mitarbeiter', 'Status', 'Preis (CHF)', 'Online gebucht', 'Kundennotizen', 'Interne Notizen'];
    const rows = (appointments || []).map((a: any) => {
      // Combine all services into a single string
      const services = (a.appointment_services || [])
        .map((s: { service_name: string; price_cents: number }) => `${s.service_name} (${(s.price_cents / 100).toFixed(2)} CHF)`)
        .join('; ');

      return [
        a.id,
        new Date(a.start_time).toLocaleDateString('de-CH'),
        new Date(a.start_time).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' }),
        new Date(a.end_time).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' }),
        a.duration_minutes || '',
        a.customers ? `${a.customers.first_name} ${a.customers.last_name}` : '',
        a.customers?.email || '',
        a.customers?.phone || '',
        services,
        a.staff?.display_name || 'Nicht zugewiesen',
        a.status,
        ((a.total_cents || 0) / 100).toFixed(2),
        a.booked_online ? 'Ja' : 'Nein',
        a.customer_notes || '',
        a.internal_notes || '',
      ];
    });

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="termine_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 });
  }
}
