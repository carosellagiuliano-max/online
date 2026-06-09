/**
 * ============================================
 * BeautifyPRO - Loyalty Service Tests
 * Unit tests for loyalty program logic
 * ============================================
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TIERS,
  type LoyaltyTier,
  type LoyaltyTierName,
} from '@/lib/services/loyalty-service';

// ============================================
// TEST FIXTURES
// ============================================

const mockTiers: LoyaltyTier[] = DEFAULT_TIERS.map((tier, index) => ({
  ...tier,
  id: `tier-${index + 1}`,
}));

// Pure function implementations for testing (mirroring service logic)
function calculateTierFromPoints(lifetimePoints: number, tiers: LoyaltyTier[]): LoyaltyTier {
  const sortedTiers = [...tiers].sort((a, b) => b.minPoints - a.minPoints);
  return sortedTiers.find((tier) => lifetimePoints >= tier.minPoints) || tiers[0];
}

function calculatePointsToEarn(amountCents: number, multiplier: number): number {
  return Math.floor((amountCents / 100) * multiplier);
}

function calculatePointsValue(points: number, pointsValueCents: number): number {
  return points * pointsValueCents;
}

function calculateProgressToNextTier(
  lifetimePoints: number,
  currentTier: LoyaltyTier,
  nextTier: LoyaltyTier | null
): number {
  if (!nextTier) return 100;

  const tierRange = nextTier.minPoints - currentTier.minPoints;
  if (tierRange <= 0) return 100;

  const progress = ((lifetimePoints - currentTier.minPoints) / tierRange) * 100;
  return Math.min(100, Math.max(0, progress));
}

function getNextTier(currentTier: LoyaltyTier, tiers: LoyaltyTier[]): LoyaltyTier | null {
  const sortedTiers = [...tiers].sort((a, b) => a.minPoints - b.minPoints);
  const currentIndex = sortedTiers.findIndex((t) => t.id === currentTier.id);
  if (currentIndex === -1 || currentIndex >= sortedTiers.length - 1) return null;
  return sortedTiers[currentIndex + 1];
}

// ============================================
// UNIT TESTS
// ============================================

describe('Loyalty Service', () => {
  describe('DEFAULT_TIERS', () => {
    it('should have 4 tiers', () => {
      expect(DEFAULT_TIERS).toHaveLength(4);
    });

    it('should have Bronze as lowest tier', () => {
      const bronze = DEFAULT_TIERS.find((t) => t.name === 'Bronze');
      expect(bronze).toBeDefined();
      expect(bronze?.minPoints).toBe(0);
    });

    it('should have Platinum as highest tier', () => {
      const platinum = DEFAULT_TIERS.find((t) => t.name === 'Platinum');
      expect(platinum).toBeDefined();
      expect(platinum?.minPoints).toBe(2000);
    });

    it('should have increasing point thresholds', () => {
      const sortedTiers = [...DEFAULT_TIERS].sort((a, b) => a.minPoints - b.minPoints);
      for (let i = 1; i < sortedTiers.length; i++) {
        expect(sortedTiers[i].minPoints).toBeGreaterThan(sortedTiers[i - 1].minPoints);
      }
    });

    it('should have increasing multipliers', () => {
      const sortedTiers = [...DEFAULT_TIERS].sort((a, b) => a.minPoints - b.minPoints);
      for (let i = 1; i < sortedTiers.length; i++) {
        expect(sortedTiers[i].pointsMultiplier).toBeGreaterThanOrEqual(
          sortedTiers[i - 1].pointsMultiplier
        );
      }
    });

    it('should have increasing discounts', () => {
      const sortedTiers = [...DEFAULT_TIERS].sort((a, b) => a.minPoints - b.minPoints);
      for (let i = 1; i < sortedTiers.length; i++) {
        expect(sortedTiers[i].discountPercent).toBeGreaterThanOrEqual(
          sortedTiers[i - 1].discountPercent
        );
      }
    });
  });

  describe('Tier Configuration', () => {
    it('Bronze: 1x multiplier, 0% discount, no priority', () => {
      const bronze = DEFAULT_TIERS.find((t) => t.name === 'Bronze');
      expect(bronze?.pointsMultiplier).toBe(1.0);
      expect(bronze?.discountPercent).toBe(0);
      expect(bronze?.priorityBooking).toBe(false);
    });

    it('Silver: 1.25x multiplier, 5% discount, no priority', () => {
      const silver = DEFAULT_TIERS.find((t) => t.name === 'Silver');
      expect(silver?.pointsMultiplier).toBe(1.25);
      expect(silver?.discountPercent).toBe(5);
      expect(silver?.priorityBooking).toBe(false);
    });

    it('Gold: 1.5x multiplier, 10% discount, priority booking', () => {
      const gold = DEFAULT_TIERS.find((t) => t.name === 'Gold');
      expect(gold?.pointsMultiplier).toBe(1.5);
      expect(gold?.discountPercent).toBe(10);
      expect(gold?.priorityBooking).toBe(true);
    });

    it('Platinum: 2x multiplier, 15% discount, priority booking', () => {
      const platinum = DEFAULT_TIERS.find((t) => t.name === 'Platinum');
      expect(platinum?.pointsMultiplier).toBe(2.0);
      expect(platinum?.discountPercent).toBe(15);
      expect(platinum?.priorityBooking).toBe(true);
    });
  });

  describe('calculateTierFromPoints', () => {
    it('should return Bronze for 0 points', () => {
      const tier = calculateTierFromPoints(0, mockTiers);
      expect(tier.name).toBe('Bronze');
    });

    it('should return Bronze for 499 points', () => {
      const tier = calculateTierFromPoints(499, mockTiers);
      expect(tier.name).toBe('Bronze');
    });

    it('should return Silver for 500 points', () => {
      const tier = calculateTierFromPoints(500, mockTiers);
      expect(tier.name).toBe('Silver');
    });

    it('should return Silver for 999 points', () => {
      const tier = calculateTierFromPoints(999, mockTiers);
      expect(tier.name).toBe('Silver');
    });

    it('should return Gold for 1000 points', () => {
      const tier = calculateTierFromPoints(1000, mockTiers);
      expect(tier.name).toBe('Gold');
    });

    it('should return Gold for 1999 points', () => {
      const tier = calculateTierFromPoints(1999, mockTiers);
      expect(tier.name).toBe('Gold');
    });

    it('should return Platinum for 2000 points', () => {
      const tier = calculateTierFromPoints(2000, mockTiers);
      expect(tier.name).toBe('Platinum');
    });

    it('should return Platinum for very high points', () => {
      const tier = calculateTierFromPoints(10000, mockTiers);
      expect(tier.name).toBe('Platinum');
    });
  });

  describe('calculatePointsToEarn', () => {
    it('should calculate 1 point per CHF for Bronze (1x)', () => {
      const points = calculatePointsToEarn(10000, 1.0); // CHF 100
      expect(points).toBe(100);
    });

    it('should calculate 1.25 points per CHF for Silver', () => {
      const points = calculatePointsToEarn(10000, 1.25); // CHF 100
      expect(points).toBe(125);
    });

    it('should calculate 1.5 points per CHF for Gold', () => {
      const points = calculatePointsToEarn(10000, 1.5); // CHF 100
      expect(points).toBe(150);
    });

    it('should calculate 2 points per CHF for Platinum', () => {
      const points = calculatePointsToEarn(10000, 2.0); // CHF 100
      expect(points).toBe(200);
    });

    it('should floor decimal points', () => {
      const points = calculatePointsToEarn(5050, 1.0); // CHF 50.50
      expect(points).toBe(50); // Not 50.5
    });

    it('should handle small amounts', () => {
      const points = calculatePointsToEarn(50, 1.0); // CHF 0.50
      expect(points).toBe(0); // Less than 1 point
    });

    it('should calculate correctly for partial CHF', () => {
      const points = calculatePointsToEarn(2550, 1.5); // CHF 25.50
      // 25.50 * 1.5 = 38.25 -> floor -> 38
      expect(points).toBe(38);
    });
  });

  describe('calculatePointsValue', () => {
    it('should calculate value for 100 points at 1 cent each', () => {
      const value = calculatePointsValue(100, 1);
      expect(value).toBe(100); // 100 cents = CHF 1
    });

    it('should calculate value for 100 points at 2 cents each', () => {
      const value = calculatePointsValue(100, 2);
      expect(value).toBe(200); // 200 cents = CHF 2
    });

    it('should handle zero points', () => {
      const value = calculatePointsValue(0, 1);
      expect(value).toBe(0);
    });
  });

  describe('getNextTier', () => {
    it('should return Silver for Bronze', () => {
      const bronze = mockTiers.find((t) => t.name === 'Bronze')!;
      const next = getNextTier(bronze, mockTiers);
      expect(next?.name).toBe('Silver');
    });

    it('should return Gold for Silver', () => {
      const silver = mockTiers.find((t) => t.name === 'Silver')!;
      const next = getNextTier(silver, mockTiers);
      expect(next?.name).toBe('Gold');
    });

    it('should return Platinum for Gold', () => {
      const gold = mockTiers.find((t) => t.name === 'Gold')!;
      const next = getNextTier(gold, mockTiers);
      expect(next?.name).toBe('Platinum');
    });

    it('should return null for Platinum (highest tier)', () => {
      const platinum = mockTiers.find((t) => t.name === 'Platinum')!;
      const next = getNextTier(platinum, mockTiers);
      expect(next).toBeNull();
    });
  });

  describe('calculateProgressToNextTier', () => {
    it('should return 0% at tier start', () => {
      const bronze = mockTiers.find((t) => t.name === 'Bronze')!;
      const silver = mockTiers.find((t) => t.name === 'Silver')!;

      const progress = calculateProgressToNextTier(0, bronze, silver);
      expect(progress).toBe(0);
    });

    it('should return 50% at halfway point', () => {
      const bronze = mockTiers.find((t) => t.name === 'Bronze')!;
      const silver = mockTiers.find((t) => t.name === 'Silver')!;

      // Bronze: 0, Silver: 500, halfway = 250
      const progress = calculateProgressToNextTier(250, bronze, silver);
      expect(progress).toBe(50);
    });

    it('should return 100% at next tier threshold', () => {
      const bronze = mockTiers.find((t) => t.name === 'Bronze')!;
      const silver = mockTiers.find((t) => t.name === 'Silver')!;

      const progress = calculateProgressToNextTier(500, bronze, silver);
      expect(progress).toBe(100);
    });

    it('should cap at 100% even if over', () => {
      const bronze = mockTiers.find((t) => t.name === 'Bronze')!;
      const silver = mockTiers.find((t) => t.name === 'Silver')!;

      const progress = calculateProgressToNextTier(600, bronze, silver);
      expect(progress).toBe(100);
    });

    it('should return 100% if at highest tier', () => {
      const platinum = mockTiers.find((t) => t.name === 'Platinum')!;

      const progress = calculateProgressToNextTier(3000, platinum, null);
      expect(progress).toBe(100);
    });

    it('should calculate correctly for Gold → Platinum', () => {
      const gold = mockTiers.find((t) => t.name === 'Gold')!;
      const platinum = mockTiers.find((t) => t.name === 'Platinum')!;

      // Gold: 1000, Platinum: 2000, midpoint = 1500
      const progress = calculateProgressToNextTier(1500, gold, platinum);
      expect(progress).toBe(50);
    });
  });

  describe('Points Earning Scenarios', () => {
    it('Scenario: New customer, CHF 85 haircut', () => {
      const amountCents = 8500;
      const bronzeMultiplier = 1.0;

      const points = calculatePointsToEarn(amountCents, bronzeMultiplier);
      expect(points).toBe(85);
    });

    it('Scenario: Silver customer, CHF 120 treatment', () => {
      const amountCents = 12000;
      const silverMultiplier = 1.25;

      const points = calculatePointsToEarn(amountCents, silverMultiplier);
      expect(points).toBe(150);
    });

    it('Scenario: Gold customer, CHF 200 package', () => {
      const amountCents = 20000;
      const goldMultiplier = 1.5;

      const points = calculatePointsToEarn(amountCents, goldMultiplier);
      expect(points).toBe(300);
    });

    it('Scenario: Platinum customer, CHF 350 full service', () => {
      const amountCents = 35000;
      const platinumMultiplier = 2.0;

      const points = calculatePointsToEarn(amountCents, platinumMultiplier);
      expect(points).toBe(700);
    });
  });

  describe('Discount Application Scenarios', () => {
    it('Bronze gets no discount', () => {
      const bronze = DEFAULT_TIERS.find((t) => t.name === 'Bronze')!;
      const originalPrice = 10000; // CHF 100
      const discount = (originalPrice * bronze.discountPercent) / 100;

      expect(discount).toBe(0);
    });

    it('Silver gets 5% discount', () => {
      const silver = DEFAULT_TIERS.find((t) => t.name === 'Silver')!;
      const originalPrice = 10000; // CHF 100
      const discount = (originalPrice * silver.discountPercent) / 100;

      expect(discount).toBe(500); // CHF 5
    });

    it('Gold gets 10% discount', () => {
      const gold = DEFAULT_TIERS.find((t) => t.name === 'Gold')!;
      const originalPrice = 10000; // CHF 100
      const discount = (originalPrice * gold.discountPercent) / 100;

      expect(discount).toBe(1000); // CHF 10
    });

    it('Platinum gets 15% discount', () => {
      const platinum = DEFAULT_TIERS.find((t) => t.name === 'Platinum')!;
      const originalPrice = 10000; // CHF 100
      const discount = (originalPrice * platinum.discountPercent) / 100;

      expect(discount).toBe(1500); // CHF 15
    });
  });

  describe('Edge Cases', () => {
    it('should handle exactly at tier boundary (500 points)', () => {
      const tier = calculateTierFromPoints(500, mockTiers);
      expect(tier.name).toBe('Silver');
    });

    it('should handle one point below boundary (499 points)', () => {
      const tier = calculateTierFromPoints(499, mockTiers);
      expect(tier.name).toBe('Bronze');
    });

    it('should handle negative points gracefully', () => {
      const tier = calculateTierFromPoints(-100, mockTiers);
      expect(tier.name).toBe('Bronze'); // Default to lowest tier
    });

    it('should handle empty tiers array', () => {
      const tier = calculateTierFromPoints(100, []);
      expect(tier).toBeUndefined();
    });

    it('should calculate 0 points for 0 amount', () => {
      const points = calculatePointsToEarn(0, 1.0);
      expect(points).toBe(0);
    });
  });

  describe('Tier Upgrade Path', () => {
    it('should track points needed for next tier from Bronze', () => {
      const lifetimePoints = 200;
      const bronze = mockTiers.find((t) => t.name === 'Bronze')!;
      const silver = mockTiers.find((t) => t.name === 'Silver')!;

      const pointsNeeded = silver.minPoints - lifetimePoints;
      expect(pointsNeeded).toBe(300);
    });

    it('should track points needed for Platinum from Gold', () => {
      const lifetimePoints = 1500;
      const gold = mockTiers.find((t) => t.name === 'Gold')!;
      const platinum = mockTiers.find((t) => t.name === 'Platinum')!;

      const pointsNeeded = platinum.minPoints - lifetimePoints;
      expect(pointsNeeded).toBe(500);
    });
  });
});
