'use client';

import { useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSetup } from '../setup-context';
import { createServicesAndCategories, markSetupComplete } from '@/lib/actions/setup';

export function ServicesStep() {
  const {
    state,
    addCategory,
    updateCategory,
    removeCategory,
    addService,
    updateService,
    removeService,
    goBack,
    goNext,
    setSubmitting,
    setError,
    canProceed,
  } = useSetup();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canProceed || !state.adminUserId) return;

    setSubmitting(true);
    setError(null);

    // Filter out empty categories and services
    const filteredCategories = state.categories
      .filter((cat) => cat.name.trim().length >= 2)
      .map((cat) => ({
        ...cat,
        services: cat.services.filter((svc) => svc.name.trim().length >= 2),
      }))
      .filter((cat) => cat.services.length > 0);

    if (filteredCategories.length === 0) {
      setSubmitting(false);
      setError('Mindestens eine Kategorie mit einem Service erforderlich');
      return;
    }

    const result = await createServicesAndCategories(
      { categories: filteredCategories },
      state.adminUserId,
      { firstName: state.admin.firstName, lastName: state.admin.lastName }
    );

    if (!result.success) {
      setSubmitting(false);
      setError(result.error || 'Fehler beim Erstellen der Services');
      return;
    }

    // Mark setup as complete
    const completeResult = await markSetupComplete();

    setSubmitting(false);

    if (completeResult.success) {
      goNext();
    } else {
      setError(completeResult.error || 'Fehler beim Abschliessen des Setups');
    }
  };

  const formatPrice = (cents: number): string => {
    return (cents / 100).toFixed(2);
  };

  const parsePrice = (value: string): number => {
    const parsed = parseFloat(value.replace(',', '.'));
    return isNaN(parsed) ? 0 : Math.round(parsed * 100);
  };

  // Component for price input that manages local state to avoid cursor issues
  const PriceInput = ({
    id,
    priceCents,
    onChange,
  }: {
    id: string;
    priceCents: number;
    onChange: (cents: number) => void;
  }) => {
    const [localValue, setLocalValue] = useState(() => formatPrice(priceCents));
    const [isFocused, setIsFocused] = useState(false);

    return (
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        value={isFocused ? localValue : formatPrice(priceCents)}
        onChange={(e) => setLocalValue(e.target.value)}
        onFocus={() => {
          setIsFocused(true);
          setLocalValue(formatPrice(priceCents));
        }}
        onBlur={() => {
          setIsFocused(false);
          onChange(parsePrice(localValue));
        }}
        placeholder="0.00"
        required
      />
    );
  };

  // Component for duration input that manages local state to avoid cursor issues
  const DurationInput = ({
    id,
    duration,
    onChange,
  }: {
    id: string;
    duration: number;
    onChange: (minutes: number) => void;
  }) => {
    const [localValue, setLocalValue] = useState(() => String(duration));
    const [isFocused, setIsFocused] = useState(false);

    return (
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={5}
        max={480}
        value={isFocused ? localValue : duration}
        onChange={(e) => setLocalValue(e.target.value)}
        onFocus={() => {
          setIsFocused(true);
          setLocalValue(String(duration));
        }}
        onBlur={() => {
          setIsFocused(false);
          const parsed = parseInt(localValue);
          onChange(isNaN(parsed) ? 30 : Math.max(5, Math.min(480, parsed)));
        }}
        required
      />
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">Services einrichten</h2>
        <p className="text-muted-foreground">
          Erstellen Sie mindestens eine Kategorie mit einem Service. Sie können später weitere hinzufügen.
        </p>
      </div>

      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-6">
        {state.categories.map((category, catIndex) => (
          <Card key={category.tempId}>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Kategorie {catIndex + 1}</CardTitle>
                {state.categories.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeCategory(category.tempId!)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor={`cat-name-${category.tempId}`}>Kategoriename</Label>
                <Input
                  id={`cat-name-${category.tempId}`}
                  type="text"
                  value={category.name}
                  onChange={(e) => updateCategory(category.tempId!, e.target.value)}
                  placeholder="z.B. Damen Haarschnitt"
                  required
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {category.services.map((service, svcIndex) => (
                <div
                  key={service.tempId}
                  className="p-4 border rounded-lg bg-muted/30 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">
                      Service {svcIndex + 1}
                    </span>
                    {category.services.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeService(category.tempId!, service.tempId!)}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor={`svc-name-${service.tempId}`}>Name</Label>
                      <Input
                        id={`svc-name-${service.tempId}`}
                        type="text"
                        value={service.name}
                        onChange={(e) =>
                          updateService(category.tempId!, service.tempId!, { name: e.target.value })
                        }
                        placeholder="z.B. Waschen, Schneiden, Föhnen"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`svc-duration-${service.tempId}`}>Dauer (Min.)</Label>
                        <DurationInput
                          id={`svc-duration-${service.tempId}`}
                          duration={service.durationMinutes}
                          onChange={(minutes) =>
                            updateService(category.tempId!, service.tempId!, {
                              durationMinutes: minutes,
                            })
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`svc-price-${service.tempId}`}>Preis (CHF)</Label>
                        <PriceInput
                          id={`svc-price-${service.tempId}`}
                          priceCents={service.priceCents}
                          onChange={(cents) =>
                            updateService(category.tempId!, service.tempId!, {
                              priceCents: cents,
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`svc-desc-${service.tempId}`}>
                      Beschreibung <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <Textarea
                      id={`svc-desc-${service.tempId}`}
                      value={service.description || ''}
                      onChange={(e) =>
                        updateService(category.tempId!, service.tempId!, {
                          description: e.target.value,
                        })
                      }
                      placeholder="Kurze Beschreibung des Services..."
                      rows={2}
                    />
                  </div>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addService(category.tempId!)}
                className="w-full"
              >
                <Plus className="mr-2 h-4 w-4" />
                Service hinzufügen
              </Button>
            </CardContent>
          </Card>
        ))}

        <Button
          type="button"
          variant="outline"
          onClick={addCategory}
          className="w-full"
        >
          <Plus className="mr-2 h-4 w-4" />
          Kategorie hinzufügen
        </Button>
      </div>

      {!canProceed && (
        <p className="text-sm text-destructive">
          Mindestens eine Kategorie mit einem Service erforderlich
        </p>
      )}

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
            'Setup abschliessen'
          )}
        </Button>
      </div>
    </form>
  );
}
