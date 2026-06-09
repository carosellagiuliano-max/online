import type { Metadata } from 'next';
import Link from 'next/link';
import { Star, ArrowLeft } from 'lucide-react';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FeedbackForm } from '@/components/customer/feedback-form';
import { getApprovedFeedback, getFeedbackStats, getSalon } from '@/lib/actions';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Bewertung abgeben',
  description:
    'Teilen Sie Ihre Erfahrung mit uns. Ihre Bewertung hilft anderen Kunden bei ihrer Entscheidung.',
};

// ============================================
// PAGE COMPONENT
// ============================================

export default async function BewertungPage() {
  const [salon, stats, recentFeedback] = await Promise.all([
    getSalon(),
    getFeedbackStats(),
    getApprovedFeedback(3),
  ]);

  const salonName = salon?.name || 'BeautifyPRO';

  return (
    <div className="py-12">
      {/* Page Header */}
      <section className="container-wide mb-12">
        <Link
          href="/"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Zurück zur Startseite
        </Link>

        <div className="text-center max-w-3xl mx-auto">
          <p className="text-primary text-sm font-medium uppercase tracking-wider mb-2">
            Ihre Meinung zählt
          </p>
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Bewertung abgeben
          </h1>
          <p className="text-lg text-muted-foreground">
            Waren Sie bei {salonName}? Teilen Sie Ihre Erfahrung mit uns und
            helfen Sie anderen Kunden bei ihrer Entscheidung.
          </p>
        </div>
      </section>

      {/* Stats Banner */}
      {stats.totalReviews > 0 && (
        <section className="container-wide mb-12">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row items-center justify-center gap-6 text-center">
                <div className="flex items-center gap-2">
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-5 w-5 ${
                          i < Math.round(stats.averageRating)
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'fill-muted text-muted'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="font-bold text-lg">
                    {stats.averageRating.toFixed(1)}
                  </span>
                </div>
                <div className="text-muted-foreground">
                  Basierend auf{' '}
                  <span className="font-semibold text-foreground">
                    {stats.totalReviews}
                  </span>{' '}
                  Bewertungen
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Main Content */}
      <section className="container-wide">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Feedback Form */}
          <div>
            <FeedbackForm />
          </div>

          {/* Recent Reviews */}
          <div className="space-y-6">
            <h2 className="text-xl font-bold">Aktuelle Bewertungen</h2>

            {recentFeedback.length > 0 ? (
              <div className="space-y-4">
                {recentFeedback.map((review) => (
                  <Card key={review.id} className="border-border/50">
                    <CardContent className="p-4">
                      <div className="flex gap-1 mb-2">
                        {Array.from({ length: review.rating }).map((_, i) => (
                          <Star
                            key={i}
                            className="h-4 w-4 fill-yellow-400 text-yellow-400"
                          />
                        ))}
                      </div>
                      {review.comment && (
                        <p className="text-foreground/80 mb-2 text-sm">
                          &ldquo;{review.comment}&rdquo;
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {review.name}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="border-border/50">
                <CardContent className="p-6 text-center">
                  <Star className="mx-auto h-12 w-12 text-muted-foreground/30" />
                  <p className="mt-4 text-muted-foreground">
                    Noch keine Bewertungen vorhanden.
                    <br />
                    Seien Sie der Erste!
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Info Box */}
            <Card className="bg-muted/50 border-border/50">
              <CardContent className="p-4">
                <h3 className="font-semibold mb-2">Hinweis zur Veröffentlichung</h3>
                <p className="text-sm text-muted-foreground">
                  Alle Bewertungen werden vor der Veröffentlichung geprüft.
                  Dies dient dem Schutz vor Spam und unangemessenen Inhalten.
                  Ihre Bewertung erscheint in der Regel innerhalb von 24 Stunden.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container-wide mt-16 text-center">
        <h2 className="text-2xl font-bold mb-4">
          Noch kein Kunde?
        </h2>
        <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
          Erleben Sie selbst, warum unsere Kunden uns so schätzen.
          Buchen Sie jetzt Ihren ersten Termin.
        </p>
        <Button size="lg" className="btn-glow" asChild>
          <Link href="/termin-buchen">
            Termin buchen
          </Link>
        </Button>
      </section>
    </div>
  );
}
