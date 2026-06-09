'use client';

/**
 * BeautifyPRO - Loyalty Redemption Component
 * Allows customers to redeem points during checkout
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Gift, Coins, AlertCircle, Check } from 'lucide-react';
import { getLoyaltyService, type CustomerLoyalty } from '@/lib/services/loyalty-service';
import { formatChf } from '@/lib/utils';

interface LoyaltyRedemptionProps {
  customerId: string;
  maxDiscountCents: number; // Maximum discount allowed (e.g., order total)
  minPointsToRedeem?: number;
  onRedeem: (pointsToRedeem: number, discountCents: number) => void;
  onCancel: () => void;
}

export function LoyaltyRedemption({
  customerId,
  maxDiscountCents,
  minPointsToRedeem = 100,
  onRedeem,
  onCancel,
}: LoyaltyRedemptionProps) {
  const [loyalty, setLoyalty] = useState<CustomerLoyalty | null>(null);
  const [loading, setLoading] = useState(true);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const [pointsValueCents, setPointsValueCents] = useState(1); // Default 1 point = 1 cent

  useEffect(() => {
    async function fetchLoyalty() {
      setLoading(true);
      try {
        const service = getLoyaltyService();
        const data = await service.getCustomerLoyalty(customerId);
        setLoyalty(data);

        // Get program details for points value
        if (data) {
          // Default to min points if available
          const defaultPoints = Math.min(
            data.pointsBalance,
            Math.floor(maxDiscountCents / pointsValueCents)
          );
          setPointsToRedeem(Math.max(minPointsToRedeem, defaultPoints));
        }
      } catch (error) {
        console.error('Failed to fetch loyalty:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchLoyalty();
  }, [customerId, maxDiscountCents, minPointsToRedeem, pointsValueCents]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 rounded w-1/3" />
            <div className="h-10 bg-gray-200 rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!loyalty || loyalty.pointsBalance < minPointsToRedeem) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-6 text-center">
          <Coins className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">
            {!loyalty
              ? 'Sie sind noch nicht im Treueprogramm registriert.'
              : `Sie benötigen mindestens ${minPointsToRedeem} Punkte zum Einlösen.`}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Aktuell: {loyalty?.pointsBalance || 0} Punkte
          </p>
          <Button variant="outline" onClick={onCancel} className="mt-4">
            Schliessen
          </Button>
        </CardContent>
      </Card>
    );
  }

  const maxRedeemablePoints = Math.min(
    loyalty.pointsBalance,
    Math.floor(maxDiscountCents / pointsValueCents)
  );

  const discountCents = pointsToRedeem * pointsValueCents;
  const discountChf = discountCents / 100;

  const handleSliderChange = (value: number[]) => {
    setPointsToRedeem(value[0]);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10) || 0;
    const clamped = Math.min(Math.max(value, minPointsToRedeem), maxRedeemablePoints);
    setPointsToRedeem(clamped);
  };

  const handleConfirm = () => {
    onRedeem(pointsToRedeem, discountCents);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="h-5 w-5" />
          Treuepunkte einlösen
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Available Points */}
        <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
          <span className="text-sm">Verfügbare Punkte:</span>
          <Badge variant="secondary" className="text-lg">
            {loyalty.pointsBalance.toLocaleString('de-CH')}
          </Badge>
        </div>

        {/* Points Slider */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <Label>Punkte einlösen:</Label>
            <Input
              type="number"
              value={pointsToRedeem}
              onChange={handleInputChange}
              min={minPointsToRedeem}
              max={maxRedeemablePoints}
              className="w-24 text-right"
            />
          </div>

          <Slider
            value={[pointsToRedeem]}
            onValueChange={handleSliderChange}
            min={minPointsToRedeem}
            max={maxRedeemablePoints}
            step={10}
            className="py-4"
          />

          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Min: {minPointsToRedeem}</span>
            <span>Max: {maxRedeemablePoints.toLocaleString('de-CH')}</span>
          </div>
        </div>

        {/* Discount Preview */}
        <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              <span className="font-medium">Ihr Rabatt:</span>
            </div>
            <span className="text-2xl font-bold text-green-600">
              {formatChf(discountCents)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {pointsToRedeem} Punkte = CHF {discountChf.toFixed(2)} Rabatt
          </p>
        </div>

        {/* Remaining Points */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4" />
          <span>
            Nach Einlösung verbleiben {(loyalty.pointsBalance - pointsToRedeem).toLocaleString('de-CH')} Punkte
          </span>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Abbrechen
          </Button>
          <Button onClick={handleConfirm} className="flex-1">
            <Gift className="h-4 w-4 mr-2" />
            Einlösen
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default LoyaltyRedemption;
