import type { Metadata } from 'next';
import Link from 'next/link';
import { Scissors } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NewPasswordForm } from '@/components/auth';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Neues Passwort',
  description: 'Legen Sie ein neues Passwort für Ihr BeautifyPRO Konto fest.',
};

// ============================================
// PAGE COMPONENT
// ============================================

export default function NewPasswordPage() {
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

        {/* New Password Card */}
        <Card className="border-border/50">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl">Neues Passwort</CardTitle>
            <p className="text-sm text-muted-foreground">
              Geben Sie Ihr neues Passwort ein
            </p>
          </CardHeader>
          <CardContent className="pt-6">
            <NewPasswordForm />
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
