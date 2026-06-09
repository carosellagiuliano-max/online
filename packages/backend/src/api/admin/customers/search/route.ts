import { NextRequest, NextResponse } from 'next/server';
import { createServerClient as createAuthClient, createServiceRoleClient } from '@/lib/supabase/server';
import { isSuperadminEmail } from '@/lib/auth/superadmin';

const ALLOWED_ROLES = ['admin', 'manager', 'staff', 'hq'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type CustomerSearchRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  profile_id?: string | null;
  profiles?: {
    email: string | null;
    phone: string | null;
  } | Array<{
    email: string | null;
    phone: string | null;
  }> | null;
};

function normalizeSearchTerm(value: string | null): string {
  return (value || '').trim().slice(0, 100);
}

function mergeCustomers(groups: Array<CustomerSearchRow[] | null | undefined>): CustomerSearchRow[] {
  const seen = new Set<string>();
  const merged: CustomerSearchRow[] = [];

  for (const group of groups) {
    for (const customer of group || []) {
      if (seen.has(customer.id)) continue;
      seen.add(customer.id);
      merged.push({
        ...customer,
        profiles: Array.isArray(customer.profiles)
          ? customer.profiles[0] || null
          : customer.profiles || null,
      });
      if (merged.length >= 10) return merged;
    }
  }

  return merged;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = normalizeSearchTerm(searchParams.get('q'));
    const salonId = searchParams.get('salonId') || '';

    if (query.length < 2) {
      return NextResponse.json({ customers: [] });
    }

    if (!UUID_RE.test(salonId)) {
      return NextResponse.json({ error: 'Salon ID erforderlich' }, { status: 400 });
    }

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
      console.error('[customer-search] Staff lookup error:', staffError);
      return NextResponse.json({ error: 'Berechtigung konnte nicht geprüft werden' }, { status: 500 });
    }

    if (!isSuperadmin && !staffMember) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 });
    }

    if (
      staffMember &&
      staffMember.role !== 'hq' &&
      staffMember.salon_id !== salonId
    ) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 });
    }

    const selectColumns = `
      id,
      first_name,
      last_name,
      email,
      phone,
      profile_id,
      profiles (email, phone)
    `;

    const customerBase = () => (supabase.from('customers') as any)
      .select(selectColumns)
      .eq('salon_id', salonId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .limit(10);

    const [
      firstNameMatches,
      lastNameMatches,
      emailMatches,
      phoneMatches,
      profileEmailMatches,
      profilePhoneMatches,
    ] = await Promise.all([
      customerBase().ilike('first_name', `%${query}%`),
      customerBase().ilike('last_name', `%${query}%`),
      customerBase().ilike('email', `%${query}%`),
      customerBase().ilike('phone', `%${query}%`),
      (supabase.from('profiles') as any)
        .select('id')
        .ilike('email', `%${query}%`)
        .limit(20),
      (supabase.from('profiles') as any)
        .select('id')
        .ilike('phone', `%${query}%`)
        .limit(20),
    ]);

    for (const result of [firstNameMatches, lastNameMatches, emailMatches, phoneMatches, profileEmailMatches, profilePhoneMatches]) {
      if (result.error) {
        console.error('[customer-search] Search error:', result.error);
        return NextResponse.json({ error: 'Suchfehler' }, { status: 500 });
      }
    }

    const profileIds = Array.from(new Set([
      ...(profileEmailMatches.data || []).map((profile: { id: string }) => profile.id),
      ...(profilePhoneMatches.data || []).map((profile: { id: string }) => profile.id),
    ]));
    const profileCustomerMatches: any = profileIds.length > 0
      ? await customerBase().in('profile_id', profileIds)
      : { data: [] };

    if (profileCustomerMatches.error) {
      console.error('[customer-search] Profile customer search error:', profileCustomerMatches.error);
      return NextResponse.json({ error: 'Suchfehler' }, { status: 500 });
    }

    const customers = mergeCustomers([
      firstNameMatches.data,
      lastNameMatches.data,
      emailMatches.data,
      phoneMatches.data,
      profileCustomerMatches.data,
    ]);

    return NextResponse.json({ customers });
  } catch (error) {
    console.error('[customer-search] Error:', error);
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 });
  }
}
