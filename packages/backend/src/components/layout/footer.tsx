import Link from 'next/link';
import { headers } from 'next/headers';
import {
  MapPin,
  Phone,
  Mail,
  Instagram,
  Facebook,
  Youtube,
  Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TikTokIcon } from '@/components/ui/icons';
import { features } from '@/lib/config/features';
import { getSalon, getOpeningHours, getEnabledSocialLinks, type SocialLink, type OpeningHour } from '@/lib/actions/salon';

// ============================================
// DEFAULT SALON INFO (fallback if database is unavailable)
// ============================================

const defaultSalonInfo = {
  name: process.env.NEXT_PUBLIC_BUSINESS_NAME || 'Salon',
  tagline: process.env.NEXT_PUBLIC_BUSINESS_TAGLINE || 'Your Style. Your Statement.',
  address: {
    street: process.env.NEXT_PUBLIC_ADDRESS_STREET || '',
    city: `${process.env.NEXT_PUBLIC_ADDRESS_ZIP || ''} ${process.env.NEXT_PUBLIC_ADDRESS_CITY || ''}`.trim(),
    country: process.env.NEXT_PUBLIC_ADDRESS_COUNTRY || '',
  },
  phone: process.env.NEXT_PUBLIC_PHONE || '',
  email: process.env.NEXT_PUBLIC_EMAIL || '',
  social: {
    instagram: process.env.NEXT_PUBLIC_INSTAGRAM || '',
    facebook: '',
  },
};

// Default opening hours (fallback if database is unavailable)
const defaultOpeningHours = [
  { day: 'Montag', hours: 'Geschlossen' },
  { day: 'Dienstag', hours: '09:00 - 18:00' },
  { day: 'Mittwoch', hours: '09:00 - 18:00' },
  { day: 'Donnerstag', hours: '09:00 - 20:00' },
  { day: 'Freitag', hours: '09:00 - 18:00' },
  { day: 'Samstag', hours: '09:00 - 16:00' },
  { day: 'Sonntag', hours: 'Geschlossen' },
];

const quickLinksConfig = [
  { label: 'Leistungen', href: '/leistungen' },
  { label: 'Online Termin', href: '/termin-buchen', feature: 'bookingEnabled' as const },
  { label: 'Shop', href: '/shop', feature: 'shopEnabled' as const },
  { label: 'Gutscheine', href: '/shop/gutscheine', feature: 'shopEnabled' as const },
  { label: 'Kontakt', href: '/kontakt' },
];

// Filter quick links based on feature flags
const quickLinks = quickLinksConfig.filter(
  link => !link.feature || features[link.feature]
);

const legalLinks = [
  { label: 'Impressum', href: '/impressum' },
  { label: 'Datenschutz', href: '/datenschutz' },
  { label: 'AGB', href: '/agb' },
  { label: 'Admin', href: '/admin' },
];

// ============================================
// FOOTER TYPES
// ============================================

export type FooterStyle = 'full' | 'minimal' | 'centered' | 'columns';

interface FooterProps {
  style?: FooterStyle;
}

// ============================================
// FOOTER COMPONENT
// ============================================

// Helper function to get social icon
function getSocialIcon(platform: string) {
  switch (platform) {
    case 'instagram':
      return <Instagram className="h-4 w-4" />;
    case 'facebook':
      return <Facebook className="h-4 w-4" />;
    case 'youtube':
      return <Youtube className="h-4 w-4" />;
    case 'tiktok':
      return <TikTokIcon className="h-4 w-4" />;
    default:
      return <Globe className="h-4 w-4" />;
  }
}

