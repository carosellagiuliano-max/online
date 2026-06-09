import { NextRequest, NextResponse } from 'next/server';
import { createServerClient as createAuthClient, createServiceRoleClient } from '@/lib/supabase/server';
import { isSuperadminEmail } from '@/lib/auth/superadmin';

const ADMIN_ROLES = ['admin', 'manager', 'hq'];
const STAFF_ROLES = ['admin', 'manager', 'staff', 'hq'];

async function requireCustomerAccess(customerId: string, allowedRoles: string[]) {
  const authClient = await createAuthClient();
  const supabase = createServiceRoleClient();

  if (!supabase) {
    return { ok: false as const, response: NextResponse.json({ error: 'Service nicht verfügbar' }, { status: 503 }) };
  }

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser();

  if (authError || !user) {
    return { ok: false as const, response: NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 }) };
  }

  const { data: customer, error: customerError } = await (supabase.from('customers') as any)
    .select('id, salon_id')
    .eq('id', customerId)
    .maybeSingle();

  if (customerError || !customer) {
    return { ok: false as const, response: NextResponse.json({ error: 'Kunde nicht gefunden' }, { status: 404 }) };
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
        .in('role', allowedRoles)
        .limit(1)
        .maybeSingle();

  if (staffError) {
    console.error('[admin-customer] Staff lookup error:', staffError);
    return { ok: false as const, response: NextResponse.json({ error: 'Berechtigung konnte nicht geprüft werden' }, { status: 500 }) };
  }

  if (!isSuperadmin && !staffMember) {
    return { ok: false as const, response: NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 }) };
  }

  if (
    staffMember &&
    staffMember.role !== 'hq' &&
    staffMember.salon_id !== customer.salon_id
  ) {
    return { ok: false as const, response: NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 }) };
  }

  return { ok: true as const, supabase, customer, user };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await requireCustomerAccess(id, STAFF_ROLES);

    if (!auth.ok) {
      return auth.response;
    }

    const { data: customer, error } = await (auth.supabase.from('customers') as any)
      .select(`
        *,
        profiles (email, phone, avatar_url),
        customer_loyalty (points_balance, current_tier_id)
      `)
      .eq('id', id)
      .eq('salon_id', auth.customer.salon_id)
      .single();

    if (error || !customer) {
      return NextResponse.json({ error: 'Kunde nicht gefunden' }, { status: 404 });
    }

    return NextResponse.json({ customer });
  } catch (error) {
    console.error('[admin-customer] Fetch error:', error);
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await requireCustomerAccess(id, ADMIN_ROLES);

    if (!auth.ok) {
      return auth.response;
    }

    const body = await request.json();
    const { firstName, lastName, phone, birthDate, gender, notes, tags, marketingConsent } = body;
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (firstName !== undefined) updateData.first_name = firstName;
    if (lastName !== undefined) updateData.last_name = lastName;
    if (phone !== undefined) updateData.phone = phone;
    if (birthDate !== undefined) updateData.birth_date = birthDate;
    if (gender !== undefined) updateData.gender = gender;
    if (notes !== undefined) updateData.notes = notes;
    if (tags !== undefined) updateData.tags = tags;

    const { error } = await (auth.supabase.from('customers') as any)
      .update(updateData)
      .eq('id', id)
      .eq('salon_id', auth.customer.salon_id);

    if (error) {
      console.error('[admin-customer] Update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (marketingConsent !== undefined) {
      const { data: customer } = await (auth.supabase.from('customers') as any)
        .select('profile_id')
        .eq('id', id)
        .eq('salon_id', auth.customer.salon_id)
        .single();

      if (customer?.profile_id) {
        await (auth.supabase.from('consent_records') as any)
          .update({ revoked_at: new Date().toISOString() })
          .eq('profile_id', customer.profile_id)
          .eq('salon_id', auth.customer.salon_id)
          .eq('category', 'marketing_email')
          .is('revoked_at', null);

        await (auth.supabase.from('consent_records') as any).insert({
          profile_id: customer.profile_id,
          salon_id: auth.customer.salon_id,
          category: 'marketing_email',
          consented: Boolean(marketingConsent),
          consent_method: 'admin',
          consented_at: new Date().toISOString(),
          revoked_at: marketingConsent ? null : new Date().toISOString(),
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[admin-customer] Update exception:', error);
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await requireCustomerAccess(id, ['admin', 'hq']);

    if (!auth.ok) {
      return auth.response;
    }

    const { error } = await (auth.supabase.from('customers') as any)
      .update({
        deleted_at: new Date().toISOString(),
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('salon_id', auth.customer.salon_id);

    if (error) {
      console.error('[admin-customer] Delete error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[admin-customer] Delete exception:', error);
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 });
  }
}
