'use client';

import { Loader2, Clock, Coffee, ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useSetup } from '../setup-context';
import { createOpeningHours } from '@/lib/actions/setup';
import { DAY_NAMES } from '@/lib/setup/schemas';
import { cn } from '@/lib/utils';

export function HoursStep() {
  const { state, updateOpeningHour, goBack, goNext, setSubmitting, setError, canProceed } = useSetup();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canProceed) return;

    setSubmitting(true);
    setError(null);

    const result = await createOpeningHours(state.openingHours);

    setSubmitting(false);

    if (result.success) {
      goNext();
    } else {
      setError(result.error || 'Fehler beim Speichern der Öffnungszeiten');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">Öffnungszeiten</h2>
        <p className="text-muted-foreground">
          Legen Sie die regulären Öffnungszeiten Ihres Salons fest.
        </p>
      </div>

      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-3">
        {state.openingHours.map((hour) => (
          <div
            key={hour.dayOfWeek}
            className={cn(
              "rounded-xl border bg-card p-4 transition-all",
              hour.isOpen
                ? "border-primary/20 shadow-sm"
                : "border-muted bg-muted/30"
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Switch
                  checked={hour.isOpen}
                  onCheckedChange={(checked) =>
                    updateOpeningHour(hour.dayOfWeek, { isOpen: checked })
                  }
                />
                <span className={cn(
                  "font-medium min-w-[100px]",
                  !hour.isOpen && "text-muted-foreground"
                )}>
                  {DAY_NAMES[hour.dayOfWeek]}
                </span>
              </div>

              {!hour.isOpen && (
                <span className="text-sm text-muted-foreground">Geschlossen</span>
              )}

              {hour.isOpen && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor={`open-${hour.dayOfWeek}`} className="sr-only">
                    Öffnung
                  </Label>
                  <Input
                    id={`open-${hour.dayOfWeek}`}
                    type="time"
                    value={hour.openTime}
                    onChange={(e) =>
                      updateOpeningHour(hour.dayOfWeek, { openTime: e.target.value })
                    }
                    className="w-[110px] h-9"
                  />
                  <span className="text-muted-foreground">–</span>
                  <Label htmlFor={`close-${hour.dayOfWeek}`} className="sr-only">
                    Schliessung
                  </Label>
                  <Input
                    id={`close-${hour.dayOfWeek}`}
                    type="time"
                    value={hour.closeTime}
                    onChange={(e) =>
                      updateOpeningHour(hour.dayOfWeek, { closeTime: e.target.value })
                    }
                    className="w-[110px] h-9"
                  />
                </div>
              )}
            </div>

            {hour.isOpen && (
              <div className="mt-4 pt-4 border-t border-dashed flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id={`lunch-${hour.dayOfWeek}`}
                    checked={hour.hasLunchBreak}
                    onCheckedChange={(checked) =>
                      updateOpeningHour(hour.dayOfWeek, {
                        hasLunchBreak: checked,
                        lunchStart: checked ? '12:00' : null,
                        lunchEnd: checked ? '13:00' : null,
                      })
                    }
                  />
                  <Label
                    htmlFor={`lunch-${hour.dayOfWeek}`}
                    className="flex items-center gap-1.5 text-sm cursor-pointer"
                  >
                    <Coffee className="h-3.5 w-3.5 text-muted-foreground" />
                    Mittagspause
                  </Label>
                </div>

                {hour.hasLunchBreak && (
                  <div className="flex items-center gap-2 ml-auto">
                    <Input
                      type="time"
                      value={hour.lunchStart || '12:00'}
                      onChange={(e) =>
                        updateOpeningHour(hour.dayOfWeek, { lunchStart: e.target.value })
                      }
                      className="w-[110px] h-9"
                    />
                    <span className="text-muted-foreground">–</span>
                    <Input
                      type="time"
                      value={hour.lunchEnd || '13:00'}
                      onChange={(e) =>
                        updateOpeningHour(hour.dayOfWeek, { lunchEnd: e.target.value })
                      }
                      className="w-[110px] h-9"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {!canProceed && (
        <p className="text-sm text-destructive">
          Mindestens ein Tag muss geöffnet sein
        </p>
      )}

      <div className="flex justify-between pt-6 border-t">
        <Button
          type="button"
          variant="ghost"
          onClick={goBack}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Zurück
        </Button>
        <Button
          type="submit"
          disabled={!canProceed || state.isSubmitting}
          className="gap-2"
        >
          {state.isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Wird gespeichert...
            </>
          ) : (
            <>
              Weiter
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
