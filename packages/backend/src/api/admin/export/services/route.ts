import { NextRequest, NextResponse } from 'next/server';
import { requireExportAdmin } from '../_utils';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireExportAdmin();
    if ('response' in auth) return auth.response;
    const supabase = auth.supabase;

    const { data: services, error } = await supabase
      .from('services')
      .select(`
        id, name, slug, description, short_description,
        price_cents, price_from, duration_minutes,
        buffer_before_minutes, buffer_after_minutes,
        has_length_variants, is_bookable_online, requires_deposit, deposit_amount_cents,
        is_active, sort_order, created_at,
        service_categories (name)
      `)
      .eq('salon_id', auth.salonId)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const headers = ['ID', 'Name', 'Beschreibung', 'Kurzbeschreibung', 'Preis (CHF)', 'Ab-Preis', 'Dauer (Min)', 'Puffer Vor', 'Puffer Nach', 'Kategorie', 'Online buchbar', 'Anzahlung erforderlich', 'Anzahlung (CHF)', 'Aktiv', 'Sortierung', 'Erstellt'];
    const rows = (services || []).map((s: any) => [
      s.id,
      s.name,
      s.description || '',
      s.short_description || '',
      ((s.price_cents || 0) / 100).toFixed(2),
      s.price_from ? 'Ja' : 'Nein',
      s.duration_minutes || '',
      s.buffer_before_minutes || 0,
      s.buffer_after_minutes || 0,
      s.service_categories?.name || '',
      s.is_bookable_online ? 'Ja' : 'Nein',
      s.requires_deposit ? 'Ja' : 'Nein',
      s.deposit_amount_cents ? ((s.deposit_amount_cents || 0) / 100).toFixed(2) : '',
      s.is_active ? 'Ja' : 'Nein',
      s.sort_order || 0,
      new Date(s.created_at).toLocaleDateString('de-CH'),
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="dienstleistungen_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 });
  }
}
