import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Scissors } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoginForm } from '@/components/auth';
import { getCurrentUser } from '@/lib/actions';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Anmelden',
  description: 'Melden Sie sich bei Ihrem BeautifyPRO Kundenkonto an.',
};

// ============================================
// PAGE COMPONENT
// ============================================

interface PageProps {
  searchParams: Promise<{ redirect?: string }>;
}

export default async function LoginPage({ searchParams }: PageProps) {
  // Check if already logged in
  const user = await getCurrentUser();
  if (user) {
    redirect('/konto');
  }

  const params = await searchParams;

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <Scissors className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold">BeautifyPRO</span>
          </Link>
        </div>

        {/* Login Card */}
        <Card className="border-border/50">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl">Willkommen zurück</CardTitle>
            <p className="text-sm text-muted-foreground">
              Melden Sie sich bei Ihrem Konto an
            </p>
          </CardHeader>
          <CardContent className="pt-6">
            <LoginForm redirectTo={params.redirect} />
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-sm text-muted-foreground mt-8">
          <Link href="/" className="hover:text-primary">
            Zurück zur Startseite
          </Link>
        </p>
      </div>
    </div>
  );
}
