'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Mail, Lock, User, Phone, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { registerCustomer } from '@/lib/actions';

export function RegisterForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  async function handleSubmit(formData: FormData) {
    if (!acceptedTerms) {
      setError('Bitte akzeptieren Sie die AGB und Datenschutzbestimmungen.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await registerCustomer(formData);

      if (!result.success) {
        setError(result.error || 'Registrierung fehlgeschlagen.');
        return;
      }

      setSuccess(true);
    } catch {
      setError('Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setIsLoading(false);
    }
  }

  if (success) {
    return (
      <div className="text-center space-y-6">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <h2 className="text-xl font-semibold mb-2">Registrierung erfolgreich!</h2>
          <p className="text-muted-foreground">
            Wir haben Ihnen eine E-Mail zur Bestätigung gesendet. Bitte klicken Sie auf den Link
            in der E-Mail, um Ihr Konto zu aktivieren.
          </p>
        </div>
        <Button onClick={() => router.push('/konto/login')} variant="outline">
          Zur Anmeldung
        </Button>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="firstName">Vorname</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="firstName"
              name="firstName"
              type="text"
              placeholder="Max"
              required
              disabled={isLoading}
              className="pl-10"
              autoComplete="given-name"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="lastName">Nachname</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="lastName"
              name="lastName"
              type="text"
              placeholder="Muster"
              required
              disabled={isLoading}
              className="pl-10"
              autoComplete="family-name"
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">E-Mail-Adresse</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="max.muster@email.ch"
            required
            disabled={isLoading}
            className="pl-10"
            autoComplete="email"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Telefonnummer (optional)</Label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="phone"
            name="phone"
            type="tel"
            placeholder="+41 71 234 56 78"
            disabled={isLoading}
            className="pl-10"
            autoComplete="tel"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Passwort</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="••••••••"
            required
            minLength={8}
            disabled={isLoading}
            className="pl-10"
            autoComplete="new-password"
          />
        </div>
        <p className="text-xs text-muted-foreground">Mindestens 8 Zeichen</p>
      </div>

      <label className="flex items-center gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={acceptedTerms}
          onChange={(e) => setAcceptedTerms(e.target.checked)}
          disabled={isLoading}
          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
        />
        <span className="text-sm text-muted-foreground">
          Ich akzeptiere die{' '}
          <Link href="/agb" className="text-primary hover:underline" target="_blank">
            AGB
          </Link>{' '}
          und{' '}
          <Link href="/datenschutz" className="text-primary hover:underline" target="_blank">
            Datenschutzbestimmungen
          </Link>
        </span>
      </label>

      <Button type="submit" className="w-full" disabled={isLoading || !acceptedTerms}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Registrieren...
          </>
        ) : (
          'Konto erstellen'
        )}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Bereits ein Konto?{' '}
        <Link href="/konto/login" className="text-primary hover:underline">
          Jetzt anmelden
        </Link>
      </p>
    </form>
  );
}
