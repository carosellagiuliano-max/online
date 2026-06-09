'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Calendar,
  User,
  MapPin,
  Loader2,
  AlertCircle,
  CheckCircle,
  Check,
  LogIn,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useBooking } from '../booking-context';
import { useAuth } from '@/lib/auth/context';
import { DEFAULT_BOOKING_TIME_ZONE, type BookingRules } from '@/lib/domain/booking';

// ============================================
// CONFIRMATION STEP
// ============================================

interface ConfirmationProps {
  salonAddress?: string;
  onSubmit: () => Promise<void>;
  timeZone?: string;
  bookingRules?: BookingRules;
}

export function Confirmation({
  salonAddress = 'Musterstrasse 123, 9000 St. Gallen',
  onSubmit,
  timeZone = DEFAULT_BOOKING_TIME_ZONE,
  bookingRules,
}: ConfirmationProps) {
  const {
    state,
    updateCustomerInfo,
    goBack,
    canProceed,
    totalPrice,
    totalDuration,
  } = useBooking();

  const { user, profile, isAuthenticated, isLoading: authLoading } = useAuth();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const phoneRequired = bookingRules?.requirePhoneForBooking ?? true;
  const canSubmit = canProceed && (!phoneRequired || state.customerInfo.phone.trim() !== '');

  // Pre-fill customer info from authenticated user
  useEffect(() => {
    if (isAuthenticated && !state.customerInfo.email) {
      const fullName = profile?.first_name && profile?.last_name
        ? `${profile.first_name} ${profile.last_name}`
        : profile?.display_name || user?.email?.split('@')[0] || '';

      updateCustomerInfo({
        name: fullName,
        email: profile?.email || user?.email || '',
        phone: profile?.phone || '',
      });
    }
  }, [isAuthenticated, profile, user, state.customerInfo.email, updateCustomerInfo]);

  const formatPrice = (cents: number) => {
    return `CHF ${(cents / 100).toFixed(2)}`;
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} Min.`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours} Std. ${mins} Min.` : `${hours} Std.`;
  };

  const formatAppointmentDate = (date: Date) =>
    new Intl.DateTimeFormat('de-CH', {
      timeZone,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);

  const formatAppointmentTime = (date: Date) =>
    new Intl.DateTimeFormat('de-CH', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(date);

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await onSubmit();
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-2">Buchung bestätigen</h2>
        <p className="text-muted-foreground">
          Überprüfen Sie Ihre Angaben und vervollständigen Sie die Buchung.
        </p>
      </div>

      <div className="booking-confirmation-grid grid gap-6 lg:gap-8 lg:grid-cols-2 items-start">
        {/* Left Column - Forms */}
        <div className="booking-form-stack space-y-6">
          {/* Appointment Summary */}
          <Card className="border-border/50">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Ihr Termin</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Date & Time */}
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">
                    {state.selectedSlot && formatAppointmentDate(state.selectedSlot.startsAt)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {state.selectedSlot &&
                      formatAppointmentTime(state.selectedSlot.startsAt)}{' '}
                    -{' '}
                    {state.selectedSlot &&
                      formatAppointmentTime(state.selectedSlot.endsAt)}{' '}
                    Uhr
                  </p>
                </div>
              </div>

              {/* Staff */}
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">
                    {state.noStaffPreference
                      ? 'Wird zugewiesen'
                      : state.selectedSlot?.staffName || 'Noch nicht ausgewählt'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {state.noStaffPreference ? 'Keine Präferenz' : 'Ihr Stylist'}
                  </p>
                </div>
              </div>

              {/* Location */}
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">BeautifyPRO</p>
                  <p className="text-sm text-muted-foreground">{salonAddress}</p>
                </div>
              </div>

              {/* Services */}
              <Separator />
              <div className="space-y-2">
                {state.selectedServices.map((service) => (
                  <div key={service.id} className="flex justify-between text-sm">
                    <span>{service.name}</span>
                    <span className="text-muted-foreground">
                      {formatPrice(service.currentPrice)}
                    </span>
                  </div>
                ))}
              </div>
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Gesamt ({formatDuration(totalDuration)})</span>
                <span className="text-primary">{formatPrice(totalPrice)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Customer Info - Only show for guests */}
          {authLoading ? (
            /* Auth is loading - show minimal loading state */
            <Card className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Lade Kontodaten...</span>
                </div>
              </CardContent>
            </Card>
          ) : isAuthenticated ? (
            /* Logged in: Just show a small indicator and optional notes */
            <Card className="border-border/50">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Check className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      Angemeldet als {profile?.first_name || ''} {profile?.last_name || user?.email || ''}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-xs">Angemeldet</Badge>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefon{phoneRequired ? ' *' : ''}</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+41 79 123 45 67"
                    value={state.customerInfo.phone}
                    onChange={(e) =>
                      updateCustomerInfo({ phone: e.target.value })
                    }
                    required={phoneRequired}
                  />
                  <p className="text-xs text-muted-foreground">
                    {phoneRequired
                      ? 'Für Terminbestätigungen und Rückfragen'
                      : 'Optional für kurzfristige Rückfragen'}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes" className="text-sm">Anmerkungen (optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="z.B. spezielle Wünsche oder Hinweise..."
                    rows={2}
                    value={state.customerInfo.notes}
                    onChange={(e) =>
                      updateCustomerInfo({ notes: e.target.value })
                    }
                  />
                </div>
              </CardContent>
            </Card>
          ) : (
          <Card className="border-border/50">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Ihre Kontaktdaten</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                  {/* Login option for returning customers */}
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 border border-border mb-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <LogIn className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">Bereits Kunde?</p>
                      <p className="text-xs text-muted-foreground">
                        Melden Sie sich an, um Termine in Ihrem Konto zu verwalten
                      </p>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/konto/login?redirect=${encodeURIComponent('/termin-buchen')}`}>
                        Anmelden
                      </Link>
                    </Button>
                  </div>

                  <Separator className="my-4" />
                  <p className="text-sm text-muted-foreground mb-4">Oder als Gast fortfahren:</p>

                  <div className="booking-form-grid grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name *</Label>
                      <Input
                        id="name"
                        placeholder="Vor- und Nachname"
                        value={state.customerInfo.name}
                        onChange={(e) =>
                          updateCustomerInfo({ name: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Telefon{phoneRequired ? ' *' : ''}</Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="+41 79 123 45 67"
                        value={state.customerInfo.phone}
                        onChange={(e) =>
                          updateCustomerInfo({ phone: e.target.value })
                        }
                        required={phoneRequired}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">E-Mail *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="ihre@email.ch"
                      value={state.customerInfo.email}
                      onChange={(e) =>
                        updateCustomerInfo({ email: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Anmerkungen (optional)</Label>
                    <Textarea
                      id="notes"
                      placeholder="z.B. spezielle Wünsche oder Hinweise..."
                      rows={3}
                      value={state.customerInfo.notes}
                      onChange={(e) =>
                        updateCustomerInfo({ notes: e.target.value })
                      }
                    />
                  </div>
            </CardContent>
          </Card>
          )}
        </div>

        {/* Right Column - Payment & Confirm */}
        <div className="booking-form-stack space-y-6">
          {/* Payment Method */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Zahlungsart</CardTitle>
            </CardHeader>
            <CardContent className="pt-2 space-y-2">
              <div className="w-full flex items-center gap-3 p-3 rounded-lg border-2 border-primary bg-primary/5 text-left">
                <div className="h-4 w-4 rounded-full border-2 border-primary flex items-center justify-center">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                </div>
                <span className="text-sm">Vor Ort bezahlen (Bar, Karte oder TWINT)</span>
              </div>
            </CardContent>
          </Card>

          {/* Terms & Conditions */}
          <label
            htmlFor="terms"
            className="flex items-start gap-3 p-4 rounded-lg border border-border/50 bg-card cursor-pointer"
          >
            <Checkbox
              id="terms"
              checked={state.customerInfo.acceptTerms}
              onCheckedChange={(checked) =>
                updateCustomerInfo({ acceptTerms: checked as boolean })
              }
              className="mt-1 shrink-0"
            />
            <span className="text-sm text-muted-foreground leading-relaxed">
              Ich akzeptiere die{' '}
              <Link href="/agb" className="text-primary hover:underline">
                AGB
              </Link>{' '}
              und{' '}
              <Link
                href="/datenschutz"
                className="text-primary hover:underline"
              >
                Datenschutzerklärung
              </Link>
              . Ich bin damit einverstanden, Terminerinnerungen per E-Mail
              und SMS zu erhalten.
            </span>
          </label>

          {/* Error Message */}
          {submitError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}

          {/* Submit Button */}
          <Button
            size="lg"
            className="w-full btn-glow"
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Buchung wird verarbeitet...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-5 w-5" />
                Termin verbindlich buchen
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Back Button */}
      <div className="pt-4 border-t">
        <Button variant="outline" onClick={goBack} disabled={isSubmitting}>
          Zurück
        </Button>
      </div>
    </div>
  );
}
