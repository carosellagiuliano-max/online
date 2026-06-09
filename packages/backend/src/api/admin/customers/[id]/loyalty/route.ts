import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiContext, type AdminApiContext } from '@/lib/auth/admin-context';

type LoyaltyAccountRow = {
  id: string;
  points_balance: number | null;
  lifetime_points: number | null;
};

async function getSalonCustomer(
  context: AdminApiContext,
  customerId: string
) {
  const { data: customer } = await context.db
    .from('customers')
    .select('id')
    .eq('id', customerId)
    .eq('salon_id', context.salonId)
    .is('deleted_at', null)
    .single();

  return customer;
}

async function getOrCreateLoyaltyProgram(
  context: AdminApiContext
) {
  const { data: existingProgram } = await context.db
    .from('loyalty_programs')
    .select('id')
    .eq('salon_id', context.salonId)
    .eq('is_active', true)
    .single();

  if (existingProgram) {
    return existingProgram;
  }

  const { data: createdProgram, error } = await context.db
    .from('loyalty_programs')
    .insert({
      salon_id: context.salonId,
      name: 'Treuepunkte',
      is_active: true,
    })
    .select('id')
    .single();

  if (error || !createdProgram) {
    throw new Error(error?.message || 'Treueprogramm konnte nicht erstellt werden');
  }

  return createdProgram;
}

async function getOrCreateLoyaltyAccount(
  context: AdminApiContext,
  customerId: string,
  programId: string
): Promise<LoyaltyAccountRow> {
  const { data: existingAccount } = await context.db
    .from('customer_loyalty')
    .select('id, points_balance, lifetime_points')
    .eq('customer_id', customerId)
    .eq('program_id', programId)
    .single();

  if (existingAccount) {
    return existingAccount as LoyaltyAccountRow;
  }

  const { data: createdAccount, error } = await context.db
    .from('customer_loyalty')
    .insert({
      customer_id: customerId,
      program_id: programId,
      points_balance: 0,
      lifetime_points: 0,
    })
    .select('id, points_balance, lifetime_points')
    .single();

  if (error || !createdAccount) {
    throw new Error(error?.message || 'Treuekonto konnte nicht erstellt werden');
  }

  return createdAccount as LoyaltyAccountRow;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: customerId } = await params;
    const context = await requireAdminApiContext(['admin', 'manager', 'hq']);
    if ('response' in context) return context.response;

    const body = await request.json();
    const points = Number(body.points);
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

    if (!Number.isInteger(points) || points === 0) {
      return NextResponse.json({ error: 'Punkte erforderlich' }, { status: 400 });
    }

    if (!reason) {
      return NextResponse.json({ error: 'Grund erforderlich' }, { status: 400 });
    }

    const customer = await getSalonCustomer(context, customerId);
    if (!customer) {
      return NextResponse.json({ error: 'Kunde nicht gefunden' }, { status: 404 });
    }

    const program = await getOrCreateLoyaltyProgram(context);
    const account = await getOrCreateLoyaltyAccount(context, customerId, program.id);

    const balanceBefore = account.points_balance || 0;
    const balanceAfter = balanceBefore + points;

    if (balanceAfter < 0) {
      return NextResponse.json(
        { error: 'Nicht genügend Punkte vorhanden' },
        { status: 400 }
      );
    }

    const { error: transactionError } = await context.db
      .from('loyalty_transactions')
      .insert({
        customer_loyalty_id: account.id,
        transaction_type: 'adjustment',
        points,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        description: reason,
        processed_by: context.user.id,
      });

    if (transactionError) {
      console.error('Loyalty transaction error:', transactionError);
      return NextResponse.json({ error: transactionError.message }, { status: 500 });
    }

    const lifetimePoints = points > 0
      ? (account.lifetime_points || 0) + points
      : (account.lifetime_points || 0);

    const { error: updateError } = await context.db
      .from('customer_loyalty')
      .update({
        points_balance: balanceAfter,
        lifetime_points: lifetimePoints,
        updated_at: new Date().toISOString(),
      })
      .eq('id', account.id);

    if (updateError) {
      console.error('Loyalty account update error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await context.db.rpc('check_tier_upgrade', {
      p_customer_loyalty_id: account.id,
    }).catch(() => {
      // Older local schemas may not expose this RPC.
    });

    return NextResponse.json({
      success: true,
      newBalance: balanceAfter,
      message: `${Math.abs(points)} Punkte ${points > 0 ? 'hinzugefügt' : 'abgezogen'}`,
    });
  } catch (error) {
    console.error('Loyalty adjustment error:', error);
    const message = error instanceof Error ? error.message : 'Interner Serverfehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: customerId } = await params;
    const context = await requireAdminApiContext(['admin', 'manager', 'staff', 'hq']);
    if ('response' in context) return context.response;

    const customer = await getSalonCustomer(context, customerId);
    if (!customer) {
      return NextResponse.json({ error: 'Kunde nicht gefunden' }, { status: 404 });
    }

    const program = await getOrCreateLoyaltyProgram(context);
    const account = await getOrCreateLoyaltyAccount(context, customerId, program.id);

    const { data: transactions } = await context.db
      .from('loyalty_transactions')
      .select('*')
      .eq('customer_loyalty_id', account.id)
      .order('created_at', { ascending: false })
      .limit(50);

    return NextResponse.json({
      account,
      transactions: transactions || [],
    });
  } catch (error) {
    console.error('Loyalty fetch error:', error);
    const message = error instanceof Error ? error.message : 'Interner Serverfehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
