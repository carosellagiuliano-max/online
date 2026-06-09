import type { Metadata } from 'next';
import { addDays } from 'date-fns';
import { BookingFlow } from '@/components/booking';
import {
  getBookingPageData,
  getExistingAppointments,
  getStaffAbsencesForDateRange,
  getBlockedTimes,
} from '@/lib/actions';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

// Force dynamic rendering - database not available during build
export const dynamic = 'force-dynamic';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Termin buchen',
  description:
    'Buchen Sie Ihren Friseurtermin online bei BeautifyPRO St. Gallen. Schnell, einfach und bequem – wählen Sie Ihren Wunschtermin.',
};

// ============================================
// PAGE COMPONENT
// ============================================

export default async function TerminBuchenPage() {
  // Fetch booking data from database
  const bookingData = await getBookingPageData();

  if (!bookingData) {
    return (
      <div className="container-wide py-16">
        <Card className="max-w-md mx-auto">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">
              Buchung nicht verfügbar
            </h2>
            <p className="text-muted-foreground">
              Die Online-Buchung ist derzeit nicht verfügbar. Bitte kontaktieren
              Sie uns telefonisch.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fetch availability data for the booking horizon
  const now = new Date();
  const startDate = now.toISOString();
  const horizonDays = bookingData.bookingRules?.horizonDays || 90;
  const endDate = addDays(now, horizonDays).toISOString();

  // Fetch existing appointments, absences, and blocked times in parallel
  const [existingAppointments, staffAbsences, blockedTimes] = await Promise.all([
    getExistingAppointments(bookingData.salonId, startDate, endDate),
    getStaffAbsencesForDateRange(bookingData.salonId, startDate, endDate, bookingData.timeZone),
    getBlockedTimes(bookingData.salonId, startDate, endDate),
  ]);

  return (
    <BookingFlow
      salonId={bookingData.salonId}
      services={bookingData.services}
      staff={bookingData.staff}
      categories={bookingData.categories}
      openingHours={bookingData.openingHours}
      staffWorkingHours={bookingData.staffWorkingHours}
      staffAbsences={staffAbsences}
      blockedTimes={blockedTimes}
      existingAppointments={existingAppointments}
      bookingRules={bookingData.bookingRules}
      salonAddress={bookingData.salonAddress}
      timeZone={bookingData.timeZone}
    />
  );
}
