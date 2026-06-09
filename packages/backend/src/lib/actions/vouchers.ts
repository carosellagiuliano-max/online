'use server';

// ============================================
// BeautifyPRO - Voucher Server Actions
// ============================================

import { createServerClient } from '@/lib/db/client';
import { revalidatePath } from 'next/cache';

// ============================================
// TYPES
// ============================================

interface ActionResult<T> {
  data: T | null;
  error: string | null;
}

export interface Voucher {
  id: string;
  code: string;
  type: 'value' | 'service';
  initialValueCents: number;
  remainingValueCents: number;
  isActive: boolean;
  validFrom?: Date;
  validUntil?: Date;
  expiresAt?: Date;
  purchaserCustomerId?: string;
  recipientEmail?: string;
  recipientName?: string;
  personalMessage?: string;
  redeemedAt?: Date;
  createdAt: Date;
}

export interface VoucherValidation {
  voucherId: string | null;
  remainingValueCents: number;
  isValid: boolean;
  invalidReason: string | null;
}

export interface RedeemVoucherInput {
  voucherId: string;
  amountCents: number;
  customerId?: string;
  referenceType?: 'order' | 'appointment';
  referenceId?: string;
}

export interface CreateVoucherInput {
  salonId: string;
  valueCents: number;
  type?: 'value' | 'service';
  recipientEmail?: string;
  recipientName?: string;
  personalMessage?: string;
  purchaserCustomerId?: string;
  isSingleUse?: boolean;
  validUntil?: Date;
}

// ============================================
// VALIDATE VOUCHER
// ============================================

/**
 * Validate a voucher code
 */
export async function validateVoucher(
  salonId: string,
  code: string
): Promise<ActionResult<VoucherValidation>> {
  try {
    const supabase = createServerClient();
    if (!supabase) {
      return { data: null, error: 'Datenbankverbindung nicht verfügbar' };
    }

    // Use database function for validation
    const { data: result, error } = await supabase.rpc('validate_voucher', {
      p_salon_id: salonId,
      p_code: code.trim().toUpperCase(),
    });

    if (error) {
      console.error('Voucher validation error:', error);
      return { data: null, error: 'Fehler bei der Gutscheinprüfung' };
    }

    const validation = result?.[0];
    if (!validation) {
      return {
        data: {
          voucherId: null,
          remainingValueCents: 0,
          isValid: false,
          invalidReason: 'Gutschein nicht gefunden',
        },
        error: null,
      };
    }

    return {
      data: {
        voucherId: validation.voucher_id,
        remainingValueCents: validation.remaining_value_cents,
        isValid: validation.is_valid,
        invalidReason: validation.invalid_reason,
      },
      error: null,
    };
  } catch (error) {
    console.error('validateVoucher error:', error);
    return { data: null, error: 'Fehler bei der Gutscheinprüfung' };
  }
}

// ============================================
// REDEEM VOUCHER
// ============================================

/**
 * Redeem (use) a voucher
 */
export async function redeemVoucher(
  salonId: string,
  input: RedeemVoucherInput
): Promise<ActionResult<{ newRemainingCents: number }>> {
  try {
    const supabase = createServerClient();
    if (!supabase) {
      return { data: null, error: 'Datenbankverbindung nicht verfügbar' };
    }

    // Use database function for redemption
    const { data: newRemaining, error } = await supabase.rpc('redeem_voucher', {
      p_voucher_id: input.voucherId,
      p_amount_cents: input.amountCents,
      p_customer_id: input.customerId,
    });

    if (error) {
      console.error('Voucher redemption error:', error);
      if (error.message.includes('balance')) {
        return { data: null, error: 'Guthabenüberschreitung' };
      }
      return { data: null, error: 'Fehler beim Einlösen des Gutscheins' };
    }

    // Record the redemption transaction
    await supabase.from('voucher_transactions').insert({
      voucher_id: input.voucherId,
      amount_cents: input.amountCents,
      transaction_type: 'redemption',
      reference_type: input.referenceType,
      reference_id: input.referenceId,
      customer_id: input.customerId,
    }).catch(() => {
      // Transaction logging failed but redemption succeeded
      console.warn('Failed to log voucher transaction');
    });

    revalidatePath('/admin/vouchers');

    return {
      data: { newRemainingCents: newRemaining ?? 0 },
      error: null,
    };
  } catch (error) {
    console.error('redeemVoucher error:', error);
    return { data: null, error: 'Fehler beim Einlösen des Gutscheins' };
  }
}

// ============================================
// GET VOUCHER BY CODE
// ============================================

/**
 * Get voucher details by code
 */
