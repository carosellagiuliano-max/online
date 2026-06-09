'use client';

import { Clock, User, Calendar, CreditCard } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useBooking } from './booking-context';
import { DEFAULT_BOOKING_TIME_ZONE, type BookingRules } from '@/lib/domain/booking';

// ============================================
// BOOKING SUMMARY SIDEBAR
// ============================================

interface BookingSummaryProps {
  timeZone?: string;
  bookingRules?: BookingRules;
}

export function BookingSummary({
  timeZone = DEFAULT_BOOKING_TIME_ZONE,
  bookingRules,
}: BookingSummaryProps) {
  const { state, totalDuration, totalPrice } = useBooking();

  const formatPrice = (cents: number) => {
    return `CHF ${(cents / 100).toFixed(2)}`;
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} Min.`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours} Std. ${mins} Min.` : `${hours} Std.`;
  };

  const formatAppointmentSummary = (date: Date) => {
    const dateText = new Intl.DateTimeFormat('de-CH', {
      timeZone,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).format(date);
    const timeText = new Intl.DateTimeFormat('de-CH', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(date);

    return `${dateText} ${timeText} Uhr`;
  };

  return (
    <Card className="border-border/50 sticky top-24">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Ihre Auswahl</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Selected Services */}
        {state.selectedServices.length > 0 ? (
          <div className="space-y-3">
            {state.selectedServices.map((service) => (
              <div key={service.id} className="flex justify-between text-sm">
                <div>
                  <p className="font-medium">{service.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {service.durationMinutes} Min.
                  </p>
                </div>
                <span className="text-primary font-medium">
                  {formatPrice(service.currentPrice)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Noch keine Leistung ausgewählt
          </p>
        )}

        <Separator />

        {/* Duration */}
        {totalDuration > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Dauer:</span>
            <span className="font-medium">{formatDuration(totalDuration)}</span>
          </div>
        )}

        {/* Selected Staff */}
        {(state.selectedStaff || state.noStaffPreference) && (
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Mitarbeiter:</span>
            <span className="font-medium">
              {state.noStaffPreference
                ? 'Keine Präferenz'
                : state.selectedStaff?.name}
            </span>
          </div>
        )}

        {/* Selected Slot */}
        {state.selectedSlot && (
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Termin:</span>
            <span className="font-medium">
              {formatAppointmentSummary(state.selectedSlot.startsAt)}
            </span>
          </div>
        )}

        {/* Payment Method (on confirm step) */}
        {state.currentStep === 'confirm' && (
          <div className="flex items-center gap-2 text-sm">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Zahlung:</span>
            <span className="font-medium">
              {state.paymentMethod === 'online'
                ? 'Online bezahlen'
                : 'Vor Ort bezahlen'}
            </span>
          </div>
        )}

        <Separator />

        {/* Total */}
        <div className="flex justify-between items-center">
          <span className="font-semibold">Gesamt</span>
          <span className="text-xl font-bold text-primary">
            {formatPrice(totalPrice)}
          </span>
        </div>

        {/* VAT Info */}
        <p className="text-xs text-muted-foreground text-right">
          inkl. 8.1% MwSt.
        </p>

        {state.currentStep === 'confirm' && bookingRules?.requireAppointmentApproval && (
          <div className="rounded-md bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
            Ihre Buchung wird als Anfrage übermittelt und erst nach Prüfung durch den Salon bestätigt.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
