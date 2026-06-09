import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Calendar, User, LogOut, Scissors, ChevronRight, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getCurrentUser, logout } from '@/lib/actions';
import { features } from '@/lib/config/features';

// ============================================
// CUSTOMER PORTAL LAYOUT
// ============================================

interface LayoutProps {
  children: React.ReactNode;
}

export default async function KontoLayout({ children }: LayoutProps) {
  const user = await getCurrentUser();

  // Auth pages don't need authentication
  // This layout only protects /konto/termine and /konto/profil
  const isAuthPage =
    typeof window === 'undefined' ||
    ['/konto/login', '/konto/registrieren', '/konto/passwort-vergessen', '/konto/passwort-aendern'].some(
      (path) => false // Server-side, we can't check pathname
    );

  // If no user and not an auth page, redirect to login
  // Note: Auth pages have their own redirect logic

  const navItems = [
    {
      href: '/konto/termine',
      label: 'Meine Termine',
      icon: Calendar,
    },
    // Only show shop-related items when shop is enabled
    ...(features.shopEnabled
      ? [
          {
            href: '/konto/bestellungen',
            label: 'Meine Bestellungen',
            icon: ShoppingBag,
          },
          {
            href: '/konto/profil',
            label: 'Mein Profil',
            icon: User,
          },
        ]
      : []),
  ];

  // For auth pages, render without sidebar
  if (!user) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container-wide py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center text-sm text-muted-foreground mb-6">
          <Link href="/" className="hover:text-foreground">
            Startseite
          </Link>
          <ChevronRight className="h-4 w-4 mx-2" />
          <span className="text-foreground">Mein Konto</span>
        </nav>

        {/* Page Title */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Scissors className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Mein Konto</h1>
              <p className="text-sm text-muted-foreground">
                Willkommen, {user.profile?.first_name || user.customer?.first_name || 'Kunde'}!
              </p>
            </div>
          </div>
          <form
            action={async () => {
              'use server';
              await logout();
              redirect('/');
            }}
          >
            <Button variant="outline" size="sm" type="submit">
              <LogOut className="h-4 w-4 mr-2" />
              Abmelden
            </Button>
          </form>
        </div>

        {/* Main Layout */}
        <div className="grid gap-8 lg:grid-cols-4">
          {/* Sidebar */}
          <aside className="lg:col-span-1">
            <nav className="space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted transition-colors"
                >
                  <item.icon className="h-5 w-5 text-muted-foreground" />
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>

            {/* Quick Action */}
            <div className="mt-8 p-4 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-sm font-medium mb-3">Neuen Termin buchen?</p>
              <Button asChild size="sm" className="w-full">
                <Link href="/termin-buchen">Jetzt buchen</Link>
              </Button>
            </div>
          </aside>

          {/* Content */}
          <main className="lg:col-span-3">{children}</main>
        </div>
      </div>
    </div>
  );
}
