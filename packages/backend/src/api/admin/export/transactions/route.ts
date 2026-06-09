import { NextRequest, NextResponse } from 'next/server';
import {
  centsToCurrency,
  csvResponse,
  formatDate,
  normalizeDateFilter,
  requireExportAdmin,
} from '../_utils';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireExportAdmin();
    if ('response' in auth) return auth.response;

    const searchParams = request.nextUrl.searchParams;
    const from = normalizeDateFilter(searchParams.get('from'));
    const to = normalizeDateFilter(searchParams.get('to'), true);
    const status = searchParams.get('status');

    let query = (auth.supabase.from('payments') as any)
      .select(`
        id,
        reference_type,
        reference_id,
        amount_cents,
        currency,
        payment_method,
        status,
        stripe_payment_intent_id,
        error_code,
        error_message,
        created_at,
        succeeded_at,
        failed_at
      `)
      .eq('salon_id', auth.salonId)
      .order('created_at', { ascending: false });

    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);
    if (status && status !== 'all') query = query.eq('status', status);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return csvResponse(
      'transaktionen',
      [
        'ID',
        'Datum',
        'Referenztyp',
        'Referenz-ID',
        'Betrag',
        'Währung',
        'Zahlungsart',
        'Status',
        'Stripe PaymentIntent',
        'Erfolgreich am',
        'Fehlgeschlagen am',
        'Fehlercode',
        'Fehlermeldung',
      ],
      (data || []).map((payment: any) => [
        payment.id,
        formatDate(payment.created_at),
        payment.reference_type,
        payment.reference_id,
        centsToCurrency(payment.amount_cents),
        payment.currency,
        payment.payment_method,
        payment.status,
        payment.stripe_payment_intent_id || '',
        formatDate(payment.succeeded_at),
        formatDate(payment.failed_at),
        payment.error_code || '',
        payment.error_message || '',
      ])
    );
  } catch (error) {
    console.error('Transaction export error:', error);
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 });
  }
}
