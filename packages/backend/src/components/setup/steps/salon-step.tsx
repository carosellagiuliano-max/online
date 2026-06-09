'use client';

import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useSetup } from '../setup-context';
import { createSalon } from '@/lib/actions/setup';

export function SalonStep() {
  const { state, updateSalon, goBack, goNext, setSubmitting, setError, canProceed } = useSetup();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canProceed) return;

    setSubmitting(true);
    setError(null);

    const result = await createSalon(state.salon);

    setSubmitting(false);

    if (result.success) {
      goNext();
    } else {
      setError(result.error || 'Fehler beim Erstellen des Salons');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">Salon-Informationen</h2>
        <p className="text-muted-foreground">
          Geben Sie die grundlegenden Informationen zu Ihrem Salon ein.
        </p>
      </div>

      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="salonName">Salonname</Label>
          <Input
            id="salonName"
            type="text"
            value={state.salon.name}
            onChange={(e) => updateSalon({ name: e.target.value })}
            placeholder="Mein Friseursalon"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="companyName">Firmenname</Label>
          <Input
            id="companyName"
            type="text"
            value={state.salon.companyName}
            onChange={(e) => updateSalon({ companyName: e.target.value })}
            placeholder="BeautifyPRO SG GmbH"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Adresse</Label>
        <Input
          id="address"
          type="text"
          value={state.salon.address}
          onChange={(e) => updateSalon({ address: e.target.value })}
          placeholder="Musterstrasse 123"
          required
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="zipCode">Postleitzahl</Label>
          <Input
            id="zipCode"
            type="text"
            value={state.salon.zipCode}
            onChange={(e) => updateSalon({ zipCode: e.target.value })}
            placeholder="8000"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="city">Stadt</Label>
          <Input
            id="city"
            type="text"
            value={state.salon.city}
            onChange={(e) => updateSalon({ city: e.target.value })}
            placeholder="Zürich"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="country">Land</Label>
          <Input
            id="country"
            type="text"
            value={state.salon.country}
            onChange={(e) => updateSalon({ country: e.target.value })}
            placeholder="Schweiz"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="salonPhone">Telefon</Label>
          <Input
            id="salonPhone"
            type="tel"
            value={state.salon.phone}
            onChange={(e) => updateSalon({ phone: e.target.value })}
            placeholder="+41 44 123 45 67"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="salonEmail">E-Mail</Label>
          <Input
            id="salonEmail"
            type="email"
            value={state.salon.email}
            onChange={(e) => updateSalon({ email: e.target.value })}
            placeholder="info@salon.ch"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="timezone">Zeitzone</Label>
          <Input
            id="timezone"
            type="text"
            value={state.salon.timezone}
            onChange={(e) => updateSalon({ timezone: e.target.value })}
            placeholder="Europe/Zurich"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="currency">Währung</Label>
          <Select
            value={state.salon.currency}
            onValueChange={(value) => updateSalon({ currency: value })}
          >
            <SelectTrigger id="currency">
              <SelectValue placeholder="Währung wählen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CHF">CHF</SelectItem>
              <SelectItem value="EUR">EUR</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="vatRate">MwSt.-Satz (%)</Label>
          <Input
            id="vatRate"
            type="number"
            step="0.1"
            value={state.salon.vatRate}
            onChange={(e) => updateSalon({ vatRate: parseFloat(e.target.value) || 0 })}
            placeholder="8.1"
          />
        </div>
      </div>

      <div className="flex justify-between pt-4">
        <Button type="button" variant="outline" onClick={goBack}>
          Zurück
        </Button>
        <Button type="submit" disabled={!canProceed || state.isSubmitting}>
          {state.isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Wird gespeichert...
            </>
          ) : (
            'Weiter'
          )}
        </Button>
      </div>
    </form>
  );
}
