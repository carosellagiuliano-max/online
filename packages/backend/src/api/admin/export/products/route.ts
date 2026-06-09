import { NextRequest, NextResponse } from 'next/server';
import { requireExportAdmin } from '../_utils';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireExportAdmin();
    if ('response' in auth) return auth.response;
    const supabase = auth.supabase;

    const { data: products, error } = await supabase
      .from('products')
      .select(`
        id,
        sku,
        name,
        description,
        price_cents,
        stock_quantity,
        low_stock_threshold,
        is_active,
        product_categories (
          name
        )
      `)
      .eq('salon_id', auth.salonId)
      .order('name');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const headers = ['ID', 'SKU', 'Name', 'Beschreibung', 'Kategorie', 'Preis (CHF)', 'Bestand', 'Min. Bestand', 'Aktiv'];
    const rows = (products || []).map((p: any) => [
      p.id,
      p.sku || '',
      p.name,
      p.description || '',
      p.product_categories?.name || '',
      ((p.price_cents || 0) / 100).toFixed(2),
      p.stock_quantity || 0,
      p.low_stock_threshold || 0,
      p.is_active ? 'Ja' : 'Nein',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="produkte_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 });
  }
}
