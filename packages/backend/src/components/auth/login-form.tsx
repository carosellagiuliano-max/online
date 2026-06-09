'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Mail, Lock, AlertCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { loginCustomer } from '@/lib/actions';
import { MOCK_CUSTOMER_USER } from '@/lib/mock/mock-data';

interface LoginFormProps {
  redirectTo?: string;
}

const isMockMode = process.env.NEXT_PUBLIC_MOCK_MODE === 'true';

export function LoginForm({ redirectTo }: LoginFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setIsLoading(true);
    setError(null);

    try {
      if (isMockMode) {
        const email = String(formData.get('email') || '').trim().toLowerCase();
        const password = String(formData.get('password') || '');

        if (email === MOCK_CUSTOMER_USER.email && password === MOCK_CUSTOMER_USER.password) {
          localStorage.setItem('mock_user', JSON.stringify(MOCK_CUSTOMER_USER));
          localStorage.setItem('mock_session', 'true');
          document.cookie = 'mock_session=true; path=/; max-age=86400';
          document.cookie = `mock_user=${encodeURIComponent(JSON.stringify(MOCK_CUSTOMER_USER))}; path=/; max-age=86400`;
          await new Promise((resolve) => setTimeout(resolve, 300));
          router.push(redirectTo || '/konto');
          router.refresh();
          return;
        }

        setError('E-Mail oder Passwort ist falsch.');
        return;
      }

      const result = await loginCustomer(formData);

      if (!result.success) {
        setError(result.error || 'Anmeldung fehlgeschlagen.');
        return;
      }

      // Redirect to specified URL or default
      router.push(redirectTo || result.redirectTo || '/konto');
      router.refresh();
    } catch {
      setError('Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">E-Mail-Adresse</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="ihre@email.ch"
            defaultValue={isMockMode ? MOCK_CUSTOMER_USER.email : undefined}
            required
            disabled={isLoading}
            className="pl-10"
            autoComplete="email"
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Passwort</Label>
          <Link
            href="/konto/passwort-vergessen"
            className="text-sm text-primary hover:underline"
          >
            Passwort vergessen?
          </Link>
        </div>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="••••••••"
            defaultValue={isMockMode ? MOCK_CUSTOMER_USER.password : undefined}
            required
            disabled={isLoading}
            className="pl-10"
            autoComplete="current-password"
          />
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Anmelden...
          </>
        ) : (
          'Anmelden'
        )}
      </Button>

      {isMockMode && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-700">
          <div className="mb-1 flex items-center gap-2 font-semibold">
            <Info className="h-4 w-4" />
            Demo-Kundenlogin
          </div>
          <p className="font-mono">kunde@beautifypro.demo / beauty-kunde-demo</p>
        </div>
      )}

      <p className="text-center text-sm text-muted-foreground">
        Noch kein Konto?{' '}
        <Link href="/konto/registrieren" className="text-primary hover:underline">
          Jetzt registrieren
        </Link>
      </p>
    </form>
  );
}
