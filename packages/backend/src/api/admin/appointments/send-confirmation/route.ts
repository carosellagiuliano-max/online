import { NextRequest, NextResponse } from 'next/server';
import { createServerClient as createAuthClient, createServiceRoleClient } from '@/lib/supabase/server';
import { isSuperadminEmail } from '@/lib/auth/superadmin';
import { sendAdminAppointmentConfirmationEmail } from '@/lib/email/admin-appointment-confirmation';

const ALLOWED_ROLES = ['admin', 'manager', 'staff', 'hq'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  try {
    const authClient = await createAuthClient();
    const supabase = createServiceRoleClient();

    if (!supabase) {
      return NextResponse.json({ error: 'Service nicht verfügbar' }, { status: 503 });
    }

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const appointmentId = typeof body?.appointmentId === 'string' ? body.appointmentId : '';

    if (!UUID_RE.test(appointmentId)) {
      return NextResponse.json({ error: 'Termin-ID fehlt oder ist ungültig' }, { status: 400 });
    }

    const { data: appointment, error: appointmentError } = await (supabase.from('appointments') as any)
      .select('id, salon_id')
      .eq('id', appointmentId)
      .single();

    if (appointmentError || !appointment) {
      return NextResponse.json({ error: 'Termin nicht gefunden' }, { status: 404 });
    }

    const isSuperadmin = isSuperadminEmail(user.email);
    const { data: staffMember, error: staffError }: {
      data: { id: string; salon_id: string; role: string } | null;
      error: { message?: string } | null;
    } = isSuperadmin
      ? { data: null, error: null }
      : await (supabase.from('staff') as any)
          .select('id, salon_id, role')
          .eq('profile_id', user.id)
          .eq('is_active', true)
          .in('role', ALLOWED_ROLES)
          .limit(1)
          .maybeSingle();

    if (staffError) {
      console.error('[send-confirmation] Staff lookup error:', staffError);
      return NextResponse.json({ error: 'Berechtigung konnte nicht geprüft werden' }, { status: 500 });
    }

    if (!isSuperadmin && !staffMember) {
      return NextResponse.json({ error: 'Keine Berechtigung für diese Aktion' }, { status: 403 });
    }

    if (
      staffMember &&
      staffMember.role !== 'hq' &&
      staffMember.salon_id !== appointment.salon_id
    ) {
      return NextResponse.json({ error: 'Keine Berechtigung für diesen Termin' }, { status: 403 });
    }

    const sent = await sendAdminAppointmentConfirmationEmail(
      supabase,
      appointmentId,
      'send-confirmation'
    );

    if (!sent) {
      return NextResponse.json(
        { error: 'Bestätigung konnte nicht gesendet werden' },
        { status: 422 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[send-confirmation] Error:', error);
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 });
  }
}
