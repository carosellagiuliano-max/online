import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { Geist, Geist_Mono } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { LocalBusinessJsonLd } from '@/components/seo/json-ld';
import { CartProvider } from '@/contexts/cart-context';
import { CartDrawer } from '@/components/shop/cart-drawer';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider } from '@/lib/auth/context';
import { ThemeLayoutProvider } from '@/contexts/theme-layout-context';
import { getSalon, getOpeningHours } from '@/lib/actions';
import { getTheme, getThemeName, getStructure, getStructureName } from '@/lib/config/themes';
import { ThemeStyles } from '@/components/theme-styles';
import { DEFAULT_CONFIG } from '@/config/settings';
import './globals.css';

// ============================================
// FONTS
// ============================================

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
});

// ============================================
// DYNAMIC METADATA (fetched from database)
// ============================================

export async function generateMetadata(): Promise<Metadata> {
  const salon = await getSalon();

  // Use salon data if available, otherwise fall back to defaults
  const name = salon?.name || DEFAULT_CONFIG.name;
  const seoTitle = salon?.seoTitle || DEFAULT_CONFIG.seo.title;
  const seoDescription = salon?.seoDescription || DEFAULT_CONFIG.seo.description;
  const seoKeywords = salon?.seoKeywords || DEFAULT_CONFIG.seo.keywords;
  const ogImage = salon?.ogImageUrl || DEFAULT_CONFIG.seo.ogImage;
  const locale = salon?.locale || DEFAULT_CONFIG.locale;
  const siteUrl = salon?.website || DEFAULT_CONFIG.website;
  const localeCode = locale.replace('-', '_'); // de-CH → de_CH

  return {
    title: {
      default: `${name} | ${seoTitle}`,
      template: `%s | ${name}`,
    },
    description: `${name} - ${seoDescription}`,
    keywords: [...seoKeywords, name],
    authors: [{ name }],
    creator: name,
    publisher: name,
    formatDetection: {
      telephone: true,
      email: true,
      address: true,
    },
    metadataBase: new URL(siteUrl),
    alternates: {
      canonical: '/',
      languages: {
        [locale]: '/',
      },
    },
    openGraph: {
      type: 'website',
      locale: localeCode,
      url: '/',
      siteName: name,
      title: `${name} | ${seoTitle}`,
      description: seoDescription,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${name} - ${seoTitle}`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${name} | ${seoTitle}`,
      description: seoDescription,
      images: [ogImage],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    icons: {
      icon: [
        { url: '/favicon.ico', sizes: 'any' },
        { url: '/icon.svg', type: 'image/svg+xml' },
      ],
      apple: '/apple-touch-icon.png',
    },
    manifest: '/site.webmanifest',
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf9f7' },
    { media: '(prefers-color-scheme: dark)', color: '#1c1917' },
  ],
};

// ============================================
// ROOT LAYOUT
// ============================================

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Get current pathname to check if we're on admin routes
  const headersList = await headers();
  const pathname = headersList.get('x-pathname') || headersList.get('x-invoke-path') || '';
  const isAdminRoute = pathname.startsWith('/admin');

  // Fetch data for JSON-LD and header (cached) - only needed for public pages
  const [salon, openingHours] = await Promise.all([
    getSalon(),
    getOpeningHours(),
  ]);

  // Get locale from salon or use default
  const locale = salon?.locale || DEFAULT_CONFIG.locale;

  // Get theme and structure configuration (only for public pages)
  // NEXT_PUBLIC_THEME controls colors
  // NEXT_PUBLIC_THEME_STRUCTURE controls layout
  const themeName = getThemeName();
  const structureName = getStructureName();
  const structure = getStructure();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {/* Structured Data for Local Business */}
        {!isAdminRoute && <LocalBusinessJsonLd salon={salon} openingHours={openingHours} />}
        {/* Theme CSS Variables - configured via NEXT_PUBLIC_THEME */}
        <ThemeStyles />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased min-h-screen ${isAdminRoute ? '' : 'bg-gradient-beauty'}`}
        {...(!isAdminRoute && {
          'data-theme-structure': structureName,
          'data-card-style': structure.cards,
          'data-button-style': structure.buttons,
          'data-border-radius': structure.borderRadius,
        })}
      >
        <ThemeProvider>
        <AuthProvider>
        <CartProvider>
          {isAdminRoute ? (
            /* Admin routes - no theme provider */
            <>
              <main>{children}</main>
            </>
          ) : (
            /* Public routes - wrapped in ThemeLayoutProvider */
            <ThemeLayoutProvider layout={structure} themeName={structureName}>
              {/* Decorative background elements */}
              <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
                <div className="absolute -top-1/2 -right-1/4 w-[800px] h-[800px] rounded-full bg-gradient-radial from-primary/5 via-transparent to-transparent opacity-60 blur-3xl" />
                <div className="absolute -bottom-1/4 -left-1/4 w-[600px] h-[600px] rounded-full bg-gradient-radial from-rose/5 via-transparent to-transparent opacity-40 blur-3xl" />
              </div>

              {/* Header */}
              <Header salon={salon} />

              {/* Main Content */}
              <main className="min-h-screen pt-16 lg:pt-20 animate-fade-in">
                {children}
              </main>

              {/* Footer */}
              <Footer style={structure.footer} />

              {/* Cart Drawer */}
              <CartDrawer />
            </ThemeLayoutProvider>
          )}

          {/* Toast Notifications */}
          <Toaster
            position="bottom-right"
            toastOptions={{
              classNames: {
                toast: 'bg-card/95 backdrop-blur-xl border-border/50 shadow-elegant',
                title: 'text-foreground font-medium',
                description: 'text-muted-foreground',
                success: 'border-l-4 border-l-emerald-500',
                error: 'border-l-4 border-l-destructive',
                warning: 'border-l-4 border-l-amber-500',
                info: 'border-l-4 border-l-primary',
              },
            }}
          />
        </CartProvider>
        </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
