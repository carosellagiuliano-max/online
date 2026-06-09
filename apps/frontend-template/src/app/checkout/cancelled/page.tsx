import type { Metadata } from 'next';
import Link from 'next/link';
import { XCircle, ArrowLeft, ShoppingBag, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Zahlung abgebrochen',
  description: 'Die Zahlung wurde abgebrochen.',
  robots: { index: false, follow: false },
};

// ============================================
// PAGE
// ============================================

export default function CheckoutCancelledPage() {
  return (
    <div className="container max-w-2xl py-12 md:py-20">
      {/* Icon */}
      <div className="flex justify-center mb-8">
        <div className="relative">
          <div className="absolute inset-0 bg-destructive/20 rounded-full blur-2xl" />
          <div className="relative h-24 w-24 rounded-full bg-destructive/10 flex items-center justify-center">
            <XCircle className="h-12 w-12 text-destructive" />
          </div>
        </div>
      </div>

      {/* Title */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-3">Zahlung abgebrochen</h1>
        <p className="text-muted-foreground text-lg">
          Die Zahlung wurde abgebrochen. Keine Sorge, es wurden keine Kosten erhoben.
        </p>
      </div>

      {/* Info Card */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <h2 className="font-semibold mb-3">Was ist passiert?</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Die Zahlung wurde nicht abgeschlossen. Dies kann verschiedene Gründe haben:
          </p>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              Sie haben die Zahlung selbst abgebrochen
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              Es gab ein technisches Problem
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              Die Zahlung wurde von Ihrer Bank abgelehnt
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Cart Notice */}
      <Card className="bg-muted/50 mb-8">
        <CardContent className="p-6">
          <div className="flex gap-4">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <ShoppingBag className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium mb-1">Ihr Warenkorb ist noch verfügbar</h3>
              <p className="text-sm text-muted-foreground">
                Ihre ausgewählten Artikel wurden nicht gelöscht. Sie können die Bestellung
                jederzeit erneut versuchen.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Button asChild className="flex-1">
          <Link href="/warenkorb">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zurück zum Warenkorb
          </Link>
        </Button>
        <Button variant="outline" asChild className="flex-1">
          <Link href="/shop">Weiter einkaufen</Link>
        </Button>
      </div>

      {/* Help Section */}
      <div className="mt-12 text-center">
        <p className="text-muted-foreground text-sm mb-4">
          Haben Sie Fragen oder benötigen Sie Hilfe?
        </p>
        <Button variant="ghost" asChild>
          <Link href="/kontakt">
            <MessageCircle className="mr-2 h-4 w-4" />
            Kontaktieren Sie uns
          </Link>
        </Button>
      </div>
    </div>
  );
}
