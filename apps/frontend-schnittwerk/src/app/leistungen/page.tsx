import type { Metadata } from 'next';
import Link from 'next/link';
import { Clock, ArrowRight, Calendar } from 'lucide-react';

// Force dynamic rendering (API not available at build time)
export const dynamic = 'force-dynamic';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getServicesWithCategories, getAddonServices } from '@/lib/actions';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Leistungen & Preise',
  description:
    'Entdecken Sie unser umfangreiches Angebot an Friseurleistungen: Haarschnitte, Colorationen, Balayage, Styling und mehr. Transparente Preise.',
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatPrice(cents: number, priceFrom: boolean = false): string {
  const price = `CHF ${(cents / 100).toFixed(0)}`;
  return priceFrom ? `ab ${price}` : price;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} Min.`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `${hours} Std.`;
  }
  return `${hours} Std. ${remainingMinutes} Min.`;
}

// ============================================
// PAGE COMPONENT
// ============================================

export default async function LeistungenPage() {
  // Fetch services from database
  const [categories, addons] = await Promise.all([
    getServicesWithCategories(),
    getAddonServices(),
  ]);

  return (
    <div className="py-12">
      {/* Page Header */}
      <section className="container-wide mb-16">
        <div className="text-center max-w-3xl mx-auto">
          <p className="text-primary text-sm font-medium uppercase tracking-wider mb-2">
            Unser Angebot
          </p>
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Leistungen & Preise
          </h1>
          <p className="text-lg text-muted-foreground">
            Von klassischen Haarschnitten bis zu modernen Farbtechniken –
            entdecken Sie unser umfangreiches Angebot. Alle Preise verstehen
            sich inklusive Beratung.
          </p>
        </div>
      </section>

      {/* Service Categories */}
      <section className="container-wide space-y-16">
        {categories.map((category) => (
          <div key={category.slug} id={category.slug}>
            {/* Category Header */}
            <div className="mb-8">
              <h2 className="category-title text-2xl font-bold mb-2">{category.name}</h2>
              {category.description && (
                <p className="text-muted-foreground">{category.description}</p>
              )}
            </div>

            {/* Services Grid */}
            <div className="grid gap-4 md:grid-cols-2">
              {category.services.map((service) => (
                <Card
                  key={service.id}
                  className="card-hover border-border/50"
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{service.name}</h3>
                          {service.hasLengthVariants && (
                            <Badge variant="secondary" className="text-xs">
                              Längenvarianten
                            </Badge>
                          )}
                        </div>
                        {service.description && (
                          <p className="text-sm text-muted-foreground mb-3">
                            {service.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          {service.hasLengthVariants
                            ? `${formatDuration(service.lengthVariants?.[0]?.durationMinutes || service.durationMinutes)} - ${formatDuration(service.lengthVariants?.[service.lengthVariants.length - 1]?.durationMinutes || service.durationMinutes)}`
                            : formatDuration(service.durationMinutes)}
                        </div>

                        {/* Length Variants */}
                        {service.hasLengthVariants && service.lengthVariants && service.lengthVariants.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-border/50">
                            <div className="space-y-1">
                              {service.lengthVariants.map((variant) => (
                                <div key={variant.id} className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">{variant.name}</span>
                                  <span className="font-medium">{formatPrice(variant.priceCents)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      {!service.hasLengthVariants && (
                        <div className="text-right">
                          <p className="text-xl font-bold text-primary">
                            {formatPrice(service.priceCents, service.priceFrom)}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}

        {/* Addon Services */}
        {addons.length > 0 && (
          <div id="zusatzleistungen">
            <div className="mb-8">
              <h2 className="category-title text-2xl font-bold mb-2">Zusatzleistungen</h2>
              <p className="text-muted-foreground">
                Ergänzen Sie Ihren Termin mit diesen Extras
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {addons.map((addon) => (
                <Card key={addon.id} className="card-hover border-border/50">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-semibold mb-1">{addon.name}</h3>
                        {addon.description && (
                          <p className="text-sm text-muted-foreground mb-2">
                            {addon.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          +{formatDuration(addon.durationMinutes)}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-primary">
                          +{formatPrice(addon.priceCents)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Additional Info */}
      <section className="container-wide mt-16">
        <Card className="bg-muted/30 border-border/50">
          <CardContent className="p-8">
            <div className="grid gap-8 md:grid-cols-2">
              <div>
                <h3 className="font-semibold mb-3">Hinweise</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Alle Preise in CHF inkl. MwSt.</li>
                  <li>• Aufpreise für Überlänge möglich</li>
                  <li>• Terminabsagen bitte 24h im Voraus</li>
                  <li>• Bezahlung bar, Karte oder TWINT</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-3">Geschenkgutscheine</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Verschenken Sie Wellness für die Haare! Unsere Gutscheine
                  sind in beliebiger Höhe erhältlich.
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/shop/gutscheine">
                    Gutschein kaufen
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* CTA */}
      <section className="container-wide mt-16 text-center">
        <h2 className="text-2xl font-bold mb-4">Gefunden was Sie suchen?</h2>
        <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
          Buchen Sie jetzt Ihren Wunschtermin online – schnell und unkompliziert.
        </p>
        <Button size="lg" className="btn-glow" asChild>
          <Link href="/termin-buchen">
            <Calendar className="mr-2 h-5 w-5" />
            Termin buchen
          </Link>
        </Button>
      </section>
    </div>
  );
}
