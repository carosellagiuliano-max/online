'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Lock, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { updatePassword } from '@/lib/actions';

interface NewPasswordFormProps {
  returnHref?: string;
  returnLabel?: string;
}

export function NewPasswordForm({
  returnHref = '/konto/login',
  returnLabel = 'Zur Anmeldung',
}: NewPasswordFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(formData: FormData) {
    setIsLoading(true);
    setError(null);

    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (password !== confirmPassword) {
      setError('Passwörter stimmen nicht überein.');
      setIsLoading(false);
      return;
    }

    try {
      const result = await updatePassword(formData);

      if (!result.success) {
        setError(result.error || 'Passwort konnte nicht geändert werden.');
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
          <h2 className="text-xl font-semibold mb-2">Passwort geändert!</h2>
          <p className="text-muted-foreground">
            Ihr Passwort wurde erfolgreich aktualisiert. Sie können sich jetzt mit Ihrem neuen
            Passwort anmelden.
          </p>
        </div>
        <Button onClick={() => router.push(returnHref)}>{returnLabel}</Button>
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

      <div className="space-y-2">
        <Label htmlFor="password">Neues Passwort</Label>
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

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Passwort bestätigen</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            placeholder="••••••••"
            required
            minLength={8}
            disabled={isLoading}
            className="pl-10"
            autoComplete="new-password"
          />
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Speichern...
          </>
        ) : (
          'Passwort speichern'
        )}
      </Button>

      <div className="text-center">
        <Link href={returnHref} className="text-sm text-muted-foreground hover:text-primary">
          {returnLabel}
        </Link>
      </div>
    </form>
  );
}
