'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function CompleteStep() {
  const [countdown, setCountdown] = useState(5);

  const redirectToAdmin = () => {
    // Use hard redirect to ensure page fully reloads and picks up new setup state
    window.location.href = '/admin';
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          redirectToAdmin();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="text-center space-y-6 py-12">
      <div className="flex justify-center">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <CheckCircle2 className="w-12 h-12 text-primary" />
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">Setup abgeschlossen!</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Ihr Salon wurde erfolgreich eingerichtet. Sie können jetzt das Admin-Dashboard
          verwenden, um weitere Einstellungen vorzunehmen, Mitarbeiter hinzuzufügen
          und Termine zu verwalten.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Weiterleitung in {countdown} Sekunden...</span>
        </div>

        <Button onClick={redirectToAdmin} size="lg">
          Zum Admin-Dashboard
        </Button>
      </div>
    </div>
  );
}
