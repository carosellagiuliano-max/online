'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { addDays } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BookingProvider, useBooking } from './booking-context';
import { BookingProgress } from './booking-progress';
import { BookingSummary } from './booking-summary';
import {
  ServiceSelection,
  StaffSelection,
  TimeSelection,
  Confirmation,
} from './steps';
import {
  computeAvailableSlots,
  type BookableService,
  type BookableStaff,
  type AvailableSlot,
  type DayOpeningHours,
  type StaffWorkingHours,
  type StaffAbsence,
  type BlockedTime,
  type ExistingAppointment,
  type BookingRules,
} from '@/lib/domain/booking';
import {
  createAppointmentReservation,
  confirmAppointment,
} from '@/lib/actions';

// ============================================
// BOOKING FLOW MAIN COMPONENT
// ============================================

interface BookingFlowProps {
  salonId: string;
  services: BookableService[];
  staff: BookableStaff[];
  categories?: { id: string; name: string }[];
  // Data for slot calculation
  openingHours: DayOpeningHours[];
  staffWorkingHours: StaffWorkingHours[];
  staffAbsences: StaffAbsence[];
  blockedTimes: BlockedTime[];
  existingAppointments: ExistingAppointment[];
  bookingRules?: BookingRules;
  salonAddress?: string;
  timeZone?: string;
}

export function BookingFlow(props: BookingFlowProps) {
  return (
    <BookingProvider salonId={props.salonId}>
      <BookingFlowContent {...props} />
    </BookingProvider>
  );
}

// ============================================
// BOOKING FLOW CONTENT
// ============================================

