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

    let query = supabase
      .from('customers')
      .select('id, first_name, last_name, email, phone, birthday, notes, hair_notes, accepts_marketing, is_active, created_at, last_visit_at')
      .eq('salon_id', auth.salonId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (from) {
      query = query.gte('created_at', `${from}T00:00:00`);
    }
    if (to) {
      query = query.lte('created_at', `${to}T23:59:59`);
    }

    const { data: customers, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Build CSV
    const headers = ['ID', 'Vorname', 'Nachname', 'E-Mail', 'Telefon', 'Geburtsdatum', 'Notizen', 'Haarnotizen', 'Marketing', 'Erstellt', 'Letzter Besuch'];
    const rows = (customers || []).map((c: any) => [
      c.id,
      c.first_name,
      c.last_name,
      c.email || '',
      c.phone || '',
      c.birthday || '',
      c.notes || '',
      c.hair_notes || '',
      c.accepts_marketing ? 'Ja' : 'Nein',
      new Date(c.created_at).toLocaleDateString('de-CH'),
      c.last_visit_at ? new Date(c.last_visit_at).toLocaleDateString('de-CH') : '',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="kunden_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 });
  }
}