export async function Footer({ style = 'full' }: FooterProps) {
  // Hide footer on admin routes
  const headersList = await headers();
  const pathname = headersList.get('x-pathname') || headersList.get('x-invoke-path') || '';
  if (pathname.startsWith('/admin')) {
    return null;
  }

  const currentYear = new Date().getFullYear();

  // Fetch salon info, opening hours, and social links from database
  const [salon, dbOpeningHours, socialLinks] = await Promise.all([
    getSalon(),
    getOpeningHours(),
    getEnabledSocialLinks(),
  ]);

  // Build salon info from database or use defaults
  const salonInfo = salon ? {
    name: salon.name,
    tagline: salon.tagline || defaultSalonInfo.tagline,
    description: salon.footerDescription || null,
    address: {
      street: salon.address || defaultSalonInfo.address.street,
      city: `${salon.zipCode || ''} ${salon.city || ''}`.trim() || defaultSalonInfo.address.city,
      country: salon.country || defaultSalonInfo.address.country,
    },
    phone: salon.phone || defaultSalonInfo.phone,
    email: salon.email || defaultSalonInfo.email,
  } : { ...defaultSalonInfo, description: null };

  // Helper to format time (remove seconds if present)
  const formatTime = (time: string | null) => {
    if (!time) return '';
    return time.substring(0, 5);
  };

  // Transform database format to display format
  const openingHours = dbOpeningHours.length > 0
    ? dbOpeningHours.map((oh: OpeningHour) => {
        if (!oh.isOpen || !oh.openTime || !oh.closeTime) {
          return { day: oh.dayName, hours: 'Geschlossen' };
        }

        const openTime = formatTime(oh.openTime);
        const closeTime = formatTime(oh.closeTime);

        // If there's a lunch break, show split hours
        if (oh.hasLunchBreak && oh.lunchStart && oh.lunchEnd) {
          const lunchStart = formatTime(oh.lunchStart);
          const lunchEnd = formatTime(oh.lunchEnd);
          return {
            day: oh.dayName,
            hours: `${openTime} - ${lunchStart}, ${lunchEnd} - ${closeTime}`,
          };
        }

        return { day: oh.dayName, hours: `${openTime} - ${closeTime}` };
      })
    : defaultOpeningHours;

  // Minimal Footer
  if (style === 'minimal') {
    return (
      <footer className="bg-card border-t">
        <div className="container-wide py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <Link href="/" className="text-xl font-bold text-gradient-gold">
              {salonInfo.name}
            </Link>

            <nav className="flex flex-wrap justify-center gap-6">
              {quickLinks.slice(0, 4).map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-4">
              {socialLinks.slice(0, 3).map((link: SocialLink) => (
                <a
                  key={link.platform}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors"
                  aria-label={link.platform}
                >
                  {getSocialIcon(link.platform)}
                </a>
              ))}
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-border/50 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              © {currentYear} {salonInfo.name}. Alle Rechte vorbehalten.
            </p>
            <nav className="flex gap-4">
              {legalLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </footer>
    );
  }

  // Centered Footer
  if (style === 'centered') {
    return (
      <footer className="bg-card border-t">
        <div className="container-wide py-12 text-center">
          <Link href="/" className="inline-block">
            <h2 className="text-2xl font-bold text-gradient-gold">{salonInfo.name}</h2>
          </Link>
          <p className="mt-2 text-sm text-muted-foreground italic">{salonInfo.tagline}</p>

          <nav className="mt-8 flex flex-wrap justify-center gap-6">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="mt-8 flex justify-center gap-3">
            {socialLinks.map((link: SocialLink) => (
              <Button
                key={link.platform}
                variant="outline"
                size="icon"
                asChild
                className="hover:bg-primary hover:text-primary-foreground hover:border-primary"
              >
                <a href={link.url} target="_blank" rel="noopener noreferrer" aria-label={link.platform}>
                  {getSocialIcon(link.platform)}
                </a>
              </Button>
            ))}
          </div>

          <div className="mt-8 flex items-center justify-center gap-4 text-sm text-muted-foreground">
            <a href={`tel:${salonInfo.phone.replace(/\s/g, '')}`} className="flex items-center gap-2 hover:text-primary transition-colors">
              <Phone className="h-4 w-4" />
              {salonInfo.phone}
            </a>
            <span>•</span>
            <a href={`mailto:${salonInfo.email}`} className="flex items-center gap-2 hover:text-primary transition-colors">
              <Mail className="h-4 w-4" />
              {salonInfo.email}
            </a>
          </div>

          <Button className="mt-8" asChild>
            <Link href="/termin-buchen">Jetzt Termin buchen</Link>
          </Button>

          <div className="mt-8 pt-8 border-t border-border/50">
            <p className="text-xs text-muted-foreground">
              © {currentYear} {salonInfo.name}. Alle Rechte vorbehalten.
            </p>
            <nav className="mt-4 flex justify-center gap-4">
              {legalLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </footer>
    );
  }

  // Columns Footer (simpler than full)
  if (style === 'columns') {
    return (
      <footer className="bg-card border-t">
        <div className="container-wide py-12">
          <div className="grid gap-8 md:grid-cols-3">
            {/* Brand */}
            <div>
              <Link href="/" className="inline-block">
                <h2 className="text-2xl font-bold text-gradient-gold">{salonInfo.name}</h2>
              </Link>
              <p className="mt-2 text-sm text-muted-foreground italic">{salonInfo.tagline}</p>
              {salonInfo.description && (
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                  {salonInfo.description}
                </p>
              )}
              <div className="mt-4 flex gap-2">
                {socialLinks.map((link: SocialLink) => (
                  <a
                    key={link.platform}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    {getSocialIcon(link.platform)}
                  </a>
                ))}
              </div>
            </div>

            {/* Links */}
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider">Links</h3>
              <ul className="mt-4 space-y-2">
                {quickLinks.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider">Kontakt</h3>
              <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-0.5 text-primary" />
                  <span>{salonInfo.address.street}, {salonInfo.address.city}</span>
                </li>
                <li>
                  <a href={`tel:${salonInfo.phone.replace(/\s/g, '')}`} className="flex items-center gap-2 hover:text-primary transition-colors">
                    <Phone className="h-4 w-4 text-primary" />
                    {salonInfo.phone}
                  </a>
                </li>
                <li>
                  <a href={`mailto:${salonInfo.email}`} className="flex items-center gap-2 hover:text-primary transition-colors">
                    <Mail className="h-4 w-4 text-primary" />
                    {salonInfo.email}
                  </a>
                </li>
              </ul>
              <Button className="mt-4 w-full" size="sm" asChild>
                <Link href="/termin-buchen">Termin buchen</Link>
              </Button>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-border/50 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">© {currentYear} {salonInfo.name}. Alle Rechte vorbehalten.</p>
            <nav className="flex gap-4">
              {legalLinks.map((link) => (
                <Link key={link.href} href={link.href} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </footer>
    );
  }

  // Full Footer (default - 4 columns)
  return (
    <footer className="bg-card border-t">
      {/* Main Footer Content */}
      <div className="container-wide section-padding">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand & Description */}
          <div className="lg:col-span-1">
            <Link href="/" className="inline-block">
              <h2 className="text-2xl font-bold text-gradient-gold">
                {salonInfo.name}
              </h2>
            </Link>
            <p className="mt-2 text-sm text-muted-foreground italic">
              {salonInfo.tagline}
            </p>
            {salonInfo.description && (
              <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
                {salonInfo.description}
              </p>
            )}

            {/* Social Links */}
            {socialLinks.length > 0 && (
              <div className="mt-6 flex gap-2">
                {socialLinks.map((link: SocialLink) => (
                  <Button
                    key={link.platform}
                    variant="outline"
                    size="icon"
                    asChild
                    className="hover:bg-primary hover:text-primary-foreground hover:border-primary"
                  >
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={link.platform.charAt(0).toUpperCase() + link.platform.slice(1)}
                    >
                      {getSocialIcon(link.platform)}
                    </a>
                  </Button>
                ))}
              </div>
            )}

            {/* Powered by */}
            <p className="mt-6 text-xs text-muted-foreground">
              Powered by{' '}
              <a
                href="https://beautifypro.ch"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors underline-offset-4 hover:underline"
              >
                beautifypro.ch
              </a>
            </p>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
              Kontakt
            </h3>
            <ul className="mt-4 space-y-4">
              <li>
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(
                    `${salonInfo.address.street}, ${salonInfo.address.city}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                  <span>
                    {salonInfo.address.street}
                    <br />
                    {salonInfo.address.city}
                  </span>
                </a>
              </li>
              <li>
                <a
                  href={`tel:${salonInfo.phone.replace(/\s/g, '')}`}
                  className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Phone className="h-4 w-4 shrink-0 text-primary" />
                  {salonInfo.phone}
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${salonInfo.email}`}
                  className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Mail className="h-4 w-4 shrink-0 text-primary" />
                  {salonInfo.email}
                </a>
              </li>
            </ul>
          </div>

          {/* Opening Hours */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
              Öffnungszeiten
            </h3>
            <ul className="mt-4 space-y-2">
              {openingHours.map((item: { day: string; hours: string }) => (
                <li
                  key={item.day}
                  className="flex justify-between text-sm text-muted-foreground"
                >
                  <span>{item.day}</span>
                  <span
                    className={
                      item.hours === 'Geschlossen'
                        ? 'text-muted-foreground/60'
                        : ''
                    }
                  >
                    {item.hours}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
              Quick Links
            </h3>
            <ul className="mt-4 space-y-2">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>

            {/* CTA Button */}
            <Button className="mt-6 w-full" asChild>
              <Link href="/termin-buchen">Jetzt Termin buchen</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t bg-muted/30">
        <div className="container-wide py-6">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            {/* Copyright */}
            <p className="text-xs text-muted-foreground">
              © {currentYear} {salonInfo.name}. Alle Rechte vorbehalten.
            </p>
            {/* Legal Links */}
            <nav className="flex flex-wrap justify-center gap-4 md:gap-6">
              {legalLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
}
