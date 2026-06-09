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
      .from('orders')
      .select(`
        id, order_number, created_at, status, payment_status,
        subtotal_cents, shipping_cents, tax_cents, total_cents,
        customers (first_name, last_name, email)
      `)
      .eq('salon_id', auth.salonId)
      .order('created_at', { ascending: false });

    if (from) {
      query = query.gte('created_at', `${from}T00:00:00`);
    }
    if (to) {
      query = query.lte('created_at', `${to}T23:59:59`);
    }
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: orders, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const headers = ['Bestellnummer', 'Datum', 'Kunde', 'E-Mail', 'Status', 'Zahlungsstatus', 'Zwischensumme', 'Versand', 'MwSt', 'Total'];
    const rows = (orders || []).map((o: any) => [
      o.order_number,
      new Date(o.created_at).toLocaleDateString('de-CH'),
      o.customers ? `${o.customers.first_name} ${o.customers.last_name}` : '',
      o.customers?.email || '',
      o.status,
      o.payment_status,
      ((o.subtotal_cents || 0) / 100).toFixed(2),
      ((o.shipping_cents || 0) / 100).toFixed(2),
      ((o.tax_cents || 0) / 100).toFixed(2),
      ((o.total_cents || 0) / 100).toFixed(2),
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="bestellungen_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 });
  }
}
