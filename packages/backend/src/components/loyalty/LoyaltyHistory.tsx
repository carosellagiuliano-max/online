'use client';

/**
 * BeautifyPRO - Loyalty Transaction History
 * Displays customer's points history
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { History, Plus, Minus, Gift, Calendar, Star, AlertTriangle } from 'lucide-react';
import { getLoyaltyService, type LoyaltyTransaction } from '@/lib/services/loyalty-service';

interface LoyaltyHistoryProps {
  customerId: string;
  limit?: number;
}

const TRANSACTION_ICONS: Record<string, React.ReactNode> = {
  earn_purchase: <Plus className="h-4 w-4 text-green-600" />,
  earn_bonus: <Star className="h-4 w-4 text-yellow-600" />,
  earn_birthday: <Gift className="h-4 w-4 text-pink-600" />,
  redeem: <Minus className="h-4 w-4 text-red-600" />,
  adjustment: <AlertTriangle className="h-4 w-4 text-orange-600" />,
  expire: <AlertTriangle className="h-4 w-4 text-gray-600" />,
};

const TRANSACTION_LABELS: Record<string, string> = {
  earn_purchase: 'Einkauf',
  earn_bonus: 'Bonus',
  earn_birthday: 'Geburtstag',
  redeem: 'Eingelöst',
  adjustment: 'Korrektur',
  expire: 'Verfallen',
};

export function LoyaltyHistory({ customerId, limit = 20 }: LoyaltyHistoryProps) {
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHistory() {
      setLoading(true);
      try {
        const service = getLoyaltyService();
        const data = await service.getTransactionHistory(customerId, limit);
        setTransactions(data);
      } catch (error) {
        console.error('Failed to fetch loyalty history:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchHistory();
  }, [customerId, limit]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (transactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Punktehistorie
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">
            Noch keine Transaktionen vorhanden.
          </p>
        </CardContent>
      </Card>
    );
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('de-CH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('de-CH', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Punktehistorie
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-4">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
              >
                {/* Icon */}
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  {TRANSACTION_ICONS[tx.type] || <History className="h-4 w-4" />}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={tx.points > 0 ? 'default' : 'destructive'}
                      className="shrink-0"
                    >
                      {tx.points > 0 ? '+' : ''}
                      {tx.points.toLocaleString('de-CH')} Punkte
                    </Badge>
                    <span className="text-sm text-muted-foreground truncate">
                      {TRANSACTION_LABELS[tx.type] || tx.type}
                    </span>
                  </div>
                  {tx.description && (
                    <p className="text-sm text-muted-foreground mt-1 truncate">
                      {tx.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {formatDate(tx.createdAt)} um {formatTime(tx.createdAt)}
                  </div>
                  {tx.expiresAt && tx.points > 0 && (
                    <div className="text-xs text-orange-600 mt-1">
                      Gültig bis {formatDate(tx.expiresAt)}
                    </div>
                  )}
                </div>

                {/* Balance */}
                <div className="text-right text-sm shrink-0">
                  <div className="text-muted-foreground">
                    {tx.balanceBefore.toLocaleString('de-CH')}
                  </div>
                  <div className="font-medium">
                    {tx.balanceAfter.toLocaleString('de-CH')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export default LoyaltyHistory;