function BookingFlowContent({
  salonId,
  services,
  staff,
  categories,
  openingHours,
  staffWorkingHours,
  staffAbsences,
  blockedTimes,
  existingAppointments,
  bookingRules,
  salonAddress,
  timeZone,
}: BookingFlowProps) {
  const router = useRouter();
  const { state, setLoading, setError, reset } = useBooking();

  // Slots state
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  const getAvailableSlots = useCallback(async (): Promise<AvailableSlot[]> => {
    if (state.selectedServices.length === 0) return [];

    const now = new Date();
    const horizonDays = bookingRules?.horizonDays || 90;

    return computeAvailableSlots(
      {
        salonId,
        dateRangeStart: now,
        dateRangeEnd: addDays(now, horizonDays),
        serviceIds: state.selectedServices.map((s) => s.id),
        preferredStaffId: state.selectedStaff?.id,
        timeZone,
      },
      {
        services: state.selectedServices,
        openingHours,
        staff,
        staffWorkingHours,
        staffAbsences,
        blockedTimes,
        existingAppointments,
        bookingRules,
      }
    );
  }, [
    salonId,
    state.selectedServices,
    state.selectedStaff,
    openingHours,
    staff,
    staffWorkingHours,
    staffAbsences,
    blockedTimes,
    existingAppointments,
    bookingRules,
    timeZone,
  ]);

  // Load slots when entering time selection step
  const loadSlots = useCallback(async () => {
    if (state.selectedServices.length === 0) return;

    setSlotsLoading(true);
    setSlotsError(null);

    try {
      setSlots(await getAvailableSlots());
    } catch (error) {
      console.error('Failed to load slots:', error);
      setSlotsError(
        'Termine konnten nicht geladen werden. Bitte versuchen Sie es erneut.'
      );
    } finally {
      setSlotsLoading(false);
    }
  }, [
    state.selectedServices,
    getAvailableSlots,
  ]);

  // Load slots when entering time step
  useEffect(() => {
    if (state.currentStep === 'time') {
      loadSlots();
    }
  }, [state.currentStep, loadSlots]);

  // Handle booking submission
  const handleSubmit = async () => {
    if (!state.selectedSlot) {
      throw new Error('Bitte wählen Sie einen Termin aus.');
    }

    if (!state.customerInfo.name || !state.customerInfo.email) {
      throw new Error('Bitte füllen Sie alle Pflichtfelder aus.');
    }

    if ((bookingRules?.requirePhoneForBooking ?? true) && !state.customerInfo.phone.trim()) {
      throw new Error('Bitte geben Sie eine Telefonnummer an.');
    }

    const normalizedSelectedStart = new Date(state.selectedSlot.startsAt);
    normalizedSelectedStart.setSeconds(0, 0);

    const latestSlots = await getAvailableSlots();
    const currentSlot = latestSlots.find(
      (slot) =>
        slot.staffId === state.selectedSlot?.staffId &&
        slot.startsAt.getTime() === normalizedSelectedStart.getTime()
    );

    if (!currentSlot) {
      throw new Error('Dieser Termin ist leider nicht mehr verfügbar. Bitte wählen Sie einen anderen Zeitpunkt.');
    }

    // 1. Create reservation in database
    // If "Keine Präferenz" was selected, don't assign a staff member - admin will assign later
    const reservationResult = await createAppointmentReservation({
      salonId,
      serviceIds: state.selectedServices.map((s) => s.id),
      serviceSelections: state.selectedServices.map((s) => ({
        serviceId: s.id,
        lengthVariantId: s.selectedVariantId || null,
      })),
      staffId: state.noStaffPreference ? null : currentSlot.staffId,
      startsAt: currentSlot.startsAt,
      customerName: state.customerInfo.name,
      customerEmail: state.customerInfo.email,
      customerPhone: state.customerInfo.phone,
      notes: state.customerInfo.notes,
      paymentMethod: state.paymentMethod,
    });

    if (!reservationResult.success || !reservationResult.appointmentId) {
      throw new Error(reservationResult.error || 'Fehler beim Erstellen der Reservierung.');
    }

    // 2. Confirm the appointment
    const confirmation = await confirmAppointment(reservationResult.appointmentId);

    if ('error' in confirmation) {
      throw new Error(confirmation.error);
    }

    // 3. Clear booking state so a fresh form loads next time
    reset();

    // 4. Redirect to success page with booking details
    const params = new URLSearchParams({
      id: confirmation.appointmentId,
      nr: confirmation.bookingNumber,
    });
    router.push(`/termin-buchen/bestaetigung?${params.toString()}`);
  };

  // Render current step
  const renderStep = () => {
    switch (state.currentStep) {
      case 'services':
        return (
          <ServiceSelection services={services} categories={categories} />
        );
      case 'staff':
        return <StaffSelection staff={staff} staffAbsences={staffAbsences} />;
      case 'time':
        return (
          <TimeSelection
            slots={slots}
            isLoading={slotsLoading}
            error={slotsError}
            onRefreshSlots={loadSlots}
            staffAbsences={staffAbsences}
            staff={staff}
            blockedTimes={blockedTimes}
            timeZone={timeZone}
          />
        );
      case 'confirm':
        return (
          <Confirmation
            salonAddress={salonAddress}
            onSubmit={handleSubmit}
            timeZone={timeZone}
            bookingRules={bookingRules}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container-wide py-8">
        {/* Progress Indicator */}
        <div className="mb-8">
          <BookingProgress />
        </div>

        {/* Error Display */}
        {state.error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        {/* Main Content */}
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Step Content */}
          <div className="lg:col-span-2">{renderStep()}</div>

          {/* Sidebar Summary */}
          <div className="hidden lg:block">
            <BookingSummary timeZone={timeZone} bookingRules={bookingRules} />
          </div>
        </div>

        {/* Mobile Summary (collapsible) */}
        <div className="lg:hidden mt-8">
          <Card className="border-border/50">
            <CardContent className="p-4">
              <details>
                <summary className="font-semibold cursor-pointer">
                  Ihre Auswahl anzeigen
                </summary>
                <div className="mt-4">
                  <BookingSummary timeZone={timeZone} />
                </div>
              </details>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
