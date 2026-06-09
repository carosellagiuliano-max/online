import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle2, Package, ArrowRight, Mail } from 'lucide-react';

// Force dynamic rendering (API not available at build time)
export const dynamic = 'force-dynamic';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { getOrder } from '@/lib/actions/orders';
import { getCheckoutSession } from '@/lib/payments';
import { formatPrice } from '@/lib/domain/order/order';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Bestellung erfolgreich',
  description: 'Ihre Bestellung wurde erfolgreich aufgegeben.',
  robots: { index: false, follow: false },
};

// ============================================
// PAGE
// ============================================

interface PageProps {
  searchParams: Promise<{ session_id?: string }>;
}

export default async function CheckoutSuccessPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const sessionId = params.session_id;

  // Try to get order details from Stripe session
  let order = null;
  let orderNumber = '';

  if (sessionId) {
    const { data: session } = await getCheckoutSession(sessionId);
    if (session?.metadata?.order_id) {
      const { data: orderData } = await getOrder(session.metadata.order_id);
      order = orderData;
      orderNumber = order?.orderNumber || '';
    }
  }

  return (
    <div className="container max-w-2xl py-12 md:py-20">
      {/* Success Icon */}
      <div className="flex justify-center mb-8">
        <div className="relative">
          <div className="absolute inset-0 bg-green-500/20 rounded-full blur-2xl" />
          <div className="relative h-24 w-24 rounded-full bg-green-500/10 flex items-center justify-center">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
          </div>
        </div>
      </div>

      {/* Title */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-3">Vielen Dank für Ihre Bestellung!</h1>
        <p className="text-muted-foreground text-lg">
          Ihre Bestellung wurde erfolgreich aufgenommen.
        </p>
      </div>

      {/* Order Details Card */}
      <Card className="mb-8">
        <CardContent className="p-6">
          {order ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-muted-foreground">Bestellnummer</p>
                  <p className="text-xl font-semibold font-mono">{order.orderNumber}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Package className="h-6 w-6 text-primary" />
                </div>
              </div>

              <Separator className="my-4" />

              {/* Order Items */}
              <div className="space-y-3 mb-4">
                {order.items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span>
                      {item.quantity}x {item.itemName}
                    </span>
                    <span className="font-medium">{formatPrice(item.totalCents)}</span>
                  </div>
                ))}
              </div>

              <Separator className="my-4" />

              {/* Totals */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Zwischensumme</span>
                  <span>{formatPrice(order.subtotalCents)}</span>
                </div>
                {order.shippingCents > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Versand</span>
                    <span>{formatPrice(order.shippingCents)}</span>
                  </div>
                )}
                {order.voucherDiscountCents > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Gutschein</span>
                    <span>-{formatPrice(order.voucherDiscountCents)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-lg pt-2 border-t">
                  <span>Gesamtbetrag</span>
                  <span>{formatPrice(order.totalCents)}</span>
                </div>
                <p className="text-xs text-muted-foreground text-right">
                  inkl. {formatPrice(order.taxCents)} MwSt.
                </p>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-muted-foreground">
                Bestelldetails werden per E-Mail zugesendet.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Notice */}
      <Card className="bg-muted/50 mb-8">
        <CardContent className="p-6">
          <div className="flex gap-4">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium mb-1">Bestätigung per E-Mail</h3>
              <p className="text-sm text-muted-foreground">
                Wir haben Ihnen eine Bestellbestätigung an{' '}
                {order?.customerEmail ? (
                  <span className="font-medium text-foreground">
                    {order.customerEmail}
                  </span>
                ) : (
                  'Ihre E-Mail-Adresse'
                )}{' '}
                gesendet.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Next Steps */}
      <div className="space-y-4">
        <h2 className="font-semibold text-lg">Nächste Schritte</h2>
        <div className="grid gap-4">
          {order?.shippingMethod === 'pickup' ? (
            <Card>
              <CardContent className="p-4">
                <h3 className="font-medium mb-1">Abholung im Salon</h3>
                <p className="text-sm text-muted-foreground">
                  Sie können Ihre Bestellung zu unseren Öffnungszeiten im Salon abholen.
                  Bringen Sie bitte Ihre Bestellnummer mit.
                </p>
              </CardContent>
            </Card>
          ) : order?.shippingMethod && order.shippingMethod !== 'none' ? (
            <Card>
              <CardContent className="p-4">
                <h3 className="font-medium mb-1">Versand</h3>
                <p className="text-sm text-muted-foreground">
                  Ihre Bestellung wird innerhalb von 1-2 Werktagen versendet.
                  Sie erhalten eine E-Mail mit der Sendungsverfolgung.
                </p>
              </CardContent>
            </Card>
          ) : null}

          {order?.items.some((item) => item.itemType === 'voucher') && (
            <Card>
              <CardContent className="p-4">
                <h3 className="font-medium mb-1">Gutschein</h3>
                <p className="text-sm text-muted-foreground">
                  Der Gutschein wird per E-Mail an den Empfänger gesendet.
                  Sie können den Gutschein auch selbst ausdrucken.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4 mt-8">
        <Button asChild className="flex-1">
          <Link href="/konto/bestellungen">
            Bestellungen ansehen
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
        <Button variant="outline" asChild className="flex-1">
          <Link href="/shop">Weiter einkaufen</Link>
        </Button>
      </div>
    </div>
  );
}
