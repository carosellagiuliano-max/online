import { NextRequest, NextResponse } from 'next/server';
import { requireExportAdmin, type DbClient } from '../export/_utils';

const MAX_IMPORT_ROWS = 500;

type CsvRow = Record<string, string>;
type ImportSummary = {
  imported: number;
  updated: number;
  errors: string[];
};

function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      currentCell += '"';
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i++;
      currentRow.push(currentCell.trim());
      if (currentRow.some((cell) => cell.length > 0)) rows.push(currentRow);
      currentRow = [];
      currentCell = '';
      continue;
    }

    currentCell += char;
  }

  currentRow.push(currentCell.trim());
  if (currentRow.some((cell) => cell.length > 0)) rows.push(currentRow);
  if (rows.length < 2) return [];

  const headers = rows[0].map((header) => normalizeHeader(header));
  return rows.slice(1).map((row) => {
    const entry: CsvRow = {};
    headers.forEach((header, index) => {
      entry[header] = row[index]?.trim() || '';
    });
    return entry;
  });
}

function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/\uFEFF/g, '')
    .replace(/[ä]/g, 'ae')
    .replace(/[ö]/g, 'oe')
    .replace(/[ü]/g, 'ue')
    .replace(/[ß]/g, 'ss')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function pick(row: CsvRow, keys: string[]): string {
  for (const key of keys) {
    if (row[key]) return row[key];
  }
  return '';
}

function parseBoolean(value: string): boolean {
  return ['1', 'true', 'ja', 'yes', 'y'].includes(value.trim().toLowerCase());
}

function parseCents(value: string): number | null {
  if (!value) return null;
  const normalized = value.replace(/'/g, '').replace(/\s/g, '').replace(',', '.');
  const amount = Number.parseFloat(normalized);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
}

function parseInteger(value: string): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function splitName(row: CsvRow): { firstName: string; lastName: string } {
  const firstName = pick(row, ['vorname', 'first_name', 'firstname']).trim();
  const lastName = pick(row, ['nachname', 'last_name', 'lastname']).trim();
  if (firstName || lastName) return { firstName, lastName };

  const fullName = pick(row, ['name', 'kunde', 'customer']).trim();
  const parts = fullName.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] || '', lastName: '' };
  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts[parts.length - 1],
  };
}

function generateSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[äÄ]/g, 'ae')
    .replace(/[öÖ]/g, 'oe')
    .replace(/[üÜ]/g, 'ue')
    .replace(/[ß]/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'import';
}

async function importCustomers(supabase: DbClient, salonId: string, rows: CsvRow[]): Promise<ImportSummary> {
  const summary: ImportSummary = { imported: 0, updated: 0, errors: [] };

  for (const [index, row] of rows.entries()) {
    const line = index + 2;
    const { firstName, lastName } = splitName(row);
    const email = pick(row, ['e_mail', 'email', 'mail']).toLowerCase();
    const phone = pick(row, ['telefon', 'phone', 'mobile', 'handy']);

    if (!firstName || !lastName) {
      summary.errors.push(`Zeile ${line}: Vorname und Nachname sind Pflichtfelder`);
      continue;
    }

    const payload = {
      salon_id: salonId,
      profile_id: null,
      first_name: firstName,
      last_name: lastName,
      email: email || null,
      phone: phone || null,
      birthday: pick(row, ['geburtsdatum', 'birthday']) || null,
      notes: pick(row, ['notizen', 'notes']) || null,
      hair_notes: pick(row, ['haarnotizen', 'hair_notes']) || null,
      accepts_marketing: parseBoolean(pick(row, ['marketing', 'accepts_marketing'])),
      is_active: true,
      deleted_at: null,
    };

    let existingId: string | null = null;
    if (email) {
      const { data: existing } = await (supabase.from('customers') as any)
        .select('id')
        .eq('salon_id', salonId)
        .eq('email', email)
        .maybeSingle();
      existingId = existing?.id || null;
    }

    const result = existingId
      ? await (supabase.from('customers') as any).update(payload).eq('id', existingId)
      : await (supabase.from('customers') as any).insert(payload);

    if (result.error) {
      summary.errors.push(`Zeile ${line}: ${result.error.message}`);
      continue;
    }

    if (existingId) summary.updated++;
    else summary.imported++;
  }

  return summary;
}

