'use client';

import { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Loader2,
  CalendarOff,
  Palmtree,
  UserRound,
  Sparkles,
} from 'lucide-react';
import {
  format,
  addDays,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isToday,
  isBefore,
  startOfDay,
} from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useBooking } from '../booking-context';
import type { AvailableSlot, StaffAbsence, BookableStaff, BlockedTime } from '@/lib/domain/booking';
import {
  DEFAULT_BOOKING_TIME_ZONE,
  formatDateKeyInTimeZone,
  groupSlotsByDate,
} from '@/lib/domain/booking';

// ============================================
// TIME SELECTION STEP
// ============================================

function parseDateKeyAsLocalDate(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

interface TimeSelectionProps {
  slots: AvailableSlot[];
  isLoading?: boolean;
  error?: string | null;
  onRefreshSlots?: () => void;
  staffAbsences?: StaffAbsence[];
  staff?: BookableStaff[];
  blockedTimes?: BlockedTime[];
  timeZone?: string;
}

export function TimeSelection({
  slots,
  isLoading = false,
  error = null,
  onRefreshSlots,
  staffAbsences = [],
  staff = [],
  blockedTimes = [],
  timeZone,
}: TimeSelectionProps) {
  const { state, selectSlot, goBack, goNext, canProceed } = useBooking();
  const resolvedTimeZone = timeZone || DEFAULT_BOOKING_TIME_ZONE;
  const timeFormatter = new Intl.DateTimeFormat('de-CH', {
    timeZone: resolvedTimeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

  // Current view state
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Group slots by date
  const slotsByDate = groupSlotsByDate(slots, resolvedTimeZone);

  // Get days in current week
  const weekDays = eachDayOfInterval({
    start: currentWeekStart,
    end: endOfWeek(currentWeekStart, { weekStartsOn: 1 }),
  });

  // Get slots for selected date
  const selectedDateSlots = selectedDate
    ? slotsByDate.find((d) => d.date === formatDateKeyInTimeZone(selectedDate, resolvedTimeZone))
        ?.slots || []
    : [];

  const getSlotHour = (date: Date) =>
    Number(
      new Intl.DateTimeFormat('en-US', {
        timeZone: resolvedTimeZone,
        hour: '2-digit',
        hourCycle: 'h23',
      }).format(date)
    );

  const formatSlotTime = (date: Date) => timeFormatter.format(date);

  // Filter slots by selected staff if any, or deduplicate by time for "Keine Präferenz"
  const filteredSlots = (() => {
    if (state.selectedStaff) {
      // Staff is selected - filter to that staff's slots
      return selectedDateSlots.filter((s) => s.staffId === state.selectedStaff?.id);
    }
    if (state.noStaffPreference) {
      // "Keine Präferenz" - deduplicate by time, keeping only unique time slots
      const seenTimes = new Set<string>();
      return selectedDateSlots.filter((slot) => {
        const timeKey = slot.startsAt.toISOString();
        if (seenTimes.has(timeKey)) {
          return false;
        }
        seenTimes.add(timeKey);
        return true;
      });
    }
    // Default: show all slots
    return selectedDateSlots;
  })();

  // Check if a date has available slots
  const hasSlots = (date: Date) => {
    const dateKey = formatDateKeyInTimeZone(date, resolvedTimeZone);
    const dateSlots = slotsByDate.find((d) => d.date === dateKey);
    if (!dateSlots) return false;
    if (state.selectedStaff) {
      return dateSlots.slots.some((s) => s.staffId === state.selectedStaff?.id);
    }
    return dateSlots.slots.length > 0;
  };

  // Check if staff is absent on a specific date
  const getStaffAbsenceForDate = (date: Date, staffId?: string) => {
    const targetStaffId = staffId || state.selectedStaff?.id;
    if (!targetStaffId) return null;

    const dayStart = startOfDay(date);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);

    return staffAbsences.find(
      (a) =>
        a.staffId === targetStaffId &&
        a.startsAt <= dayEnd &&
        a.endsAt >= dayStart
    );
  };

  // Get absence info message for selected staff in the current week
  const getAbsenceInfoForWeek = () => {
    if (!state.selectedStaff) return null;

    const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
    const relevantAbsences = staffAbsences.filter((a) => {
      return (
        a.staffId === state.selectedStaff?.id &&
        a.startsAt <= weekEnd &&
        a.endsAt >= currentWeekStart
      );
    });

    if (relevantAbsences.length === 0) return null;

    return relevantAbsences.map((absence) => {
      const startStr = format(absence.startsAt, 'd. MMM', { locale: de });
      const endStr = format(absence.endsAt, 'd. MMM', { locale: de });
      return {
        staff: state.selectedStaff?.name,
        period: startStr === endStr ? startStr : `${startStr} - ${endStr}`,
        reason: absence.reason,
      };
    });
  };

  const absenceInfo = getAbsenceInfoForWeek();

  // Get salon closure info for the current week (Betriebsferien)
  const getClosureInfoForWeek = () => {
    const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });

    // Filter for salon-wide closures (staffId is null)
    const relevantClosures = blockedTimes.filter((b) => {
      return (
        b.staffId === null &&
        b.startsAt <= weekEnd &&
        b.endsAt >= currentWeekStart
      );
    });

    if (relevantClosures.length === 0) return null;

    return relevantClosures.map((closure) => {
      const startStr = format(closure.startsAt, 'd. MMM', { locale: de });
      const endStr = format(closure.endsAt, 'd. MMM', { locale: de });
      return {
        period: startStr === endStr ? startStr : `${startStr} - ${endStr}`,
        reason: closure.reason,
      };
    });
  };

  const closureInfo = getClosureInfoForWeek();
  const selectedStaffLabel = state.selectedStaff?.name || 'Keine Präferenz';
  const selectedServicesLabel = state.selectedServices.map((service) => service.name).join(', ');
  const totalDuration = state.selectedServices.reduce(
    (sum, service) => sum + service.durationMinutes,
    0
  );

  const getAvailableSlotCount = (date: Date) => {
    const dateKey = formatDateKeyInTimeZone(date, resolvedTimeZone);
    const dateSlots = slotsByDate.find((d) => d.date === dateKey)?.slots || [];

    if (state.selectedStaff) {
      return dateSlots.filter((slot) => slot.staffId === state.selectedStaff?.id).length;
    }

    if (state.noStaffPreference) {
      return new Set(dateSlots.map((slot) => slot.startsAt.toISOString())).size;
    }

    return dateSlots.length;
  };

  const timeSlotGroups = [
    {
      id: 'morning',
      label: 'Vormittag',
      caption: 'bis 12:00',
      slots: filteredSlots.filter((slot) => getSlotHour(slot.startsAt) < 12),
    },
    {
      id: 'afternoon',
      label: 'Nachmittag',
      caption: '12:00 - 17:00',
      slots: filteredSlots.filter(
        (slot) => getSlotHour(slot.startsAt) >= 12 && getSlotHour(slot.startsAt) < 17
      ),
    },
    {
      id: 'evening',
      label: 'Abend',
      caption: 'ab 17:00',
      slots: filteredSlots.filter((slot) => getSlotHour(slot.startsAt) >= 17),
    },
  ].filter((group) => group.slots.length > 0);

  const selectedDateSlotCount = selectedDate ? getAvailableSlotCount(selectedDate) : 0;
  const selectedDateLabel = selectedDate
    ? isToday(selectedDate)
      ? 'Heute'
      : format(selectedDate, 'EEEE, d. MMMM', { locale: de })
    : 'Datum wählen';

  // Navigate weeks
  const goToPreviousWeek = () => {
    setCurrentWeekStart(addDays(currentWeekStart, -7));
  };

  const goToNextWeek = () => {
    setCurrentWeekStart(addDays(currentWeekStart, 7));
  };

  // Handle slot selection
  const handleSlotSelect = (slot: AvailableSlot) => {
    selectSlot(slot);
  };

  // Auto-select first available date
  useEffect(() => {
    if (!selectedDate && slotsByDate.length > 0) {
      const firstDate = parseDateKeyAsLocalDate(slotsByDate[0].date);
      setSelectedDate(firstDate);
      // Ensure the week containing this date is visible
      setCurrentWeekStart(startOfWeek(firstDate, { weekStartsOn: 1 }));
    }
  }, [slotsByDate, selectedDate]);

  useEffect(() => {
    if (isLoading || !state.selectedSlot) return;

    const selectedStartTime = state.selectedSlot.startsAt.getTime();
    const selectedStaffId = state.selectedSlot.staffId;
    const isStillAvailable = slots.some(
      (slot) =>
        slot.staffId === selectedStaffId &&
        slot.startsAt.getTime() === selectedStartTime
    );

    if (!isStillAvailable) {
      selectSlot(null);
    }
  }, [isLoading, slots, state.selectedSlot, selectSlot]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <Badge className="mb-3 bg-primary/10 text-primary border-primary/20 hover:bg-primary/10">
          <Calendar className="w-3 h-3 mr-1" />
          Schritt 3 von 4
        </Badge>
        <h2 className="text-2xl sm:text-3xl font-bold mb-2 bg-gradient-to-r from-primary via-primary/80 to-rose-400 bg-clip-text text-transparent">
          Wählen Sie Ihren Wunschtermin
        </h2>
        <p className="text-muted-foreground">
          Verfügbare Termine sind farbig markiert
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
            {onRefreshSlots && (
              <Button
                variant="link"
                size="sm"
                onClick={onRefreshSlots}
                className="ml-2 h-auto p-0"
              >
                Erneut versuchen
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">
            Verfügbare Termine werden geladen...
          </span>
        </div>
      )}

      {!isLoading && !error && (
        <>
          <Card className="overflow-hidden border-border/70 bg-card shadow-sm">
            <CardContent className="p-0">
              <div className="border-b border-border/60 bg-muted/20 p-4 sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="gap-1.5">
                        <UserRound className="h-3.5 w-3.5" />
                        {selectedStaffLabel}
                      </Badge>
                      {totalDuration > 0 && (
                        <Badge variant="outline" className="gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          {totalDuration} Min.
                        </Badge>
                      )}
                    </div>
                    <h3 className="truncate text-lg font-semibold text-foreground sm:text-xl">
                      {selectedServicesLabel || 'Termin auswählen'}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {selectedDateSlotCount > 0
                        ? `${selectedDateSlotCount} freie Zeit${selectedDateSlotCount === 1 ? '' : 'en'} am ${selectedDateLabel}`
                        : `${selectedDateLabel} auswählen`}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-2 rounded-xl border border-border/70 bg-background p-1.5 sm:w-auto">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={goToPreviousWeek}
                      disabled={isBefore(
                        currentWeekStart,
                        startOfWeek(new Date(), { weekStartsOn: 1 })
                      )}
                      className="h-9 w-9"
                      aria-label="Vorherige Woche"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <div className="min-w-32 px-2 text-center">
                      <div className="text-sm font-semibold text-foreground">
                        {format(currentWeekStart, 'MMMM yyyy', { locale: de })}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Woche ab {format(currentWeekStart, 'd. MMM', { locale: de })}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={goToNextWeek}
                      className="h-9 w-9"
                      aria-label="Nächste Woche"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="p-3 sm:p-5">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                  {weekDays.map((day) => {
                    const isPast = isBefore(day, startOfDay(new Date()));
                    const availableSlotCount = getAvailableSlotCount(day);
                    const isAvailable = availableSlotCount > 0;
                    const isSelected = selectedDate && isSameDay(day, selectedDate);
                    const absence = getStaffAbsenceForDate(day);

                    return (
                      <button
                        key={day.toISOString()}
                        onClick={() => !isPast && isAvailable && setSelectedDate(day)}
                        disabled={isPast || !isAvailable}
                        className={cn(
                          'relative min-h-24 rounded-xl border p-3 text-left transition-all duration-200',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                          isSelected
                            ? 'border-primary bg-primary text-primary-foreground shadow-md'
                            : isAvailable
                              ? 'border-border bg-background hover:border-primary/60 hover:bg-primary/5 hover:shadow-sm'
                              : 'border-border/60 bg-muted/30 text-muted-foreground',
                          isPast && 'cursor-not-allowed opacity-50'
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div
                              className={cn(
                                'text-xs font-medium uppercase tracking-wide',
                                isSelected ? 'text-primary-foreground/75' : 'text-muted-foreground'
                              )}
                            >
                              {format(day, 'EEE', { locale: de })}
                            </div>
                            <div className="mt-1 text-2xl font-semibold leading-none">
                              {format(day, 'd')}
                            </div>
                          </div>
                          {isToday(day) && (
                            <span
                              className={cn(
                                'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                                isSelected
                                  ? 'bg-primary-foreground/15 text-primary-foreground'
                                  : 'bg-primary/10 text-primary'
                              )}
                            >
                              Heute
                            </span>
                          )}
                        </div>

                        <div className="mt-4">
                          {isAvailable ? (
                            <div
                              className={cn(
                                'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
                                isSelected
                                  ? 'bg-primary-foreground/15 text-primary-foreground'
                                  : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                              )}
                            >
                              {availableSlotCount} frei
                            </div>
                          ) : (
                            <div className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                              {absence ? 'Abwesend' : 'Belegt'}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Absence Info Banner */}
          {absenceInfo && absenceInfo.length > 0 && (
            <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
              <Palmtree className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 dark:text-amber-200">
                {absenceInfo.map((info, idx) => (
                  <span key={idx} className="block">
                    <strong>{info.staff}</strong> ist vom {info.period} abwesend
                    {info.reason && ` (${info.reason})`}.
                    {' '}Die grauen Tage sind daher nicht buchbar.
                  </span>
                ))}
              </AlertDescription>
            </Alert>
          )}

          {/* Salon Closure Info Banner (Betriebsferien) */}
          {closureInfo && closureInfo.length > 0 && (
            <Alert className="border-rose-200 bg-rose-50 dark:bg-rose-950/20 dark:border-rose-800">
              <CalendarOff className="h-4 w-4 text-rose-600" />
              <AlertDescription className="text-rose-800 dark:text-rose-200">
                {closureInfo.map((info, idx) => (
                  <span key={idx} className="block">
                    <strong>Betriebsferien</strong> vom {info.period}
                    {info.reason && ` (${info.reason})`}.
                    {' '}In diesem Zeitraum sind keine Buchungen möglich.
                  </span>
                ))}
              </AlertDescription>
            </Alert>
          )}

          {selectedDate && (
            <div className="space-y-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="mb-1 flex items-center gap-2 text-sm font-medium text-primary">
                    <Sparkles className="h-4 w-4" />
                    {selectedDateSlotCount > 0 ? 'Freie Uhrzeiten' : 'Keine freien Zeiten'}
                  </div>
                  <h3 className="text-xl font-semibold text-foreground">
                    {selectedDateLabel}
                  </h3>
                </div>
                {state.selectedSlot && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-2 text-sm">
                    <span className="text-muted-foreground">Ausgewählt: </span>
                    <span className="font-semibold text-foreground">
                      {formatSlotTime(state.selectedSlot.startsAt)} Uhr
                    </span>
                  </div>
                )}
              </div>

              {filteredSlots.length > 0 ? (
                <div className="space-y-4">
                  {timeSlotGroups.map((group) => (
                    <Card key={group.id} className="border-border/70 bg-card">
                      <CardContent className="p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <h4 className="font-semibold text-foreground">{group.label}</h4>
                            <p className="text-xs text-muted-foreground">{group.caption}</p>
                          </div>
                          <Badge variant="secondary">{group.slots.length}</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                          {group.slots.map((slot) => {
                            const isSelected =
                              state.selectedSlot?.startsAt.getTime() ===
                              slot.startsAt.getTime();

                            return (
                              <button
                                key={`${slot.staffId}-${slot.startsAt.toISOString()}`}
                                onClick={() => handleSlotSelect(slot)}
                                className={cn(
                                  'relative min-h-16 rounded-xl border px-3 py-3 text-left transition-all duration-200',
                                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                                  isSelected
                                    ? 'border-primary bg-primary text-primary-foreground shadow-md'
                                    : 'border-border bg-background hover:border-primary/60 hover:bg-primary/5 hover:shadow-sm'
                                )}
                              >
                                <span className="block text-lg font-semibold leading-none">
                                  {formatSlotTime(slot.startsAt)}
                                </span>
                                <span
                                  className={cn(
                                    'mt-1 block truncate text-xs',
                                    isSelected ? 'text-primary-foreground/75' : 'text-muted-foreground'
                                  )}
                                >
                                  {formatSlotTime(slot.endsAt)} Uhr
                                  {state.noStaffPreference ? ` · ${slot.staffName.split(' ')[0]}` : ''}
                                </span>
                                {isSelected && (
                                  <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary-foreground text-xs font-bold text-primary">
                                    ✓
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="border-dashed border-2 border-muted">
                  <CardContent className="p-8 text-center">
                    <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                      <Clock className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground font-medium">
                      Keine verfügbaren Termine an diesem Tag
                    </p>
                    <p className="text-sm text-muted-foreground/70 mt-1">
                      Bitte wählen Sie einen anderen Tag
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-6 border-t border-border/50">
        <Button
          variant="ghost"
          onClick={goBack}
          className="gap-2 hover:bg-muted/50"
        >
          <ChevronLeft className="h-4 w-4" />
          Zurück
        </Button>
        <Button
          onClick={goNext}
          disabled={!canProceed}
          className="gap-2 btn-glow bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
        >
          Weiter
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
