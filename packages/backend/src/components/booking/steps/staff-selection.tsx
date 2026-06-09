'use client';

import { User, Check, Palmtree } from 'lucide-react';
import { format, addDays, isBefore, startOfDay } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { useBooking } from '../booking-context';
import type { BookableStaff, StaffAbsence } from '@/lib/domain/booking';

// ============================================
// STAFF SELECTION STEP
// ============================================

interface StaffSelectionProps {
  staff: BookableStaff[];
  staffAbsences?: StaffAbsence[];
}

export function StaffSelection({ staff, staffAbsences = [] }: StaffSelectionProps) {
  const {
    state,
    selectStaff,
    setNoPreference,
    goBack,
    goNext,
    canProceed,
  } = useBooking();

  // Filter staff that can perform all selected services
  const qualifiedStaff = staff.filter((s) =>
    state.selectedServices.every((service) =>
      s.serviceIds.includes(service.id)
    )
  );

  // Check if staff has upcoming absence in the next 30 days
  const getUpcomingAbsence = (staffId: string) => {
    const today = startOfDay(new Date());
    const horizon = addDays(today, 30);

    return staffAbsences.find(
      (a) =>
        a.staffId === staffId &&
        a.startsAt <= horizon &&
        a.endsAt >= today
    );
  };

  const handleStaffSelect = (staffMember: BookableStaff | null) => {
    if (staffMember) {
      selectStaff(staffMember);
      setNoPreference(false);
    } else {
      selectStaff(null);
      setNoPreference(true);
    }
  };

  const isSelected = (staffId: string | null) => {
    if (staffId === null) {
      return state.noStaffPreference;
    }
    return state.selectedStaff?.id === staffId;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-2">
          Bei wem möchten Sie den Termin?
        </h2>
        <p className="text-muted-foreground">
          Wählen Sie Ihren bevorzugten Stylisten oder lassen Sie sich überraschen.
        </p>
      </div>

      {/* Staff Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* No Preference Option */}
        <Card
          className={cn(
            'cursor-pointer transition-all border-2',
            isSelected(null)
              ? 'border-primary bg-primary/5'
              : 'border-border/50 hover:border-primary/50'
          )}
          onClick={() => handleStaffSelect(null)}
        >
          <CardContent className="p-6 text-center">
            <div className="relative mx-auto mb-4">
              <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mx-auto">
                <User className="h-10 w-10 text-muted-foreground" />
              </div>
              {isSelected(null) && (
                <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                  <Check className="h-4 w-4" />
                </div>
              )}
            </div>
            <h3 className="font-semibold">Keine Präferenz</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Ersten verfügbaren Termin
            </p>
          </CardContent>
        </Card>

        {/* Staff Members */}
        {qualifiedStaff.map((staffMember) => {
          const upcomingAbsence = getUpcomingAbsence(staffMember.id);

          return (
            <Card
              key={staffMember.id}
              className={cn(
                'cursor-pointer transition-all border-2',
                isSelected(staffMember.id)
                  ? 'border-primary bg-primary/5'
                  : 'border-border/50 hover:border-primary/50'
              )}
              onClick={() => handleStaffSelect(staffMember)}
            >
              <CardContent className="p-6 text-center">
                <div className="relative mx-auto mb-4">
                  {staffMember.imageUrl ? (
                    <img
                      src={staffMember.imageUrl}
                      alt={staffMember.name}
                      className="h-20 w-20 rounded-full object-cover mx-auto"
                    />
                  ) : (
                    <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mx-auto">
                      <User className="h-10 w-10 text-muted-foreground" />
                    </div>
                  )}
                  {isSelected(staffMember.id) && (
                    <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                      <Check className="h-4 w-4" />
                    </div>
                  )}
                </div>
                <h3 className="font-semibold">{staffMember.name}</h3>
                {upcomingAbsence && (
                  <Badge variant="outline" className="mt-2 text-xs text-amber-600 border-amber-300 bg-amber-50">
                    <Palmtree className="h-3 w-3 mr-1" />
                    Abwesend {format(upcomingAbsence.startsAt, 'd.', { locale: de })}-{format(upcomingAbsence.endsAt, 'd. MMM', { locale: de })}
                  </Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* No qualified staff message */}
      {qualifiedStaff.length === 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-destructive">
              Leider ist für die gewählten Leistungen kein Mitarbeiter verfügbar.
              Bitte passen Sie Ihre Auswahl an.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={goBack}>
          Zurück
        </Button>
        <Button onClick={goNext} disabled={!canProceed}>
          Weiter
        </Button>
      </div>
    </div>
  );
}