export async function getVoucherByCode(
  salonId: string,
  code: string
): Promise<ActionResult<Voucher>> {
  try {
    const supabase = createServerClient();
    if (!supabase) {
      return { data: null, error: 'Datenbankverbindung nicht verfügbar' };
    }

    const { data: voucher, error } = await supabase
      .from('vouchers')
      .select('*')
      .eq('salon_id', salonId)
      .eq('code', code.trim().toUpperCase())
      .single();

    if (error || !voucher) {
      return { data: null, error: 'Gutschein nicht gefunden' };
    }

    return {
      data: transformDbVoucher(voucher),
      error: null,
    };
  } catch (error) {
    console.error('getVoucherByCode error:', error);
    return { data: null, error: 'Fehler beim Laden des Gutscheins' };
  }
}

// ============================================
// GET VOUCHER BY ID
// ============================================

/**
 * Get voucher by ID
 */
export async function getVoucher(
  voucherId: string
): Promise<ActionResult<Voucher>> {
  try {
    const supabase = createServerClient();
    if (!supabase) {
      return { data: null, error: 'Datenbankverbindung nicht verfügbar' };
    }

    const { data: voucher, error } = await supabase
      .from('vouchers')
      .select('*')
      .eq('id', voucherId)
      .single();

    if (error || !voucher) {
      return { data: null, error: 'Gutschein nicht gefunden' };
    }

    return {
      data: transformDbVoucher(voucher),
      error: null,
    };
  } catch (error) {
    console.error('getVoucher error:', error);
    return { data: null, error: 'Fehler beim Laden des Gutscheins' };
  }
}

// ============================================
// GET CUSTOMER VOUCHERS
// ============================================

/**
 * Get vouchers purchased by or for a customer
 */
export async function getCustomerVouchers(
  customerId: string,
  options: { includeUsed?: boolean } = {}
): Promise<ActionResult<Voucher[]>> {
  try {
    const supabase = createServerClient();
    if (!supabase) {
      return { data: null, error: 'Datenbankverbindung nicht verfügbar' };
    }
    const { includeUsed = false } = options;

    let query = supabase
      .from('vouchers')
      .select('*')
      .or(`purchaser_customer_id.eq.${customerId},purchased_by_customer_id.eq.${customerId}`)
      .order('created_at', { ascending: false });

    if (!includeUsed) {
      query = query.gt('remaining_value_cents', 0);
    }

    const { data: vouchers, error } = await query;

    if (error) {
      return { data: null, error: 'Fehler beim Laden der Gutscheine' };
    }

    return {
      data: (vouchers || []).map(transformDbVoucher),
      error: null,
    };
  } catch (error) {
    console.error('getCustomerVouchers error:', error);
    return { data: null, error: 'Fehler beim Laden der Gutscheine' };
  }
}

// ============================================
// CREATE VOUCHER (Admin)
// ============================================

/**
 * Create a new voucher (admin only)
 */
export async function createVoucher(
  input: CreateVoucherInput
): Promise<ActionResult<Voucher>> {
  try {
    const supabase = createServerClient();
    if (!supabase) {
      return { data: null, error: 'Datenbankverbindung nicht verfügbar' };
    }

    // Generate unique code using database function
    const { data: code, error: codeError } = await supabase.rpc(
      'generate_voucher_code',
      { p_salon_id: input.salonId }
    );

    if (codeError || !code) {
      return { data: null, error: 'Fehler beim Generieren des Gutscheincodes' };
    }

    // Calculate expiry (default 1 year)
    const validUntil = input.validUntil || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    const { data: voucher, error } = await supabase
      .from('vouchers')
      .insert({
        salon_id: input.salonId,
        code,
        type: input.type || 'gift_card',
        initial_value_cents: input.valueCents,
        remaining_value_cents: input.valueCents,
        amount_cents: input.valueCents,
        recipient_email: input.recipientEmail,
        recipient_name: input.recipientName,
        personal_message: input.personalMessage,
        purchaser_customer_id: input.purchaserCustomerId,
        purchased_by_customer_id: input.purchaserCustomerId,
        is_single_use: input.isSingleUse || false,
        valid_until: validUntil.toISOString(),
        expires_at: validUntil.toISOString(),
        is_active: true,
        status: 'active',
      })
      .select()
      .single();

    if (error || !voucher) {
      console.error('Create voucher error:', error);
      return { data: null, error: 'Fehler beim Erstellen des Gutscheins' };
    }

    revalidatePath('/admin/vouchers');

    return {
      data: transformDbVoucher(voucher),
      error: null,
    };
  } catch (error) {
    console.error('createVoucher error:', error);
    return { data: null, error: 'Fehler beim Erstellen des Gutscheins' };
  }
}

