'use client';

import { Minus, Plus, Trash2, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/contexts/cart-context';
import type { CartItem as CartItemType } from '@/lib/domain/cart/types';

// ============================================
// CART ITEM COMPONENT
// ============================================

interface CartItemProps {
  item: CartItemType;
  compact?: boolean;
}

export function CartItem({ item, compact = false }: CartItemProps) {
  const { updateItem, removeItem, formatPrice } = useCart();

  const handleIncrement = () => {
    updateItem(item.id, item.quantity + 1);
  };

  const handleDecrement = () => {
    if (item.quantity > 1) {
      updateItem(item.id, item.quantity - 1);
    }
  };

  const handleRemove = () => {
    removeItem(item.id);
  };

  if (compact) {
    return (
      <div className="flex items-center gap-3 py-2">
        {/* Image */}
        <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-md bg-muted">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.name}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : item.type === 'voucher' ? (
            <div className="flex h-full w-full items-center justify-center bg-primary/10">
              <Gift className="h-5 w-5 text-primary" />
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <span className="text-xs text-muted-foreground">Bild</span>
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{item.name}</p>
          <p className="text-xs text-muted-foreground">
            {item.quantity} x {formatPrice(item.unitPriceCents)}
          </p>
        </div>

        {/* Price */}
        <p className="text-sm font-medium">{formatPrice(item.totalPriceCents)}</p>
      </div>
    );
  }

  return (
    <div className="flex gap-4 py-4 border-b border-border last:border-0">
      {/* Image */}
      <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : item.type === 'voucher' ? (
          <div className="flex h-full w-full items-center justify-center bg-primary/10">
            <Gift className="h-8 w-8 text-primary" />
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="text-sm text-muted-foreground">Bild</span>
          </div>
        )}
      </div>

      {/* Details */}
      <div className="flex flex-1 flex-col">
        <div className="flex justify-between">
          <div>
            <h4 className="font-medium">{item.name}</h4>
            {item.variant && (
              <p className="text-sm text-muted-foreground">{item.variant}</p>
            )}
            {item.type === 'voucher' && item.recipientEmail && (
              <p className="text-xs text-muted-foreground mt-1">
                Für: {item.recipientName || item.recipientEmail}
              </p>
            )}
          </div>
          <p className="font-semibold">{formatPrice(item.totalPriceCents)}</p>
        </div>

        {/* Quantity Controls */}
        <div className="flex items-center justify-between mt-auto pt-2">
          {item.type === 'voucher' ? (
            // Vouchers can't have quantity changed
            <p className="text-sm text-muted-foreground">
              Wert: {formatPrice(item.unitPriceCents)}
            </p>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={handleDecrement}
                disabled={item.quantity <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-8 text-center text-sm font-medium">
                {item.quantity}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={handleIncrement}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={handleRemove}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Entfernen
          </Button>
        </div>
      </div>
    </div>
  );
}