async function importServices(supabase: DbClient, salonId: string, rows: CsvRow[]): Promise<ImportSummary> {
  const summary: ImportSummary = { imported: 0, updated: 0, errors: [] };

  for (const [index, row] of rows.entries()) {
    const line = index + 2;
    const name = pick(row, ['name', 'leistung', 'dienstleistung']).trim();
    const duration = parseInteger(pick(row, ['dauer_min', 'dauer', 'duration_minutes', 'duration']));
    const priceCents = parseCents(pick(row, ['preis', 'price', 'price_chf']));

    if (!name || !duration || priceCents == null) {
      summary.errors.push(`Zeile ${line}: Name, Dauer und Preis sind Pflichtfelder`);
      continue;
    }

    const { data: existing } = await (supabase.from('services') as any)
      .select('id')
      .eq('salon_id', salonId)
      .ilike('name', name)
      .maybeSingle();

    const payload = {
      salon_id: salonId,
      name,
      slug: `${generateSlug(name)}-${Date.now()}-${index}`,
      description: pick(row, ['beschreibung', 'description']) || null,
      short_description: pick(row, ['kurzbeschreibung', 'short_description']) || null,
      duration_minutes: duration,
      price_cents: priceCents,
      price_from: parseBoolean(pick(row, ['ab_preis', 'price_from'])),
      is_bookable_online: !['0', 'false', 'nein', 'no'].includes(
        pick(row, ['online_buchbar', 'bookable', 'is_bookable_online']).toLowerCase()
      ),
      is_active: true,
    };

    const result = existing?.id
      ? await (supabase.from('services') as any).update({ ...payload, slug: undefined }).eq('id', existing.id)
      : await (supabase.from('services') as any).insert(payload);

    if (result.error) {
      summary.errors.push(`Zeile ${line}: ${result.error.message}`);
      continue;
    }

    if (existing?.id) summary.updated++;
    else summary.imported++;
  }

  return summary;
}

async function importProducts(supabase: DbClient, salonId: string, rows: CsvRow[]): Promise<ImportSummary> {
  const summary: ImportSummary = { imported: 0, updated: 0, errors: [] };

  for (const [index, row] of rows.entries()) {
    const line = index + 2;
    const name = pick(row, ['name', 'produkt', 'product']).trim();
    const sku = pick(row, ['sku', 'artikelnummer']).trim();
    const priceCents = parseCents(pick(row, ['preis', 'price', 'price_chf']));
    const stockQuantity = parseInteger(pick(row, ['bestand', 'stock', 'stock_quantity'])) || 0;

    if (!name || priceCents == null) {
      summary.errors.push(`Zeile ${line}: Name und Preis sind Pflichtfelder`);
      continue;
    }

    let existingQuery = (supabase.from('products') as any)
      .select('id')
      .eq('salon_id', salonId);
    existingQuery = sku ? existingQuery.eq('sku', sku) : existingQuery.ilike('name', name);
    const { data: existing } = await existingQuery.maybeSingle();

    const payload = {
      salon_id: salonId,
      name,
      slug: `${generateSlug(name)}-${Date.now()}-${index}`,
      description: pick(row, ['beschreibung', 'description']) || null,
      short_description: pick(row, ['kurzbeschreibung', 'short_description']) || null,
      sku: sku || null,
      price_cents: priceCents,
      compare_at_price_cents: parseCents(pick(row, ['vergleichspreis', 'compare_at_price'])),
      stock_quantity: stockQuantity,
      low_stock_threshold: parseInteger(pick(row, ['mindestbestand', 'low_stock_threshold'])) || 5,
      is_active: true,
      is_published: true,
    };

    const result = existing?.id
      ? await (supabase.from('products') as any).update({ ...payload, slug: undefined }).eq('id', existing.id)
      : await (supabase.from('products') as any).insert(payload);

    if (result.error) {
      summary.errors.push(`Zeile ${line}: ${result.error.message}`);
      continue;
    }

    if (existing?.id) summary.updated++;
    else summary.imported++;
  }

  return summary;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireExportAdmin();
    if ('response' in auth) return auth.response;

    const formData = await request.formData();
    const file = formData.get('file');
    const type = String(formData.get('type') || '');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'CSV-Datei fehlt' }, { status: 400 });
    }

    if (!['customers', 'services', 'products'].includes(type)) {
      return NextResponse.json({ error: 'Unbekannter Import-Typ' }, { status: 400 });
    }

    const rows = parseCsv(await file.text());
    if (rows.length === 0) {
      return NextResponse.json({ error: 'CSV enthält keine importierbaren Zeilen' }, { status: 400 });
    }

    if (rows.length > MAX_IMPORT_ROWS) {
      return NextResponse.json(
        { error: `Maximal ${MAX_IMPORT_ROWS} Zeilen pro Import erlaubt` },
        { status: 400 }
      );
    }

    const summary =
      type === 'customers'
        ? await importCustomers(auth.supabase, auth.salonId, rows)
        : type === 'services'
          ? await importServices(auth.supabase, auth.salonId, rows)
          : await importProducts(auth.supabase, auth.salonId, rows);

    const importedTotal = summary.imported + summary.updated;
    const status = importedTotal > 0 ? 200 : 400;

    return NextResponse.json(
      {
        success: importedTotal > 0,
        imported: summary.imported,
        updated: summary.updated,
        errors: summary.errors,
      },
      { status }
    );
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 });
  }
}