// ============================================
// DEACTIVATE VOUCHER (Admin)
// ============================================

/**
 * Deactivate a voucher
 */
export async function deactivateVoucher(
  voucherId: string
): Promise<ActionResult<Voucher>> {
  try {
    const supabase = createServerClient();
    if (!supabase) {
      return { data: null, error: 'Datenbankverbindung nicht verfügbar' };
    }

    const { data: voucher, error } = await supabase
      .from('vouchers')
      .update({
        is_active: false,
        status: 'cancelled',
      })
      .eq('id', voucherId)
      .select()
      .single();

    if (error || !voucher) {
      return { data: null, error: 'Fehler beim Deaktivieren des Gutscheins' };
    }

    revalidatePath('/admin/vouchers');

    return {
      data: transformDbVoucher(voucher),
      error: null,
    };
  } catch (error) {
    console.error('deactivateVoucher error:', error);
    return { data: null, error: 'Fehler beim Deaktivieren des Gutscheins' };
  }
}

// ============================================
// GET SALON VOUCHERS (Admin)
// ============================================

/**
 * Get all vouchers for a salon (admin)
 */
export async function getSalonVouchers(
  salonId: string,
  options: {
    limit?: number;
    offset?: number;
    status?: 'active' | 'used' | 'expired' | 'cancelled';
  } = {}
): Promise<ActionResult<{ vouchers: Voucher[]; total: number }>> {
  try {
    const supabase = createServerClient();
    if (!supabase) {
      return { data: null, error: 'Datenbankverbindung nicht verfügbar' };
    }
    const { limit = 50, offset = 0, status } = options;

    let query = supabase
      .from('vouchers')
      .select('*', { count: 'exact' })
      .eq('salon_id', salonId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by status
    if (status === 'active') {
      query = query.eq('is_active', true).gt('remaining_value_cents', 0);
    } else if (status === 'used') {
      query = query.eq('remaining_value_cents', 0);
    } else if (status === 'expired') {
      query = query.lt('valid_until', new Date().toISOString());
    } else if (status === 'cancelled') {
      query = query.eq('is_active', false);
    }

    const { data: vouchers, count, error } = await query;

    if (error) {
      return { data: null, error: 'Fehler beim Laden der Gutscheine' };
    }

    return {
      data: {
        vouchers: (vouchers || []).map(transformDbVoucher),
        total: count || 0,
      },
      error: null,
    };
  } catch (error) {
    console.error('getSalonVouchers error:', error);
    return { data: null, error: 'Fehler beim Laden der Gutscheine' };
  }
}

// ============================================
// CHECK VOUCHER BALANCE
// ============================================

/**
 * Quick check of voucher balance
 */
export async function checkVoucherBalance(
  salonId: string,
  code: string
): Promise<ActionResult<{ balance: number; isValid: boolean }>> {
  const result = await validateVoucher(salonId, code);

  if (result.error || !result.data) {
    return { data: null, error: result.error || 'Gutschein nicht gefunden' };
  }

  return {
    data: {
      balance: result.data.remainingValueCents,
      isValid: result.data.isValid,
    },
    error: null,
  };
}

// ============================================
// HELPERS
// ============================================

/**
 * Transform database voucher to Voucher type
 */
function transformDbVoucher(dbVoucher: any): Voucher {
  return {
    id: dbVoucher.id,
    code: dbVoucher.code,
    type: dbVoucher.type === 'gift_card' ? 'value' : dbVoucher.type,
    initialValueCents: dbVoucher.initial_value_cents,
    remainingValueCents: dbVoucher.remaining_value_cents,
    isActive: dbVoucher.is_active,
    validFrom: dbVoucher.valid_from ? new Date(dbVoucher.valid_from) : undefined,
    validUntil: dbVoucher.valid_until ? new Date(dbVoucher.valid_until) : undefined,
    expiresAt: dbVoucher.expires_at ? new Date(dbVoucher.expires_at) : undefined,
    purchaserCustomerId: dbVoucher.purchaser_customer_id || dbVoucher.purchased_by_customer_id,
    recipientEmail: dbVoucher.recipient_email,
    recipientName: dbVoucher.recipient_name,
    personalMessage: dbVoucher.personal_message,
    redeemedAt: dbVoucher.redeemed_at ? new Date(dbVoucher.redeemed_at) : undefined,
    createdAt: new Date(dbVoucher.created_at),
  };
}

/**
 * Format voucher price for display
 */
export function formatVoucherPrice(cents: number): string {
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF',
  }).format(cents / 100);
}
