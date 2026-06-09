'use client';

/**
 * BeautifyPRO - Loyalty Card Component
 * Displays customer loyalty status, points, and tier progress
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Gift, TrendingUp, Star, Crown } from 'lucide-react';
import { getLoyaltyService, type CustomerLoyalty, type LoyaltyTier } from '@/lib/services/loyalty-service';
import { formatChf } from '@/lib/utils';

interface LoyaltyCardProps {
  customerId: string;
  onRedeemClick?: () => void;
}

const TIER_ICONS: Record<string, React.ReactNode> = {
  Bronze: <Star className="h-5 w-5" />,
  Silver: <Star className="h-5 w-5" />,
  Gold: <Crown className="h-5 w-5" />,
  Platinum: <Crown className="h-5 w-5" />,
};

const TIER_COLORS: Record<string, string> = {
  Bronze: 'bg-amber-700 text-white',
  Silver: 'bg-gray-400 text-white',
  Gold: 'bg-yellow-500 text-black',
  Platinum: 'bg-gray-200 text-gray-800',
};

export function LoyaltyCard({ customerId, onRedeemClick }: LoyaltyCardProps) {
  const [loyalty, setLoyalty] = useState<CustomerLoyalty | null>(null);
  const [nextTier, setNextTier] = useState<{
    nextTier: LoyaltyTier | null;
    pointsNeeded: number;
    progress: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLoyalty() {
      setLoading(true);
      try {
        const service = getLoyaltyService();
        const [loyaltyData, nextTierData] = await Promise.all([
          service.getCustomerLoyalty(customerId),
          service.getNextTier(customerId),
        ]);
        setLoyalty(loyaltyData);
        setNextTier(nextTierData);
      } catch (error) {
        console.error('Failed to fetch loyalty data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchLoyalty();
  }, [customerId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-10 w-24" />
        </CardContent>
      </Card>
    );
  }

  if (!loyalty) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5" />
            Treueprogramm
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Werden Sie Mitglied in unserem Treueprogramm und sammeln Sie Punkte bei jedem Besuch!
          </p>
        </CardContent>
      </Card>
    );
  }

  const tierName = loyalty.currentTier?.name || 'Bronze';
  const tierColor = TIER_COLORS[tierName] || TIER_COLORS.Bronze;
  const tierIcon = TIER_ICONS[tierName] || TIER_ICONS.Bronze;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5" />
            Treueprogramm
          </CardTitle>
          <Badge className={tierColor}>
            {tierIcon}
            <span className="ml-1">{tierName}</span>
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Points Balance */}
        <div className="text-center">
          <div className="text-4xl font-bold text-primary">
            {loyalty.pointsBalance.toLocaleString('de-CH')}
          </div>
          <div className="text-sm text-muted-foreground">
            Punkte (Wert: {formatChf(loyalty.pointsValueChf * 100)})
          </div>
        </div>

        {/* Tier Benefits */}
        {loyalty.currentTier && (
          <div className="bg-muted/50 rounded-lg p-3 space-y-1">
            <div className="text-sm font-medium">Ihre Vorteile:</div>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li className="flex items-center gap-2">
                <TrendingUp className="h-3 w-3" />
                {loyalty.currentTier.pointsMultiplier}x Punkte pro CHF
              </li>
              {loyalty.currentTier.discountPercent > 0 && (
                <li className="flex items-center gap-2">
                  <Gift className="h-3 w-3" />
                  {loyalty.currentTier.discountPercent}% Rabatt auf Termine
                </li>
              )}
              {loyalty.currentTier.priorityBooking && (
                <li className="flex items-center gap-2">
                  <Crown className="h-3 w-3" />
                  Priority Booking
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Progress to Next Tier */}
        {nextTier && nextTier.nextTier && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Fortschritt zu {nextTier.nextTier.name}</span>
              <span className="text-muted-foreground">
                Noch {nextTier.pointsNeeded.toLocaleString('de-CH')} Punkte
              </span>
            </div>
            <Progress value={nextTier.progress} className="h-2" />
          </div>
        )}

        {/* Redeem Button */}
        {loyalty.pointsBalance >= 100 && onRedeemClick && (
          <Button onClick={onRedeemClick} className="w-full">
            <Gift className="h-4 w-4 mr-2" />
            Punkte einlösen
          </Button>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 text-center text-sm">
          <div>
            <div className="font-medium">{loyalty.lifetimePoints.toLocaleString('de-CH')}</div>
            <div className="text-muted-foreground">Punkte total</div>
          </div>
          <div>
            <div className="font-medium">{loyalty.annualVisits}</div>
            <div className="text-muted-foreground">Besuche dieses Jahr</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default LoyaltyCard;
