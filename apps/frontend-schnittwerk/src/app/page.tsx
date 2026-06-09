import Link from 'next/link';
import { MapPin, Clock, Sparkles, ArrowRight, Calendar } from 'lucide-react';

// Force dynamic rendering (API not available at build time)
export const dynamic = 'force-dynamic';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getSalon, getOpeningHours, getBookableServices, getApprovedFeedback, getHomepageGalleryImages, type Salon, type OpeningHour } from '@/lib/actions';
import { HeroSection as ThemedHeroSection, ServicesSection as ThemedServicesSection, GallerySection as ThemedGallerySection, type Service as ThemeService, type GalleryImage } from '@/components/theme-aware';
import { ReviewsCarousel } from '@/components/customer/reviews-carousel';
import { getStructureName } from '@/lib/config/themes';

// ============================================
// HOMEPAGE
// ============================================

const DEFAULT_SALON_ID = '550e8400-e29b-41d4-a716-446655440001';
const SALON_ID = process.env.NEXT_PUBLIC_SALON_ID || DEFAULT_SALON_ID;

export default async function HomePage() {
  // Get theme structure for layout decisions
  const structureName = getStructureName();
  const servicesMaxItems = structureName === 'modern' ? 4 : 3;

  // Fetch all data in parallel
  const [salon, openingHours, serviceCategories, galleryImages, feedbackData] = await Promise.all([
    getSalon(),
    getOpeningHours(),
    getBookableServices(),
    getHomepageGalleryImages(SALON_ID, 8) as Promise<GalleryImage[]>,
    getApprovedFeedback(6),
  ]);

  // Flatten services from categories and map to theme-aware format
  const services: ThemeService[] = serviceCategories
    .flatMap(cat => cat.services)
    .slice(0, servicesMaxItems)
    .map(svc => ({
      id: svc.id,
      name: svc.name,
      description: svc.description || undefined,
      duration_minutes: svc.durationMinutes,
      price_cents: svc.priceCents,
      category: serviceCategories.find(cat => cat.services.some(s => s.id === svc.id))?.name,
    }));

  // Build hero content from salon data
  const heroTitle = `${salon?.heroHeadline || 'Your Style.'} ${salon?.heroHeadlineAccent || 'Your Statement.'}`;
  const heroSubtitle = salon?.heroDescription || 'Willkommen bei BeautifyPRO – wo Stil auf Handwerk trifft. Erleben Sie erstklassige Haarkunst in entspannter Atmosphäre.';
  const heroTagline = salon?.heroTagline || `Premium Friseursalon ${salon?.city || 'St. Gallen'}`;
  const heroImageUrl = salon?.heroImageUrl || 'https://burst.shopifycdn.com/photos/woman-stylist-cuts-hair-at-salon.jpg?width=1920&exif=0&iptc=0';

  return (
    <>
      {/* Hero Section - Theme Aware */}
      <ThemedHeroSection
        title={heroTitle}
        subtitle={heroSubtitle}
        tagline={heroTagline}
        ctaText="Termin buchen"
        ctaHref="/termin-buchen"
        secondaryCtaText="Leistungen"
        secondaryCtaHref="/leistungen"
        imageUrl={heroImageUrl}
      />

      {/* Info Cards */}
      <InfoCardsSection salon={salon} openingHours={openingHours} />

      {/* Services Preview - Theme Aware */}
      {services.length > 0 && (
        <ThemedServicesSection
          title="Beliebte Services"
          subtitle="Von klassischen Haarschnitten bis zu modernen Farbtechniken – entdecken Sie unser umfangreiches Angebot."
          services={services}
          showAllLink="/leistungen"
          maxItems={servicesMaxItems}
        />
      )}

      {/* Gallery Section - Theme Aware */}
      {galleryImages.length > 0 && (
        <ThemedGallerySection
          title="Galerie"
          subtitle="Einblicke in unseren Salon und unsere Arbeiten"
          images={galleryImages}
          maxItems={8}
        />
      )}

      {/* Reviews Section - Top 6 as Carousel */}
      <ReviewsCarouselSection feedback={feedbackData} />

      {/* CTA Section */}
      <CTASection />
    </>
  );
}

