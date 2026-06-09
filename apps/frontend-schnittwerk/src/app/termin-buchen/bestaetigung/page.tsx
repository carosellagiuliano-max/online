import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  CheckCircle,
  Clock as ClockIcon,
  Calendar,
  Clock,
  User,
  MapPin,
  Mail,
  Phone,
  Home,
} from 'lucide-react';

// Force dynamic rendering (API not available at build time)
export const dynamic = 'force-dynamic';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { createServerClient } from '@/lib/db/client';
import { getSalon } from '@/lib/actions';
import { getCancellationDeadlineText } from '@/lib/domain/booking';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Buchung bestätigt',
  description: 'Ihre Terminbuchung bei BeautifyPRO wurde erfolgreich bestätigt.',
};

// ============================================
// PAGE COMPONENT
// ============================================

const DEFAULT_SALON_ID = '550e8400-e29b-41d4-a716-446655440001';
const SALON_ID = process.env.NEXT_PUBLIC_SALON_ID || DEFAULT_SALON_ID;

interface PageProps {
  searchParams: Promise<{ id?: string; nr?: string }>;
}

export default async function BookingConfirmationPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const appointmentId = params.id;

  if (!appointmentId) {
    redirect('/termin-buchen');
  }

  // Fetch salon data
  const salon = await getSalon();

  // Fetch appointment details if ID provided
  let appointment: any = null;
  let requiresApproval = false;
  let cancellationDeadlineText = getCancellationDeadlineText(24);
  const supabase = createServerClient();
  if (supabase) {
    const { data } = await (supabase.from('appointments') as any)
      .select(`
        id,
        booking_number,
        start_time,
        end_time,
        total_cents,
        customer_name,
        customer_email,
        customer_phone,
        is_approved,
        salon_id,
        staff:staff_id (display_name),
        appointment_services (
          service_name,
          duration_minutes,
          price_cents
        )
      `)
      .eq('id', appointmentId)
      .eq('salon_id', SALON_ID)
      .single();

    appointment = data;

    // Check if approval is required (booking rule)
    if (appointment) {
      const { data: bookingRules } = await (supabase.from('booking_rules') as any)
        .select('require_appointment_approval, cancellation_deadline_hours')
        .eq('salon_id', appointment.salon_id)
        .single();

      requiresApproval = bookingRules?.require_appointment_approval === true && !appointment.is_approved;
      cancellationDeadlineText = getCancellationDeadlineText(bookingRules?.cancellation_deadline_hours ?? 24);
    }
  }

  if (!appointment) {
    notFound();
  }

  const formatPrice = (cents: number) => `CHF ${(cents / 100).toFixed(2)}`;

  const displayData = {
    bookingNumber: params.nr || appointment.booking_number || appointment.id.slice(0, 8).toUpperCase(),
    date: format(new Date(appointment.start_time), 'EEEE, d. MMMM yyyy', { locale: de }),
    time: `${format(new Date(appointment.start_time), 'HH:mm')} - ${format(new Date(appointment.end_time), 'HH:mm')} Uhr`,
    staff: appointment.staff?.display_name || 'Ihr Stylist',
    services: appointment.appointment_services?.map((service: any) => service.service_name) || [],
    totalPrice: formatPrice(appointment.total_cents || 0),
    customerEmail: appointment.customer_email || 'Ihre E-Mail',
  };

  return (
    <div className="py-12">
      <div className="container-wide max-w-2xl">
        {/* Success Header */}
        <div className="text-center mb-8">
          {requiresApproval ? (
            <>
              <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30 mb-6">
                <ClockIcon className="h-10 w-10 text-amber-600 dark:text-amber-400" />
              </div>
              <h1 className="text-3xl font-bold mb-2">Terminanfrage eingegangen</h1>
              <p className="text-muted-foreground">
                Vielen Dank für Ihre Anfrage. Sie erhalten demnächst eine Bestätigung per E-Mail.
              </p>
            </>
          ) : (
            <>
              <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 mb-6">
                <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
              </div>
              <h1 className="text-3xl font-bold mb-2">Buchung bestätigt!</h1>
              <p className="text-muted-foreground">
                Vielen Dank für Ihre Buchung bei {salon?.name || 'BeautifyPRO'}.
              </p>
            </>
          )}
        </div>

        {/* Booking Details */}
        <Card className="border-border/50 mb-8">
          <CardContent className="p-6 sm:p-8">
            {/* Booking Number */}
            <div className="text-center mb-6 pb-6 border-b">
              <p className="text-sm text-muted-foreground mb-1">
                Buchungsnummer
              </p>
              <p className="text-2xl font-bold text-primary">
                {displayData.bookingNumber}
              </p>
            </div>

            {/* Details Grid */}
            <div className="space-y-4">
              {/* Date & Time */}
              <div className="flex items-start gap-4">
                <Calendar className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">{displayData.date}</p>
                  <p className="text-sm text-muted-foreground">
                    {displayData.time}
                  </p>
                </div>
              </div>

              {/* Staff */}
              <div className="flex items-start gap-4">
                <User className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">{displayData.staff}</p>
                  <p className="text-sm text-muted-foreground">Ihr Stylist</p>
                </div>
              </div>

              {/* Location */}
              <div className="flex items-start gap-4">
                <MapPin className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">{salon?.name || 'BeautifyPRO'}</p>
                  <p className="text-sm text-muted-foreground">
                    {salon?.address}, {salon?.zipCode} {salon?.city}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Services */}
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Gebuchte Leistungen
                </p>
                <ul className="space-y-1">
                  {displayData.services.map((service: string, idx: number) => (
                    <li key={idx} className="font-medium">
                      {service}
                    </li>
                  ))}
                </ul>
              </div>

              <Separator />

              {/* Total */}
              <div className="flex justify-between items-center">
                <span className="font-medium">Gesamtbetrag</span>
                <span className="text-xl font-bold text-primary">
                  {displayData.totalPrice}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Confirmation Email Notice */}
        <Card className={`border-border/50 mb-8 ${requiresApproval ? 'bg-amber-50/50 dark:bg-amber-900/10' : 'bg-muted/30'}`}>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <Mail className={`h-5 w-5 mt-0.5 ${requiresApproval ? 'text-amber-600 dark:text-amber-400' : 'text-primary'}`} />
              <div>
                {requiresApproval ? (
                  <>
                    <p className="font-medium mb-1">Bestätigung ausstehend</p>
                    <p className="text-sm text-muted-foreground">
                      Sobald Ihr Termin von uns geprüft und bestätigt wurde, erhalten Sie eine E-Mail an{' '}
                      <span className="font-medium">{displayData.customerEmail}</span>.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-medium mb-1">Bestätigung per E-Mail</p>
                    <p className="text-sm text-muted-foreground">
                      Wir haben Ihnen eine Bestätigung an{' '}
                      <span className="font-medium">{displayData.customerEmail}</span>{' '}
                      gesendet. Bitte überprüfen Sie auch Ihren Spam-Ordner.
                    </p>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Important Notes */}
        <Card className="border-border/50 mb-8">
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4">Wichtige Hinweise</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <Clock className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                Bitte erscheinen Sie pünktlich zu Ihrem Termin.
              </li>
              <li className="flex items-start gap-2">
                <Calendar className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                {cancellationDeadlineText}
              </li>
              <li className="flex items-start gap-2">
                <Phone className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                Bei Fragen erreichen Sie uns unter {salon?.phone || '+41 71 222 81 82'}.
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button variant="outline" asChild>
            <Link href="/">
              <Home className="mr-2 h-4 w-4" />
              Zur Startseite
            </Link>
          </Button>
          <Button asChild>
            <Link href="/kontakt">
              <Phone className="mr-2 h-4 w-4" />
              Kontakt
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
