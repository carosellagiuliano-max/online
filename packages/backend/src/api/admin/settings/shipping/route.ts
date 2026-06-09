import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdminApiContext } from '@/lib/auth/admin-context';

const SHIPPING_SETTINGS_KEY = 'shop.shipping';

// Default shipping settings
const DEFAULT_SHIPPING_SETTINGS = {
  standardShippingCents: 900, // CHF 9.00
  freeShippingThresholdCents: 5000, // CHF 50.00
  enableFreeShipping: true,
  // Express delivery settings
  expressEnabled: true,
  expressShippingCents: 1490, // CHF 14.90
  expressEstimatedDays: '1-2',
  // Standard delivery description
  standardEstimatedDays: '3-5',
  // Pickup settings
  pickupEnabled: true,
};

// ============================================
// GET - Fetch shipping settings
// ============================================

export async function GET() {
  try {
    const context = await requireAdminApiContext(['admin', 'manager', 'hq']);
    if ('response' in context) return context.response;

    // Get shipping settings from database
    const { data: setting } = await context.db
      .from('settings')
      .select('value')
      .eq('salon_id', context.salonId)
      .eq('key', SHIPPING_SETTINGS_KEY)
      .single();

    // Return stored settings or defaults
    const shippingSettings = setting?.value || DEFAULT_SHIPPING_SETTINGS;

    return NextResponse.json({
      success: true,
      data: shippingSettings,
    });
  } catch (error) {
    console.error('Error fetching shipping settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch shipping settings' },
      { status: 500 }
    );
  }
}

// ============================================
// PUT - Update shipping settings
// ============================================

export async function PUT(request: NextRequest) {
  try {
    const context = await requireAdminApiContext(['admin', 'manager', 'hq']);
    if ('response' in context) return context.response;

    const body = await request.json();
    const {
      standardShippingCents,
      freeShippingThresholdCents,
      enableFreeShipping,
      expressEnabled,
      expressShippingCents,
      expressEstimatedDays,
      standardEstimatedDays,
      pickupEnabled,
    } = body;

    // Validate input
    if (typeof standardShippingCents !== 'number' || standardShippingCents < 0) {
      return NextResponse.json(
        { error: 'Invalid shipping cost' },
        { status: 400 }
      );
    }

    if (typeof freeShippingThresholdCents !== 'number' || freeShippingThresholdCents < 0) {
      return NextResponse.json(
        { error: 'Invalid free shipping threshold' },
        { status: 400 }
      );
    }

    if (expressEnabled && (typeof expressShippingCents !== 'number' || expressShippingCents < 0)) {
      return NextResponse.json(
        { error: 'Invalid express shipping cost' },
        { status: 400 }
      );
    }

    const shippingSettings = {
      standardShippingCents,
      freeShippingThresholdCents,
      enableFreeShipping: enableFreeShipping ?? true,
      expressEnabled: expressEnabled ?? true,
      expressShippingCents: expressShippingCents ?? 1490,
      expressEstimatedDays: expressEstimatedDays ?? '1-2',
      standardEstimatedDays: standardEstimatedDays ?? '3-5',
      pickupEnabled: pickupEnabled ?? true,
    };

    // Upsert settings
    const { error } = await context.db
      .from('settings')
      .upsert({
        salon_id: context.salonId,
        key: SHIPPING_SETTINGS_KEY,
        category: 'shop',
        value: shippingSettings,
        value_type: 'json',
        description: 'Shop shipping settings',
        is_public: true,
        is_editable: true,
      }, {
        onConflict: 'salon_id,key',
      });

    if (error) {
      console.error('Error saving shipping settings:', error);
      return NextResponse.json(
        { error: 'Failed to save shipping settings' },
        { status: 500 }
      );
    }

    revalidatePath('/checkout');
    revalidatePath('/shop');

    return NextResponse.json({
      success: true,
      data: shippingSettings,
    });
  } catch (error) {
    console.error('Error updating shipping settings:', error);
    return NextResponse.json(
      { error: 'Failed to update shipping settings' },
      { status: 500 }
    );
  }
}
