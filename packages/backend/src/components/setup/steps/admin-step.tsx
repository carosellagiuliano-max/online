'use client';

import { useState } from 'react';
import { Eye, EyeOff, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useSetup } from '../setup-context';
import { createAdminUser, resetSetup } from '@/lib/actions/setup';

export function AdminStep() {
  const { state, updateAdmin, setAdminUserId, goNext, setSubmitting, setError, canProceed } = useSetup();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleReset = async () => {
    if (!confirm('Möchten Sie wirklich alle Setup-Daten zurücksetzen? Diese Aktion kann nicht rückgängig gemacht werden.')) {
      return;
    }

    setIsResetting(true);
    setError(null);

    const result = await resetSetup();

    setIsResetting(false);

    if (result.success) {
      window.location.reload();
    } else {
      setError(result.error || 'Fehler beim Zurücksetzen');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canProceed) return;

    setSubmitting(true);
    setError(null);

    const result = await createAdminUser(state.admin);

    setSubmitting(false);

    if (result.success && result.data?.userId) {
      setAdminUserId(result.data.userId as string);
      goNext();
    } else {
      setError(result.error || 'Fehler beim Erstellen des Administrators');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">Administrator erstellen</h2>
        <p className="text-muted-foreground">
          Erstellen Sie Ihr Administratorkonto, um den Salon zu verwalten.
        </p>
      </div>

      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">Vorname</Label>
          <Input
            id="firstName"
            type="text"
            value={state.admin.firstName}
            onChange={(e) => updateAdmin({ firstName: e.target.value })}
            placeholder="Max"
            required
            autoComplete="given-name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="lastName">Nachname</Label>
          <Input
            id="lastName"
            type="text"
            value={state.admin.lastName}
            onChange={(e) => updateAdmin({ lastName: e.target.value })}
            placeholder="Mustermann"
            required
            autoComplete="family-name"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">E-Mail-Adresse</Label>
        <Input
          id="email"
          type="email"
          value={state.admin.email}
          onChange={(e) => updateAdmin({ email: e.target.value })}
          placeholder="admin@example.com"
          required
          autoComplete="email"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Passwort</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            value={state.admin.password}
            onChange={(e) => updateAdmin({ password: e.target.value })}
            placeholder="Mindestens 8 Zeichen"
            required
            autoComplete="new-password"
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {state.admin.password.length > 0 && state.admin.password.length < 8 && (
          <p className="text-sm text-destructive">Passwort muss mindestens 8 Zeichen lang sein</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Passwort bestätigen</Label>
        <div className="relative">
          <Input
            id="confirmPassword"
            type={showConfirmPassword ? 'text' : 'password'}
            value={state.admin.confirmPassword}
            onChange={(e) => updateAdmin({ confirmPassword: e.target.value })}
            placeholder="Passwort wiederholen"
            required
            autoComplete="new-password"
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {state.admin.confirmPassword.length > 0 &&
          state.admin.password !== state.admin.confirmPassword && (
            <p className="text-sm text-destructive">Passwörter stimmen nicht überein</p>
          )}
      </div>

      <div className="flex justify-between items-center pt-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleReset}
          disabled={isResetting}
          className="text-muted-foreground hover:text-destructive"
        >
          {isResetting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Wird zurückgesetzt...
            </>
          ) : (
            <>
              <RotateCcw className="mr-2 h-4 w-4" />
              Setup zurücksetzen
            </>
          )}
        </Button>
        <Button type="submit" disabled={!canProceed || state.isSubmitting}>
          {state.isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Wird erstellt...
            </>
          ) : (
            'Weiter'
          )}
        </Button>
      </div>
    </form>
  );
}
