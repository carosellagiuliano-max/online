import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { Calendar, Award, Heart, Sparkles, Star, Gem, Target, Users, Zap, Shield, type LucideIcon } from 'lucide-react';

// Force dynamic rendering (API not available at build time)
export const dynamic = 'force-dynamic';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getSalon, getAboutValues, getAboutMilestones, getAboutPageSettings } from '@/lib/actions/salon';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Über uns',
  description:
    'Lernen Sie BeautifyPRO kennen – Ihr Premium-Friseursalon in St. Gallen. Erfahren Sie mehr über unsere Geschichte, Philosophie und was uns antreibt.',
};

// ============================================
// ICON MAPPING
// ============================================

const iconMap: Record<string, LucideIcon> = {
  award: Award,
  heart: Heart,
  sparkles: Sparkles,
  star: Star,
  gem: Gem,
  target: Target,
  users: Users,
  zap: Zap,
  shield: Shield,
};

function getIcon(iconName: string): LucideIcon {
  return iconMap[iconName.toLowerCase()] || Sparkles;
}

// ============================================
// PAGE COMPONENT
// ============================================

export default async function UeberUnsPage() {
  // Fetch all data in parallel
  const [salon, values, milestones, pageSettings] = await Promise.all([
    getSalon(),
    getAboutValues(),
    getAboutMilestones(),
    getAboutPageSettings(),
  ]);

  // Use database values or defaults
  const heroTagline = salon?.aboutHeroTagline || 'Unsere Geschichte';
  const heroHeadline = salon?.aboutHeroHeadline || 'Über BeautifyPRO';
  const heroDescription = salon?.aboutHeroDescription || `Was 2018 als Vision begann, ist heute einer der führenden Friseursalons in St. Gallen. BeautifyPRO steht für höchste Qualität, kreatives Handwerk und ein unvergleichliches Kundenerlebnis.

Unser Name ist Programm: Bei uns verschmilzt präzise Handwerkskunst mit modernem Design. Wir glauben daran, dass ein guter Haarschnitt mehr ist als nur Technik – es ist Ausdruck Ihrer Persönlichkeit.`;
  const heroImageUrl = salon?.aboutHeroImageUrl;

  return (
    <div className="py-12">
      {/* Hero Section */}
      <section className="container-wide mb-16">
        <div className="grid gap-12 lg:grid-cols-2 items-center">
          <div>
            <p className="text-primary text-sm font-medium uppercase tracking-wider mb-2">
              {heroTagline}
            </p>
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              {heroHeadline}
            </h1>
            <div className="text-muted-foreground mb-8 leading-relaxed whitespace-pre-line">
              {heroDescription}
            </div>
            <Button asChild>
              <Link href="/team">Unser Team kennenlernen</Link>
            </Button>
          </div>

          {/* Hero Image */}
          <div className="relative aspect-[4/3] bg-gradient-to-br from-muted to-muted/50 rounded-2xl overflow-hidden">
            <Image
              src={heroImageUrl || 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Barber_cutting_hair_with_comb._Back_view_of_man_in_barber_shop.jpg/640px-Barber_cutting_hair_with_comb._Back_view_of_man_in_barber_shop.jpg'}
              alt={heroHeadline}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
              unoptimized={heroImageUrl?.includes('localhost')}
            />
          </div>
        </div>
      </section>

      {/* Values Section */}
      {pageSettings.showValuesSection && values.length > 0 && (
        <section className="bg-muted/30 py-16">
          <div className="container-wide">
            <div className="text-center mb-12">
              <p className="text-primary text-sm font-medium uppercase tracking-wider mb-2">
                Wofür wir stehen
              </p>
              <h2 className="text-3xl font-bold">Unsere Werte</h2>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {values.map((value) => {
                const IconComponent = getIcon(value.icon);
                return (
                  <Card key={value.id} className="border-border/50">
                    <CardContent className="p-6 text-center">
                      <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-4">
                        <IconComponent className="h-7 w-7 text-primary" />
                      </div>
                      <h3 className="text-xl font-semibold mb-2">{value.title}</h3>
                      <p className="text-muted-foreground">{value.description}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Timeline Section */}
      {pageSettings.showMilestonesSection && milestones.length > 0 && (
        <section className="container-wide py-16">
          <div className="text-center mb-12">
            <p className="text-primary text-sm font-medium uppercase tracking-wider mb-2">
              Unsere Reise
            </p>
            <h2 className="text-3xl font-bold">Meilensteine</h2>
          </div>

          <div className="max-w-2xl mx-auto">
            <div className="relative">
              {/* Timeline Line */}
              <div className="absolute left-8 top-0 bottom-0 w-px bg-border" />

              {/* Milestones */}
              <div className="space-y-8">
                {milestones.map((milestone) => (
                  <div key={milestone.id} className="relative flex gap-6">
                    {/* Year Badge */}
                    <div className="relative z-10 flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
                      {milestone.year}
                    </div>

                    {/* Content */}
                    <div className="pt-3">
                      <h3 className="font-semibold text-lg">{milestone.title}</h3>
                      <p className="text-muted-foreground">{milestone.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="container-wide">
        <Card className="bg-charcoal text-white border-0">
          <CardContent className="p-8 md:p-12 text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              Überzeugen Sie sich selbst
            </h2>
            <p className="text-white/70 mb-8 max-w-xl mx-auto">
              Erleben Sie die BeautifyPRO-Qualität bei Ihrem nächsten Besuch.
              Wir freuen uns darauf, Sie kennenzulernen.
            </p>
            <Button size="lg" className="btn-glow" asChild>
              <Link href="/termin-buchen">
                <Calendar className="mr-2 h-5 w-5" />
                Termin buchen
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
