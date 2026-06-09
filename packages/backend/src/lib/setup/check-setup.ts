import { createServiceRoleClient } from '@/lib/supabase/server';

// Hardcoded salon ID (must match seed.sql and migrations)
export const SALON_ID = '550e8400-e29b-41d4-a716-446655440001';
export const ADMIN_STAFF_ID = 'b50e8400-e29b-41d4-a716-446655440001';

export interface SetupStatus {
  needsSetup: boolean;
  wizardEnabled: boolean;
  reason?: 'no_salon' | 'no_admin' | 'setup_complete';
}

/**
 * Check if the database needs initial setup
 * Uses service role client to bypass RLS (no auth user exists yet)
 */
export async function checkSetupStatus(): Promise<SetupStatus> {
  const wizardEnabled = process.env.ENABLE_WIZARD === 'true';

  // If wizard is disabled, never show setup
  if (!wizardEnabled) {
    return { needsSetup: false, wizardEnabled: false, reason: 'setup_complete' };
  }

  const supabase = createServiceRoleClient();

  // If we can't connect to DB, assume setup not needed (let other errors surface)
  if (!supabase) {
    console.error('[checkSetupStatus] Could not create service role client');
    return { needsSetup: false, wizardEnabled, reason: 'setup_complete' };
  }

  try {
    // Check if any salons exist
    const { count: salonCount, error: salonError } = await supabase
      .from('salons')
      .select('*', { count: 'exact', head: true });

    if (salonError) {
      console.error('[checkSetupStatus] Error checking salons:', salonError);
      return { needsSetup: false, wizardEnabled, reason: 'setup_complete' };
    }

    // No salons = definitely needs setup
    if (salonCount === 0) {
      return { needsSetup: true, wizardEnabled, reason: 'no_salon' };
    }

    // Check if admin setup was completed
    const { data: setupSetting, error: settingError } = await supabase
      .from('settings')
      .select('value')
      .eq('salon_id', SALON_ID)
      .eq('key', 'admin_setup_completed')
      .single();

    if (settingError && settingError.code !== 'PGRST116') {
      // PGRST116 = no rows returned, which is expected if not set up
      console.error('[checkSetupStatus] Error checking settings:', settingError);
    }

    // If setup completed marker exists and is true, setup is done
    if (setupSetting?.value === true || setupSetting?.value === 'true') {
      return { needsSetup: false, wizardEnabled, reason: 'setup_complete' };
    }

    // Salon exists but admin setup not completed
    return { needsSetup: true, wizardEnabled, reason: 'no_admin' };
  } catch (error) {
    console.error('[checkSetupStatus] Unexpected error:', error);
    return { needsSetup: false, wizardEnabled, reason: 'setup_complete' };
  }
}

/**
 * Check if wizard is enabled (can be called without DB access)
 */
export function isWizardEnabled(): boolean {
  return process.env.ENABLE_WIZARD === 'true';
}
