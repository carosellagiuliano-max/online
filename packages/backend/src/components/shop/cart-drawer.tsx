'use client';

import Link from 'next/link';
import { ShoppingBag, X, ArrowRight, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useCart } from '@/contexts/cart-context';
import { CartItem } from './cart-item';
import { CartSummary } from './cart-summary';

// ============================================
// CART DRAWER COMPONENT
// ============================================

export function CartDrawer() {
  const {
    cart,
    isOpen,
    closeCart,
    isEmpty,
    itemCount,
    clear,
    formatPrice,
  } = useCart();

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && closeCart()}>
      <SheetContent className="flex w-full flex-col sm:max-w-lg px-6">
        <SheetHeader className="space-y-2.5">
          <SheetTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            Warenkorb
            {itemCount > 0 && (
              <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                {itemCount}
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        {isEmpty ? (
          // Empty State
          <div className="flex flex-1 flex-col items-center justify-center space-y-4 py-12 px-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
              <ShoppingBag className="h-10 w-10 text-muted-foreground" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold">Ihr Warenkorb ist leer</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Entdecken Sie unsere Produkte und Gutscheine.
              </p>
            </div>
            <Button onClick={closeCart} asChild>
              <Link href="/shop">
                Zum Shop
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        ) : (
          <>
            {/* Cart Items */}
            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-0 py-2">
                {cart.items.map((item) => (
                  <CartItem key={item.id} item={item} />
                ))}
              </div>
            </ScrollArea>

            {/* Clear Cart Button */}
            <div className="pt-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
                onClick={clear}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Warenkorb leeren
              </Button>
            </div>

            <Separator />

            {/* Summary */}
            <CartSummary compact />

            {/* Footer */}
            <SheetFooter className="flex-col gap-2 sm:flex-col pt-2">
              <Button asChild size="lg" className="w-full">
                <Link href="/checkout" onClick={closeCart}>
                  Zur Kasse
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="w-full"
                onClick={closeCart}
              >
                Weiter einkaufen
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ============================================
// CART BUTTON (for header)
// ============================================

export function CartButton() {
  const { openCart, itemCount } = useCart();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative"
      onClick={openCart}
      aria-label="Warenkorb öffnen"
    >
      <ShoppingBag className="h-5 w-5" />
      {itemCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
          {itemCount > 9 ? '9+' : itemCount}
        </span>
      )}
    </Button>
  );
}
