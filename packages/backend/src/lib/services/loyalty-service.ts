/**
 * BeautifyPRO - Loyalty Service
 * Handles loyalty points, tiers, and rewards
 */

import { createServiceRoleClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logging/logger';

// ============================================
// TYPES
// ============================================

export type LoyaltyTierName = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface LoyaltyTier {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string;
  minPoints: number;
  pointsMultiplier: number;
  discountPercent: number;
  priorityBooking: boolean;
}

export interface CustomerLoyalty {
  id: string;
  customerId: string;
  programId: string;
  pointsBalance: number;
  lifetimePoints: number;
  currentTier: LoyaltyTier | null;
  annualSpendCents: number;
  annualVisits: number;
  pointsValueChf: number;
}

export interface LoyaltyTransaction {
  id: string;
  type: 'earn_purchase' | 'earn_bonus' | 'earn_birthday' | 'redeem' | 'adjustment' | 'expire';
  points: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string | null;
  createdAt: Date;
  expiresAt: Date | null;
  referenceType: string | null;
  referenceId: string | null;
}

export interface LoyaltyProgram {
  id: string;
  salonId: string;
  name: string;
  description: string | null;
  pointsPerChf: number;
  pointsValueCents: number;
  minPointsToRedeem: number;
  birthdayBonusPoints: number;
  tiers: LoyaltyTier[];
}

// ============================================
// DEFAULT TIER CONFIGURATION
// ============================================

export const DEFAULT_TIERS: Omit<LoyaltyTier, 'id'>[] = [
  {
    name: 'Bronze',
    description: 'Willkommen im BeautifyPRO Treueprogramm',
    icon: '🥉',
    color: '#CD7F32',
    minPoints: 0,
    pointsMultiplier: 1.0,
    discountPercent: 0,
    priorityBooking: false,
  },
  {
    name: 'Silver',
    description: 'Sammeln Sie Punkte und profitieren Sie',
    icon: '🥈',
    color: '#C0C0C0',
    minPoints: 500,
    pointsMultiplier: 1.25,
    discountPercent: 5,
    priorityBooking: false,
  },
  {
    name: 'Gold',
    description: 'VIP-Status mit exklusiven Vorteilen',
    icon: '🥇',
    color: '#FFD700',
    minPoints: 1000,
    pointsMultiplier: 1.5,
    discountPercent: 10,
    priorityBooking: true,
  },
  {
    name: 'Platinum',
    description: 'Unser höchster Status mit maximalen Vorteilen',
    icon: '💎',
    color: '#E5E4E2',
    minPoints: 2000,
    pointsMultiplier: 2.0,
    discountPercent: 15,
    priorityBooking: true,
  },
];

// ============================================
// LOYALTY SERVICE
// ============================================

export class LoyaltyService {
  private get supabase() {
    return createServiceRoleClient();
  }

  /**
   * Get customer loyalty status
   */
  async getCustomerLoyalty(customerId: string): Promise<CustomerLoyalty | null> {
    const { data, error } = await this.supabase
      .from('v_customer_loyalty')
      .select('*')
      .eq('customer_id', customerId)
      .single();

    if (error || !data) {
      if (error?.code !== 'PGRST116') {
        logger.error('Failed to fetch customer loyalty', error);
      }
      return null;
    }

    return this.mapCustomerLoyalty(data);
  }

  /**
   * Get loyalty program for a salon
   */
  async getProgram(salonId: string): Promise<LoyaltyProgram | null> {
    const { data: program, error: programError } = await this.supabase
      .from('loyalty_programs')
      .select('*')
      .eq('salon_id', salonId)
      .eq('is_active', true)
      .single();

    if (programError || !program) {
      return null;
    }

    const { data: tiers, error: tiersError } = await this.supabase
      .from('loyalty_tiers')
      .select('*')
      .eq('program_id', program.id)
      .order('min_points', { ascending: true });

    if (tiersError) {
      logger.error('Failed to fetch loyalty tiers', tiersError);
    }

    return {
      id: program.id,
      salonId: program.salon_id,
      name: program.name,
      description: program.description,
      pointsPerChf: program.points_per_chf,
      pointsValueCents: program.points_value_cents,
      minPointsToRedeem: program.min_points_to_redeem,
      birthdayBonusPoints: program.birthday_bonus_points,
      tiers: (tiers || []).map(this.mapTier),
    };
  }

  /**
   * Calculate points that would be earned for a purchase
   */
  async calculatePointsToEarn(
    customerId: string,
    amountCents: number
  ): Promise<{ points: number; multiplier: number; tier: string }> {
    const loyalty = await this.getCustomerLoyalty(customerId);

    if (!loyalty) {
      // Default calculation for non-members
      const points = Math.floor(amountCents / 100);
      return { points, multiplier: 1.0, tier: 'Bronze' };
    }

    const multiplier = loyalty.currentTier?.pointsMultiplier || 1.0;
    const points = Math.floor((amountCents / 100) * multiplier);

    return {
      points,
      multiplier,
      tier: loyalty.currentTier?.name || 'Bronze',
    };
  }

  /**
   * Earn points from a purchase
   */
  async earnPoints(
    customerId: string,
    salonId: string,
    amountCents: number,
    referenceType?: string,
    referenceId?: string,
    description?: string
  ): Promise<number> {
    const { data, error } = await this.supabase.rpc('earn_loyalty_points', {
      p_customer_id: customerId,
      p_salon_id: salonId,
      p_amount_cents: amountCents,
      p_reference_type: referenceType || null,
      p_reference_id: referenceId || null,
      p_description: description || null,
    });

    if (error) {
      logger.error('Failed to earn loyalty points', error, {
        customerId,
        amountCents,
      });
      return 0;
    }

    const pointsEarned = data as number;

    if (pointsEarned > 0) {
      logger.info('Loyalty points earned', {
        customerId,
        points: pointsEarned,
        amountCents,
      });
    }

    return pointsEarned;
  }

  /**
   * Redeem points for a discount
   */
  async redeemPoints(
    customerId: string,
    pointsToRedeem: number,
    referenceType?: string,
    referenceId?: string,
    description?: string
  ): Promise<{ discountCents: number; success: boolean; error?: string }> {
    const { data, error } = await this.supabase.rpc('redeem_loyalty_points', {
      p_customer_id: customerId,
      p_points_to_redeem: pointsToRedeem,
      p_reference_type: referenceType || null,
      p_reference_id: referenceId || null,
      p_description: description || null,
    });

    if (error) {
      logger.error('Failed to redeem loyalty points', error, {
        customerId,
        pointsToRedeem,
      });
      return {
        discountCents: 0,
        success: false,
        error: error.message,
      };
    }

    const discountCents = data as number;

    logger.info('Loyalty points redeemed', {
      customerId,
      points: pointsToRedeem,
      discountCents,
    });

    return {
      discountCents,
      success: true,
    };
  }

  /**
   * Get transaction history for a customer
   */
  async getTransactionHistory(
    customerId: string,
    limit: number = 20
  ): Promise<LoyaltyTransaction[]> {
    const loyalty = await this.getCustomerLoyalty(customerId);
    if (!loyalty) {
      return [];
    }

    const { data, error } = await this.supabase
      .from('loyalty_transactions')
      .select('*')
      .eq('customer_loyalty_id', loyalty.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('Failed to fetch loyalty transactions', error);
      return [];
    }

    return (data || []).map(this.mapTransaction);
  }

  /**
   * Get next tier information
   */
  async getNextTier(customerId: string): Promise<{
    nextTier: LoyaltyTier | null;
    pointsNeeded: number;
    progress: number;
  }> {
    const loyalty = await this.getCustomerLoyalty(customerId);
    if (!loyalty) {
      return { nextTier: null, pointsNeeded: 0, progress: 0 };
    }

    // Get program with tiers
    const program = await this.getProgramByLoyaltyId(loyalty.programId);
    if (!program) {
      return { nextTier: null, pointsNeeded: 0, progress: 0 };
    }

    const currentTierIndex = program.tiers.findIndex(
      (t) => t.id === loyalty.currentTier?.id
    );

    if (currentTierIndex === -1 || currentTierIndex >= program.tiers.length - 1) {
      // Already at highest tier
      return { nextTier: null, pointsNeeded: 0, progress: 100 };
    }

    const nextTier = program.tiers[currentTierIndex + 1];
    const currentTier = program.tiers[currentTierIndex];
    const pointsNeeded = nextTier.minPoints - loyalty.lifetimePoints;
    const tierRange = nextTier.minPoints - currentTier.minPoints;
    const progress = Math.min(
      100,
      ((loyalty.lifetimePoints - currentTier.minPoints) / tierRange) * 100
    );

    return {
      nextTier,
      pointsNeeded: Math.max(0, pointsNeeded),
      progress,
    };
  }

  /**
   * Award birthday bonus
   */
  async awardBirthdayBonus(customerId: string): Promise<number> {
    const { data, error } = await this.supabase.rpc('award_birthday_bonus', {
      p_customer_id: customerId,
    });

    if (error) {
      logger.error('Failed to award birthday bonus', error, { customerId });
      return 0;
    }

    const bonusPoints = data as number;

    if (bonusPoints > 0) {
      logger.info('Birthday bonus awarded', { customerId, points: bonusPoints });
    }

    return bonusPoints;
  }

  /**
   * Get loyalty leaderboard (top customers)
   */
  async getLeaderboard(
    salonId: string,
    limit: number = 10
  ): Promise<
    Array<{
      customerId: string;
      customerName: string;
      lifetimePoints: number;
      tierName: string;
    }>
  > {
    const { data, error } = await this.supabase
      .from('v_customer_loyalty')
      .select('customer_id, customer_name, lifetime_points, tier_name')
      .eq('salon_id', salonId)
      .order('lifetime_points', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('Failed to fetch loyalty leaderboard', error);
      return [];
    }

    return (data || []).map((row) => ({
      customerId: row.customer_id,
      customerName: row.customer_name,
      lifetimePoints: row.lifetime_points,
      tierName: row.tier_name || 'Bronze',
    }));
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private async getProgramByLoyaltyId(programId: string): Promise<LoyaltyProgram | null> {
    const { data: program, error: programError } = await this.supabase
      .from('loyalty_programs')
      .select('*')
      .eq('id', programId)
      .single();

    if (programError || !program) {
      return null;
    }

    const { data: tiers } = await this.supabase
      .from('loyalty_tiers')
      .select('*')
      .eq('program_id', program.id)
      .order('min_points', { ascending: true });

    return {
      id: program.id,
      salonId: program.salon_id,
      name: program.name,
      description: program.description,
      pointsPerChf: program.points_per_chf,
      pointsValueCents: program.points_value_cents,
      minPointsToRedeem: program.min_points_to_redeem,
      birthdayBonusPoints: program.birthday_bonus_points,
      tiers: (tiers || []).map(this.mapTier),
    };
  }

  private mapCustomerLoyalty(data: Record<string, unknown>): CustomerLoyalty {
    return {
      id: data.id as string,
      customerId: data.customer_id as string,
      programId: data.program_id as string,
      pointsBalance: data.points_balance as number,
      lifetimePoints: data.lifetime_points as number,
      currentTier: data.tier_name
        ? {
            id: data.current_tier_id as string,
            name: data.tier_name as string,
            description: null,
            icon: null,
            color: '#CD7F32',
            minPoints: 0,
            pointsMultiplier: (data.points_multiplier as number) || 1.0,
            discountPercent: (data.tier_discount_percent as number) || 0,
            priorityBooking: false,
          }
        : null,
      annualSpendCents: data.annual_spend_cents as number,
      annualVisits: data.annual_visits as number,
      pointsValueChf: (data.points_value_chf as number) || 0,
    };
  }

  private mapTier(data: Record<string, unknown>): LoyaltyTier {
    return {
      id: data.id as string,
      name: data.name as string,
      description: data.description as string | null,
      icon: data.icon as string | null,
      color: (data.color as string) || '#CD7F32',
      minPoints: data.min_points as number,
      pointsMultiplier: (data.points_multiplier as number) || 1.0,
      discountPercent: (data.discount_percent as number) || 0,
      priorityBooking: (data.priority_booking as boolean) || false,
    };
  }

  private mapTransaction(data: Record<string, unknown>): LoyaltyTransaction {
    return {
      id: data.id as string,
      type: data.transaction_type as LoyaltyTransaction['type'],
      points: data.points as number,
      balanceBefore: data.balance_before as number,
      balanceAfter: data.balance_after as number,
      description: data.description as string | null,
      createdAt: new Date(data.created_at as string),
      expiresAt: data.expires_at ? new Date(data.expires_at as string) : null,
      referenceType: data.reference_type as string | null,
      referenceId: data.reference_id as string | null,
    };
  }
}

// ============================================
// SINGLETON
// ============================================

let loyaltyServiceInstance: LoyaltyService | null = null;

export function getLoyaltyService(): LoyaltyService {
  if (!loyaltyServiceInstance) {
    loyaltyServiceInstance = new LoyaltyService();
  }
  return loyaltyServiceInstance;
}