// ============================================
// INFO CARDS SECTION
// ============================================

function InfoCardsSection({
  salon,
  openingHours
}: {
  salon: Salon | null;
  openingHours: OpeningHour[];
}) {
  // Build address string from salon data
  const address = salon
    ? `${salon.address || 'Musterstrasse 123'}, ${salon.zipCode || '9000'} ${salon.city || 'St. Gallen'}`
    : 'Musterstrasse 123, 9000 St. Gallen';

  const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(address)}`;

  // Build opening hours summary from database
  const getOpeningHoursSummary = () => {
    if (openingHours.length === 0) {
      return 'Di–Fr 09:00–18:00, Sa 09:00–16:00';
    }

    // Find typical weekday and Saturday hours
    const tuesday = openingHours.find(h => h.dayOfWeek === 2);
    const saturday = openingHours.find(h => h.dayOfWeek === 6);

    const weekdayHours = tuesday?.isOpen && tuesday?.openTime && tuesday?.closeTime
      ? `${tuesday.openTime}–${tuesday.closeTime}`
      : 'Geschlossen';

    const saturdayHours = saturday?.isOpen && saturday?.openTime && saturday?.closeTime
      ? `${saturday.openTime}–${saturday.closeTime}`
      : 'Geschlossen';

    return `Di–Fr ${weekdayHours}, Sa ${saturdayHours}`;
  };

  const infoCards = [
    {
      icon: MapPin,
      title: 'Standort',
      description: address,
      link: {
        href: mapsUrl,
        label: 'Route anzeigen',
        external: true,
      },
    },
    {
      icon: Clock,
      title: 'Öffnungszeiten',
      description: getOpeningHoursSummary(),
      link: {
        href: '/kontakt#oeffnungszeiten',
        label: 'Alle Zeiten',
      },
    },
    {
      icon: Sparkles,
      title: 'Premium Services',
      description: 'Balayage, Colorationen, Styling',
      link: {
        href: '/leistungen',
        label: 'Mehr erfahren',
      },
    },
  ];

  return (
    <section className="section-padding bg-background">
      <div className="container-wide">
        <div className="grid gap-6 md:grid-cols-3">
          {infoCards.map((card) => (
            <Card
              key={card.title}
              className="card-hover border-border/50 bg-card"
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <card.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">{card.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {card.description}
                    </p>
                    <Link
                      href={card.link.href}
                      target={card.link.external ? '_blank' : undefined}
                      rel={card.link.external ? 'noopener noreferrer' : undefined}
                      className="mt-3 inline-flex items-center text-sm font-medium text-primary hover:underline"
                    >
                      {card.link.label}
                      <ArrowRight className="ml-1 h-3 w-3" />
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================
// REVIEWS CAROUSEL SECTION
// ============================================

interface ReviewsCarouselSectionProps {
  feedback: Array<{
    id: string;
    name: string;
    rating: number;
    comment: string | null;
  }>;
}

function ReviewsCarouselSection({ feedback }: ReviewsCarouselSectionProps) {
  if (feedback.length === 0) {
    return null;
  }

  return <ReviewsCarousel reviews={feedback.slice(0, 6)} />;
}

// ============================================
// CTA SECTION
// ============================================

function CTASection() {
  return (
    <section className="py-20 bg-charcoal text-white">
      <div className="container-wide text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">
          Bereit für Ihren neuen Look?
        </h2>
        <p className="text-white/70 mb-8 max-w-xl mx-auto">
          Buchen Sie jetzt Ihren Termin online – schnell, einfach und bequem.
          Wir freuen uns auf Sie!
        </p>
        <Button size="lg" className="btn-glow" asChild>
          <Link href="/termin-buchen">
            <Calendar className="mr-2 h-5 w-5" />
            Jetzt Termin buchen
          </Link>
        </Button>
      </div>
    </section>
  );
}
