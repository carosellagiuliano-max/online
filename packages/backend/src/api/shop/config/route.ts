import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/client';

const DEFAULT_SALON_ID = '550e8400-e29b-41d4-a716-446655440001';
const SALON_ID = process.env.NEXT_PUBLIC_SALON_ID || DEFAULT_SALON_ID;
const SHIPPING_SETTINGS_KEY = 'shop.shipping';

// Default shipping settings
const DEFAULT_SHIPPING_SETTINGS = {
  standardShippingCents: 900, // CHF 9.00
  freeShippingThresholdCents: 5000, // CHF 50.00
  enableFreeShipping: true,
  expressEnabled: true,
  expressShippingCents: 1490, // CHF 14.90
  expressEstimatedDays: '1-2',
  standardEstimatedDays: '3-5',
  pickupEnabled: true,
};

// Build shipping options from settings
function buildShippingOptions(settings: typeof DEFAULT_SHIPPING_SETTINGS) {
  const options = [];

  // Standard shipping - always available
  options.push({
    type: 'standard',
    name: 'Standardversand',
    description: `${settings.standardEstimatedDays || '3-5'} Werktage`,
    priceCents: settings.standardShippingCents,
    estimatedDays: settings.standardEstimatedDays || '3-5',
    available: true,
  });

  // Express shipping - configurable
  if (settings.expressEnabled) {
    options.push({
      type: 'express',
      name: 'Expressversand',
      description: `${settings.expressEstimatedDays || '1-2'} Werktage`,
      priceCents: settings.expressShippingCents,
      estimatedDays: settings.expressEstimatedDays || '1-2',
      available: true,
    });
  }

  // Pickup - configurable
  if (settings.pickupEnabled !== false) {
    options.push({
      type: 'pickup',
      name: 'Abholung im Salon',
      description: 'Kostenlos',
      priceCents: 0,
      available: true,
    });
  }

  return options;
}

// ============================================
// GET - Fetch public shop configuration
// ============================================

export async function GET() {
  try {
    const supabase = createServerClient();
    if (!supabase) {
      // Return defaults if database not available
      const defaultOptions = buildShippingOptions(DEFAULT_SHIPPING_SETTINGS);
      return NextResponse.json({
        success: true,
        data: {
          shipping: DEFAULT_SHIPPING_SETTINGS,
          shippingOptions: defaultOptions,
        },
      });
    }

    // Get shipping settings from database
    const { data: setting } = await supabase
      .from('settings')
      .select('value')
      .eq('salon_id', SALON_ID)
      .eq('key', SHIPPING_SETTINGS_KEY)
      .eq('is_public', true)
      .single();

    // Return stored settings or defaults
    const shippingSettings = {
      ...DEFAULT_SHIPPING_SETTINGS,
      ...((setting as { value?: Partial<typeof DEFAULT_SHIPPING_SETTINGS> } | null)?.value || {}),
    };
    const shippingOptions = buildShippingOptions(shippingSettings);

    return NextResponse.json({
      success: true,
      data: {
        shipping: shippingSettings,
        shippingOptions,
      },
    });
  } catch (error) {
    console.error('Error fetching shop config:', error);
    // Return defaults on error
    const defaultOptions = buildShippingOptions(DEFAULT_SHIPPING_SETTINGS);
    return NextResponse.json({
      success: true,
      data: {
        shipping: DEFAULT_SHIPPING_SETTINGS,
        shippingOptions: defaultOptions,
      },
    });
  }
}
