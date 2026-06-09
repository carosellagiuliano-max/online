'use client';

import { useState } from 'react';
import { ShoppingBag, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCart } from '@/contexts/cart-context';
import { toast } from 'sonner';
import { QuantitySelector } from './quantity-selector';

interface Product {
  id: string;
  name: string;
  description?: string;
  priceCents: number;
  imageUrl?: string | null;
  sku?: string | null;
}

interface Variant {
  id: string;
  name: string;
  sku?: string | null;
  priceCents: number;
  compareAtPriceCents?: number | null;
  stockQuantity?: number | null;
  imageUrl?: string | null;
}

interface ProductActionsProps {
  product: Product;
  variants?: Variant[];
  inStock: boolean;
  stockQuantity?: number | null;
}

export function ProductActions({ product, variants = [], inStock, stockQuantity }: ProductActionsProps) {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    variants.length > 0 ? variants[0].id : null
  );
  const [isAdding, setIsAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  const hasVariants = variants.length > 0;
  const selectedVariant = hasVariants
    ? variants.find((v) => v.id === selectedVariantId) || variants[0]
    : null;

  // Determine effective price and stock based on variant selection
  const effectivePrice = selectedVariant?.priceCents ?? product.priceCents;
  const effectiveStock = selectedVariant?.stockQuantity ?? stockQuantity;
  const effectiveInStock = selectedVariant
    ? (selectedVariant.stockQuantity === null || (selectedVariant.stockQuantity ?? 0) > 0)
    : inStock;
  const effectiveImageUrl = selectedVariant?.imageUrl || product.imageUrl;
  const effectiveSku = selectedVariant?.sku || product.sku;

  const maxQuantity = effectiveStock ?? 99;

  const handleAddToCart = async () => {
    if (!effectiveInStock || isAdding) return;

    setIsAdding(true);

    const displayName = selectedVariant
      ? `${product.name} - ${selectedVariant.name}`
      : product.name;

    try {
      addItem(
        {
          productId: product.id,
          variantId: selectedVariant?.id,
          type: 'product',
          quantity,
        },
        {
          name: displayName,
          description: product.description,
          priceCents: effectivePrice,
          imageUrl: effectiveImageUrl || undefined,
          sku: effectiveSku || undefined,
        }
      );

      setJustAdded(true);
      toast.success(
        quantity > 1
          ? `${quantity}x ${displayName} wurden zum Warenkorb hinzugefügt`
          : `${displayName} wurde zum Warenkorb hinzugefügt`
      );

      setTimeout(() => {
        setJustAdded(false);
        setQuantity(1);
      }, 2000);
    } catch (error) {
      console.error('Error adding to cart:', error);
      toast.error('Fehler beim Hinzufügen zum Warenkorb');
    } finally {
      setIsAdding(false);
    }
  };

  // Format price helper
  const formatPrice = (cents: number) => `CHF ${(cents / 100).toFixed(2)}`;

  return (
    <div className="space-y-4">
      {/* Variant Selector */}
      {hasVariants && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Variante</Label>
          <Select
            value={selectedVariantId || ''}
            onValueChange={(value) => setSelectedVariantId(value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Variante wählen" />
            </SelectTrigger>
            <SelectContent>
              {variants.map((variant) => {
                const variantInStock = variant.stockQuantity === null || (variant.stockQuantity ?? 0) > 0;
                return (
                  <SelectItem
                    key={variant.id}
                    value={variant.id}
                    disabled={!variantInStock}
                  >
                    <span className="flex items-center gap-2">
                      <span>{variant.name}</span>
                      <span className="text-muted-foreground">
                        {formatPrice(variant.priceCents)}
                      </span>
                      {!variantInStock && (
                        <span className="text-destructive text-xs">(Ausverkauft)</span>
                      )}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Quantity Selector */}
      <div className="flex items-center gap-4">
        <Label className="text-sm font-medium">Menge</Label>
        <QuantitySelector
          quantity={quantity}
          onChange={setQuantity}
          max={maxQuantity > 0 ? maxQuantity : 99}
          disabled={!effectiveInStock || isAdding}
        />
      </div>

      {/* Add to Cart Button */}
      <Button
        onClick={handleAddToCart}
        disabled={!effectiveInStock || isAdding}
        size="lg"
        variant={justAdded ? 'secondary' : 'default'}
        className="w-full md:w-auto md:min-w-[200px]"
      >
        {isAdding ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Wird hinzugefügt...
          </>
        ) : justAdded ? (
          <>
            <Check className="h-4 w-4 mr-2" />
            Hinzugefügt
          </>
        ) : (
          <>
            <ShoppingBag className="h-4 w-4 mr-2" />
            In den Warenkorb
          </>
        )}
      </Button>
    </div>
  );
}
