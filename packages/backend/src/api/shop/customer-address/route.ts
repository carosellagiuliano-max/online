import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

const SALON_ID = process.env.NEXT_PUBLIC_SALON_ID || '550e8400-e29b-41d4-a716-446655440001';

export async function GET() {
  try {
    const supabase = await createServerClient() as any;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const { data: customer } = await supabase
      .from('customers')
      .select('street, street2, zip, city, country')
      .eq('salon_id', SALON_ID)
      .eq('profile_id', user.id)
      .single();

    if (!customer || !customer.street) {
      return NextResponse.json({ success: true, data: null });
    }

    return NextResponse.json({ success: true, data: customer });
  } catch (error) {
    console.error('Error loading customer address:', error);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
