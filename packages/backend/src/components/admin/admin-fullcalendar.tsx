'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import { EventClickArg, DateSelectArg, EventDropArg } from '@fullcalendar/core';

// Type for date click event from interaction plugin
interface DateClickArg {
  date: Date;
  dateStr: string;
  allDay: boolean;
  dayEl: HTMLElement;
  jsEvent: MouseEvent;
  view: any;
}

// Type for event resize
interface EventResizeInfo {
  event: {
    id: string;
    start: Date | null;
    end: Date | null;
    extendedProps: Record<string, any>;
  };
  revert: () => void;
}
import { format, parseISO, addMinutes, addDays } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  Plus,
  Filter,
  Calendar as CalendarIcon,
  Clock,
  User,
  Loader2,
  Phone,
  Mail,
  X,
  Check,
  ChevronDown,
  Scissors,
  Ban,
  Trash2,
  AlertTriangle,
  BadgeCheck,
  Banknote,
  CreditCard,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ServiceCombobox } from '@/components/ui/service-combobox';
import {
  getAdminCalendarAppointments,
  getAdminStaffBlocks,
  adminCancelAppointment,
  adminConfirmAppointment,
  adminUpdateAppointmentTime,
  adminCreateAppointment,
  adminCreateStaffBlock,
  adminUpdateStaffBlockTime,
  adminDeleteStaffBlock,
  adminApproveAppointment,
  adminRecordPayment,
  adminAssignStaff,
  markAppointmentCompleted,
  markAppointmentNoShow
} from '@/lib/actions';
import { toast } from 'sonner';

// ============================================
// TYPES
// ============================================

interface Staff {
  id: string;
  display_name: string;
  color: string | null;
  is_active: boolean;
  salon_id: string;
}

interface Service {
  id: string;
  name: string;
  duration_minutes: number;
  price_cents: number;
  is_active: boolean;
}

interface Appointment {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  notes: string | null;
  booking_number: string | null;
  total_cents: number;
  // Linked customer (via customer_id FK)
  customer: {
    id: string;
    first_name: string;
    last_name: string;
    email?: string | null;
    phone?: string | null;
  } | null;
  // Denormalized customer fields (for online guest bookings)
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  // Services via appointment_services join table
  appointment_services: {
    service_id: string;
    service_name: string;
    duration_minutes: number;
    price_cents: number;
  }[] | null;
  staff: {
    id: string;
    display_name: string;
    color: string | null;
  } | null;
  // Approval tracking
  is_approved: boolean;
  approved_at: string | null;
  // Payment tracking
  paid_amount_cents: number;
  paid_at: string | null;
  payment_method: string | null;
}

interface StaffBlock {
  id: string;
  staff_id: string;
  start_time: string;
  end_time: string;
  reason: string;
  staff?: {
    display_name: string;
    color: string | null;
  };
}

interface SalonClosure {
  id: string;
  startTime: string;
  endTime: string;
  reason: string | null;
}

interface StaffSkill {
  staff_id: string;
  service_id: string;
}

interface StaffWorkingHour {
  staff_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

interface OpeningHour {
  dayOfWeek: number;
  openTime: string | null;
  closeTime: string | null;
  isOpen: boolean;
  hasLunchBreak?: boolean;
  lunchStart?: string | null;
  lunchEnd?: string | null;
}

interface AdminFullCalendarProps {
  salonId: string;
  salonTimeZone?: string;
  staff: Staff[];
  services: Service[];
  staffSkills?: StaffSkill[];
  staffWorkingHours?: StaffWorkingHour[];
  openingHours?: OpeningHour[];
  requireAppointmentApproval?: boolean;
  salonClosures?: SalonClosure[];
}

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  profiles: {
    email: string | null;
    phone: string | null;
  } | null;
}

// Staff colors
const STAFF_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
];

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  reserved: { label: 'Reserviert', color: '#f59e0b' },
  confirmed: { label: 'Bestätigt', color: '#10b981' },
  requested: { label: 'Angefragt', color: '#3b82f6' },
  completed: { label: 'Abgeschlossen', color: '#6b7280' },
  cancelled: { label: 'Storniert', color: '#ef4444' },
  no_show: { label: 'Nicht erschienen', color: '#ef4444' },
};

function appointmentNeedsApproval(appointment: Appointment | null | undefined, requireApproval: boolean): boolean {
  return Boolean(
    requireApproval &&
    appointment &&
    !appointment.is_approved &&
    ['requested', 'confirmed'].includes(appointment.status)
  );
}

function timeToMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const [hour, minute] = value.substring(0, 5).split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

function minutesToCalendarTime(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(24 * 60, totalMinutes));
  const hour = Math.floor(clamped / 60);
  const minute = clamped % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
}

function dateKeyToDayOfWeek(dateKey: string): number {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function normalizeDbTime(value: string): string {
  return value.length === 5 ? `${value}:00` : value.substring(0, 8);
}

function hasOverlap(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
  return startA < endB && endA > startB;
}

function formatCurrency(cents: number): string {
  return `CHF ${(cents / 100).toFixed(2)}`;
}

function getNextOpenDateKey(openingHours: OpeningHour[]): string {
  const today = new Date();
  const openDays = new Set(
    openingHours
      .filter((hours) => hours.isOpen)
      .map((hours) => hours.dayOfWeek)
  );

  if (openDays.size === 0) {
    return format(today, 'yyyy-MM-dd');
  }

  for (let offset = 0; offset < 14; offset += 1) {
    const candidate = addDays(today, offset);
    if (openDays.has(candidate.getDay())) {
      return format(candidate, 'yyyy-MM-dd');
    }
  }

  return format(today, 'yyyy-MM-dd');
}

function getDefaultStartTime(openingHours: OpeningHour[], dateKey: string): string {
  const dayOfWeek = dateKeyToDayOfWeek(dateKey);
  const hours = openingHours.find((item) => item.dayOfWeek === dayOfWeek && item.isOpen);
  const openMinutes = timeToMinutes(hours?.openTime);

  if (openMinutes === null) {
    return '09:00';
  }

  const rounded = Math.ceil(openMinutes / 30) * 30;
  return minutesToCalendarTime(rounded).substring(0, 5);
}

// ============================================
// ADMIN FULLCALENDAR COMPONENT
// ============================================

export function AdminFullCalendar({
  salonId,
  salonTimeZone = 'Europe/Zurich',
  staff,
  services,
  staffSkills = [],
  staffWorkingHours = [],
  openingHours = [],
  requireAppointmentApproval = false,
  salonClosures = [],
}: AdminFullCalendarProps) {
  const searchParams = useSearchParams();
  const calendarRef = useRef<FullCalendar>(null);
  const initialFormDate = getNextOpenDateKey(openingHours);
  const initialFormStartTime = getDefaultStartTime(openingHours, initialFormDate);
  const initialFormEndTime = format(
    addMinutes(new Date(`${initialFormDate}T${initialFormStartTime}:00`), 60),
    'HH:mm'
  );
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [staffBlocks, setStaffBlocks] = useState<StaffBlock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [selectedStaff, setSelectedStaff] = useState<string[]>(staff.map(s => s.id));
  const [showCancelled, setShowCancelled] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

  // Payment Dialog
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Staff Assignment
  const [assignStaffId, setAssignStaffId] = useState('');
  const [isAssigningStaff, setIsAssigningStaff] = useState(false);

  // New Appointment Dialog
  const [isNewAppointmentOpen, setIsNewAppointmentOpen] = useState(false);
  const [newAppointmentForm, setNewAppointmentForm] = useState({
    customerId: '',
    customerSearch: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    isNewCustomer: false,
    isGuestOnly: false, // Contact-only booking, no customer account created
    serviceId: '',
    staffId: '',
    date: initialFormDate,
    startTime: initialFormStartTime,
    endTime: initialFormEndTime,
    notes: '',
    sendConfirmation: true,
  });
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Block Time Dialog
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  const [blockForm, setBlockForm] = useState({
    staffId: '',
    date: initialFormDate,
    startTime: initialFormStartTime,
    endTime: '18:00',
    reason: 'Blockiert',
  });

  // Delete Block Dialog
  const [selectedBlock, setSelectedBlock] = useState<StaffBlock | null>(null);
  const [isDeleteBlockOpen, setIsDeleteBlockOpen] = useState(false);

  // Reschedule Notification Dialog
  const [isRescheduleDialogOpen, setIsRescheduleDialogOpen] = useState(false);
  const [pendingReschedule, setPendingReschedule] = useState<{
    appointmentId: string;
    newStart: Date;
    newEnd: Date;
    durationMinutes?: number;
    revert: () => void;
  } | null>(null);
  const [isRescheduling, setIsRescheduling] = useState(false);

  // Selection type dialog (appointment or block)
  const [isSelectionTypeOpen, setIsSelectionTypeOpen] = useState(false);
  const [pendingSelection, setPendingSelection] = useState<{
    start: Date;
    end: Date;
  } | null>(null);

  const activeOpeningHours = useMemo(
    () => openingHours.filter((hours) => hours.isOpen && hours.openTime && hours.closeTime),
    [openingHours]
  );

  const businessHours = useMemo(() => {
    if (activeOpeningHours.length === 0) return undefined;

    return activeOpeningHours.flatMap((hours) => {
      const dayConfig = {
        daysOfWeek: [hours.dayOfWeek],
        startTime: normalizeDbTime(hours.openTime || '09:00'),
        endTime: normalizeDbTime(hours.closeTime || '18:00'),
      };

      if (!hours.hasLunchBreak || !hours.lunchStart || !hours.lunchEnd) {
        return [dayConfig];
      }

      return [
        {
          daysOfWeek: [hours.dayOfWeek],
          startTime: normalizeDbTime(hours.openTime || '09:00'),
          endTime: normalizeDbTime(hours.lunchStart),
        },
        {
          daysOfWeek: [hours.dayOfWeek],
          startTime: normalizeDbTime(hours.lunchEnd),
          endTime: normalizeDbTime(hours.closeTime || '18:00'),
        },
      ];
    });
  }, [activeOpeningHours]);

  const calendarSlotBounds = useMemo(() => {
    const openingMinutes = activeOpeningHours.flatMap((hours) => [
      timeToMinutes(hours.openTime),
      timeToMinutes(hours.closeTime),
    ]);
    const workingMinutes = staffWorkingHours.flatMap((hours) => [
      timeToMinutes(hours.start_time),
      timeToMinutes(hours.end_time),
    ]);
    const minutes = [...openingMinutes, ...workingMinutes].filter((value): value is number => value !== null);

    if (minutes.length === 0) {
      return { min: '07:00:00', max: '21:00:00' };
    }

    const min = Math.max(0, Math.floor((Math.min(...minutes) - 30) / 30) * 30);
    const max = Math.min(24 * 60, Math.ceil((Math.max(...minutes) + 30) / 30) * 30);

    return {
      min: minutesToCalendarTime(min),
      max: minutesToCalendarTime(max),
    };
  }, [activeOpeningHours, staffWorkingHours]);

  const getQualifiedStaffForService = useCallback((serviceId: string) => {
    if (!serviceId || staffSkills.length === 0) return staff;
    return staff.filter((member) =>
      staffSkills.some((skill) => skill.staff_id === member.id && skill.service_id === serviceId)
    );
  }, [staff, staffSkills]);

  const selectedServiceForForm = useMemo(
    () => services.find((service) => service.id === newAppointmentForm.serviceId) || null,
    [newAppointmentForm.serviceId, services]
  );

  const selectedStaffForForm = useMemo(
    () => staff.find((member) => member.id === newAppointmentForm.staffId) || null,
    [newAppointmentForm.staffId, staff]
  );

  const qualifiedStaffForSelectedService = useMemo(
    () => getQualifiedStaffForService(newAppointmentForm.serviceId),
    [getQualifiedStaffForService, newAppointmentForm.serviceId]
  );

  const getWorkingHoursForDate = useCallback((staffId: string, dateKey: string) => {
    const dayOfWeek = dateKeyToDayOfWeek(dateKey);
    return staffWorkingHours.filter(
      (hours) => hours.staff_id === staffId && hours.day_of_week === dayOfWeek
    );
  }, [staffWorkingHours]);

  const appointmentFormValidation = useMemo(() => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const startMinutes = timeToMinutes(newAppointmentForm.startTime);
    const endMinutes = timeToMinutes(newAppointmentForm.endTime);
    const dayOfWeek = dateKeyToDayOfWeek(newAppointmentForm.date);

    if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
      errors.push('Die Endzeit muss nach der Startzeit liegen.');
    }

    const openingHoursForDay = openingHours.find((hours) => hours.dayOfWeek === dayOfWeek);
    if (openingHoursForDay) {
      const openingStart = timeToMinutes(openingHoursForDay.openTime);
      const openingEnd = timeToMinutes(openingHoursForDay.closeTime);
      const lunchStart = timeToMinutes(openingHoursForDay.lunchStart);
      const lunchEnd = timeToMinutes(openingHoursForDay.lunchEnd);

      if (!openingHoursForDay.isOpen) {
        errors.push('Der Salon ist an diesem Tag geschlossen.');
      } else if (
        startMinutes !== null &&
        endMinutes !== null &&
        openingStart !== null &&
        openingEnd !== null &&
        (startMinutes < openingStart || endMinutes > openingEnd)
      ) {
        errors.push(`Der Termin liegt ausserhalb der Salon-Öffnungszeiten (${openingHoursForDay.openTime} - ${openingHoursForDay.closeTime}).`);
      }

      if (
        openingHoursForDay.hasLunchBreak &&
        lunchStart !== null &&
        lunchEnd !== null &&
        startMinutes !== null &&
        endMinutes !== null &&
        startMinutes < lunchEnd &&
        endMinutes > lunchStart
      ) {
        errors.push(`Der Termin überschneidet die Mittagspause (${openingHoursForDay.lunchStart} - ${openingHoursForDay.lunchEnd}).`);
      }
    }

    if (newAppointmentForm.serviceId && newAppointmentForm.staffId && staffSkills.length > 0) {
      const hasSkill = staffSkills.some(
        (skill) =>
          skill.staff_id === newAppointmentForm.staffId &&
          skill.service_id === newAppointmentForm.serviceId
      );
      if (!hasSkill) {
        errors.push('Der ausgewählte Mitarbeiter bietet diese Leistung nicht an.');
      }
    }

    if (newAppointmentForm.staffId && startMinutes !== null && endMinutes !== null) {
      const workingHoursForDay = getWorkingHoursForDate(newAppointmentForm.staffId, newAppointmentForm.date);
      const worksAtTime = workingHoursForDay.some((hours) => {
        const start = timeToMinutes(hours.start_time);
        const end = timeToMinutes(hours.end_time);
        return start !== null && end !== null && startMinutes >= start && endMinutes <= end;
      });

      if (workingHoursForDay.length === 0) {
        errors.push('Der Mitarbeiter hat an diesem Tag keine Arbeitszeit hinterlegt.');
      } else if (!worksAtTime) {
        const ranges = workingHoursForDay
          .map((hours) => `${hours.start_time.substring(0, 5)} - ${hours.end_time.substring(0, 5)}`)
          .join(', ');
        errors.push(`Der Termin liegt ausserhalb der Arbeitszeit des Mitarbeiters (${ranges}).`);
      }
    }

    const formStart = new Date(`${newAppointmentForm.date}T${newAppointmentForm.startTime}:00`);
    const formEnd = new Date(`${newAppointmentForm.date}T${newAppointmentForm.endTime}:00`);
    const closure = salonClosures.find((item) =>
      hasOverlap(formStart, formEnd, new Date(item.startTime), new Date(item.endTime))
    );
    if (closure) {
      errors.push(`Der Zeitraum überschneidet eine Salon-Sperrzeit${closure.reason ? `: ${closure.reason}` : '.'}`);
    }

    if (selectedServiceForForm && selectedStaffForForm && errors.length === 0) {
      warnings.push(`${selectedServiceForForm.name} bei ${selectedStaffForForm.display_name}, ${newAppointmentForm.startTime} - ${newAppointmentForm.endTime} Uhr.`);
    }

    return { errors, warnings };
  }, [
    getWorkingHoursForDate,
    newAppointmentForm.date,
    newAppointmentForm.endTime,
    newAppointmentForm.serviceId,
    newAppointmentForm.staffId,
    newAppointmentForm.startTime,
    openingHours,
    salonClosures,
    selectedServiceForForm,
    selectedStaffForForm,
    staffSkills,
  ]);

  const blockFormValidation = useMemo(() => {
    const errors: string[] = [];
    const startMinutes = timeToMinutes(blockForm.startTime);
    const endMinutes = timeToMinutes(blockForm.endTime);

    if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
      errors.push('Die Endzeit muss nach der Startzeit liegen.');
    }

    const blockStart = new Date(`${blockForm.date}T${blockForm.startTime}:00`);
    const blockEnd = new Date(`${blockForm.date}T${blockForm.endTime}:00`);
    const closure = salonClosures.find((item) =>
      hasOverlap(blockStart, blockEnd, new Date(item.startTime), new Date(item.endTime))
    );
    if (closure) {
      errors.push(`Die Blockzeit überschneidet eine Salon-Sperrzeit${closure.reason ? `: ${closure.reason}` : '.'}`);
    }

    return { errors };
  }, [blockForm.date, blockForm.endTime, blockForm.startTime, salonClosures]);

  useEffect(() => {
    if (!newAppointmentForm.serviceId || qualifiedStaffForSelectedService.length === 0) return;
    if (qualifiedStaffForSelectedService.some((member) => member.id === newAppointmentForm.staffId)) return;

    setNewAppointmentForm((prev) => ({
      ...prev,
      staffId: qualifiedStaffForSelectedService[0].id,
    }));
  }, [newAppointmentForm.serviceId, newAppointmentForm.staffId, qualifiedStaffForSelectedService]);

  useEffect(() => {
    if (searchParams.get('action') !== 'new') return;

    setPendingSelection(null);
    setIsNewAppointmentOpen(true);

    const url = new URL(window.location.href);
    url.searchParams.delete('action');
    window.history.replaceState({}, '', url.pathname + url.search);
  }, [searchParams]);

  // Fetch appointments using server action (bypasses RLS)
  const fetchAppointments = useCallback(async (start: Date, end: Date, silent = false) => {
    if (!silent) setIsLoading(true);
    setIsRefreshing(true);

    try {
      const data = await getAdminCalendarAppointments(
        salonId,
        start.toISOString(),
        end.toISOString(),
        selectedStaff.length > 0 ? selectedStaff : []
      );

      setAppointments(data);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('[Calendar] Error fetching appointments:', error);
    }

    if (!silent) setIsLoading(false);
    setIsRefreshing(false);
  }, [selectedStaff, salonId]);

  // Fetch staff blocks
  const fetchStaffBlocks = useCallback(async (start: Date, end: Date) => {
    try {
      const data = await getAdminStaffBlocks(
        salonId,
        start.toISOString(),
        end.toISOString(),
        selectedStaff.length > 0 ? selectedStaff : []
      );
      setStaffBlocks(data);
    } catch (error) {
      console.error('Error fetching staff blocks:', error);
      setStaffBlocks([]);
    }
  }, [selectedStaff, salonId]);

  // Helper to check if a date falls within a salon closure
  const getClosureForDate = (date: Date): SalonClosure | null => {
    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(date);
    dateEnd.setHours(23, 59, 59, 999);

    return salonClosures.find((closure) => {
      const closureStart = new Date(closure.startTime);
      const closureEnd = new Date(closure.endTime);
      return closureStart <= dateEnd && closureEnd >= dateStart;
    }) || null;
  };

  // Convert appointments to FullCalendar events
  const UNASSIGNED_COLOR = '#9333ea'; // Purple for unassigned appointments

  // Filter appointments based on showCancelled toggle
  const filteredAppointments = showCancelled
    ? appointments
    : appointments.filter(apt => apt.status !== 'cancelled');

  const calendarStats = useMemo(() => {
    const actionableAppointments = filteredAppointments.filter(
      (appointment) => !['cancelled', 'completed', 'no_show'].includes(appointment.status)
    );
    const requiresAction = actionableAppointments.filter((appointment) => {
      const needsStaff = !appointment.staff;
      const needsApproval = appointmentNeedsApproval(appointment, requireAppointmentApproval);
      return needsStaff || needsApproval;
    }).length;
    const paidCents = filteredAppointments.reduce(
      (sum, appointment) => sum + (appointment.paid_amount_cents || 0),
      0
    );

    return {
      visibleAppointments: filteredAppointments.length,
      actionableAppointments: actionableAppointments.length,
      requiresAction,
      staffBlocks: staffBlocks.length,
      hiddenCancelled: showCancelled ? 0 : appointments.filter((appointment) => appointment.status === 'cancelled').length,
      paidCents,
    };
  }, [appointments, filteredAppointments, requireAppointmentApproval, showCancelled, staffBlocks.length]);

  const calendarEvents = [
    // Appointments
    ...filteredAppointments.map((apt) => {
      // Handle unassigned appointments (Keine Präferenz)
      const isUnassigned = !apt.staff;
      const staffIndex = isUnassigned ? -1 : staff.findIndex(s => s.id === apt.staff?.id);
      const isCancelled = apt.status === 'cancelled';
      const staffColor = isUnassigned
        ? UNASSIGNED_COLOR
        : apt.staff?.color || STAFF_COLORS[Math.max(0, staffIndex) % STAFF_COLORS.length];

      // Get customer name from linked customer or denormalized fields
      const customerName = apt.customer
        ? `${apt.customer.first_name} ${apt.customer.last_name}`
        : apt.customer_name || 'Unbekannter Kunde';

      // Get service name from appointment_services
      const serviceName = apt.appointment_services && apt.appointment_services.length > 0
        ? apt.appointment_services.map(s => s.service_name).join(', ')
        : 'Unbekannt';

      return {
        id: apt.id,
        title: customerName,
        start: apt.start_time,
        end: apt.end_time,
        backgroundColor: isCancelled ? '#9ca3af' : staffColor,
        borderColor: isCancelled ? '#6b7280' : staffColor,
        classNames: isCancelled ? ['cancelled-appointment'] : [],
        extendedProps: {
          type: 'appointment',
          appointment: apt,
          serviceName,
          staffName: apt.staff?.display_name || 'Nicht zugewiesen',
          status: apt.status,
          isUnassigned,
          isCancelled,
        },
      };
    }),
    // Staff Blocks
    ...staffBlocks.map((block) => {
      const staffIndex = staff.findIndex(s => s.id === block.staff_id);
      const staffColor = block.staff?.color || STAFF_COLORS[staffIndex % STAFF_COLORS.length];

      return {
        id: `block-${block.id}`,
        title: block.reason || 'Blockiert',
        start: block.start_time,
        end: block.end_time,
        backgroundColor: `${staffColor}40`, // semi-transparent
        borderColor: staffColor,
        textColor: staffColor,
        display: 'block',
        extendedProps: {
          type: 'block',
          block: block,
          staffName: block.staff?.display_name || 'Unbekannt',
        },
      };
    }),
  ];

  // Handle date range change
  const handleDatesSet = useCallback((dateInfo: { start: Date; end: Date }) => {
    fetchAppointments(dateInfo.start, dateInfo.end);
    fetchStaffBlocks(dateInfo.start, dateInfo.end);
  }, [fetchAppointments, fetchStaffBlocks]);

  // Handle event click
  const handleEventClick = (info: EventClickArg) => {
    const eventType = info.event.extendedProps.type;

    if (eventType === 'appointment') {
      const appointment = info.event.extendedProps.appointment as Appointment;
      setSelectedAppointment(appointment);
      setIsDetailDialogOpen(true);
    } else if (eventType === 'block') {
      const block = info.event.extendedProps.block as StaffBlock;
      setSelectedBlock(block);
      setIsDeleteBlockOpen(true);
    }
  };

  // Handle date select (drag to select time range)
  const handleDateSelect = (info: DateSelectArg) => {
    const startDate = info.start;
    const endDate = info.end;

    // Show selection type dialog (appointment or block)
    setPendingSelection({ start: startDate, end: endDate });
    setIsSelectionTypeOpen(true);
  };

  // Handle single click on calendar - disabled to avoid conflict with select
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleDateClick = (_info: DateClickArg) => {
    // Do nothing - selection is handled by handleDateSelect
    // This prevents both dialogs from opening on the same click
  };

  // Handle selection type choice
  const handleSelectionTypeChoice = (type: 'appointment' | 'block') => {
    setIsSelectionTypeOpen(false);

    if (!pendingSelection) return;

    const { start, end } = pendingSelection;

    if (type === 'appointment') {
      setNewAppointmentForm(prev => ({
        ...prev,
        date: format(start, 'yyyy-MM-dd'),
        startTime: format(start, 'HH:mm'),
        endTime: format(end, 'HH:mm'),
        staffId: staff[0]?.id || '',
      }));
      setIsNewAppointmentOpen(true);
    } else {
      setBlockForm({
        staffId: staff[0]?.id || '',
        date: format(start, 'yyyy-MM-dd'),
        startTime: format(start, 'HH:mm'),
        endTime: format(end, 'HH:mm'),
        reason: 'Blockiert',
      });
      setIsBlockDialogOpen(true);
    }

    setPendingSelection(null);
  };

  // Handle event drop (drag and drop)
  const handleEventDrop = async (info: EventDropArg) => {
    const eventType = info.event.extendedProps.type;
    const newStart = info.event.start;
    const newEnd = info.event.end;

    if (!newStart || !newEnd) {
      info.revert();
      return;
    }

    try {
      if (eventType === 'appointment') {
        const appointment = info.event.extendedProps.appointment as Appointment;
        const hasEmail = appointment?.customer_email || appointment?.customer?.email;

        if (hasEmail) {
          // Show dialog to ask about customer notification
          setPendingReschedule({
            appointmentId: info.event.id,
            newStart,
            newEnd,
            revert: info.revert,
          });
          setIsRescheduleDialogOpen(true);
        } else {
          // No email - just move without asking
          const result = await adminUpdateAppointmentTime(
            info.event.id,
            newStart.toISOString(),
            newEnd.toISOString()
          );
          if (!result.success) throw new Error(result.error);
          toast.success('Termin verschoben');
        }
      } else if (eventType === 'block') {
        const blockId = info.event.id.replace('block-', '');
        const result = await adminUpdateStaffBlockTime(
          blockId,
          newStart.toISOString(),
          newEnd.toISOString()
        );

        if (!result.success) throw new Error(result.error);
        toast.success('Blockzeit verschoben');
      }
    } catch (error) {
      console.error('Error updating:', error);
      toast.error('Fehler beim Verschieben');
      info.revert();
    }
  };

  // Handle event resize
  const handleEventResize = async (info: EventResizeInfo) => {
    const eventType = info.event.extendedProps.type;
    const newStart = info.event.start;
    const newEnd = info.event.end;

    if (!newStart || !newEnd) {
      info.revert();
      return;
    }

    try {
      if (eventType === 'appointment') {
        const durationMinutes = Math.round((newEnd.getTime() - newStart.getTime()) / 60000);
        const appointment = info.event.extendedProps.appointment as Appointment;
        const hasEmail = appointment?.customer_email || appointment?.customer?.email;

        if (hasEmail) {
          // Show dialog to ask about customer notification
          setPendingReschedule({
            appointmentId: info.event.id,
            newStart,
            newEnd,
            durationMinutes,
            revert: info.revert,
          });
          setIsRescheduleDialogOpen(true);
        } else {
          // No email - just resize without asking
          const result = await adminUpdateAppointmentTime(
            info.event.id,
            newStart.toISOString(),
            newEnd.toISOString(),
            durationMinutes
          );
          if (!result.success) throw new Error(result.error);
          toast.success('Terminzeit geändert');
        }
      } else if (eventType === 'block') {
        const blockId = info.event.id.replace('block-', '');
        const result = await adminUpdateStaffBlockTime(
          blockId,
          newStart.toISOString(),
          newEnd.toISOString()
        );

        if (!result.success) throw new Error(result.error);
        toast.success('Blockzeit geändert');
      }
    } catch (error) {
      console.error('Error resizing:', error);
      toast.error('Fehler beim Ändern der Zeit');
      info.revert();
    }
  };

  // Search customers via API to bypass RLS
  const searchCustomers = async (query: string) => {
    if (query.length < 2) {
      setCustomerResults([]);
      return;
    }

    setIsSearching(true);

    try {
      const response = await fetch(`/api/admin/customers/search?q=${encodeURIComponent(query)}&salonId=${salonId}`);
      if (response.ok) {
        const data = await response.json();
        setCustomerResults(data.customers || []);
      } else {
        console.error('Error searching customers:', response.statusText);
        setCustomerResults([]);
      }
    } catch (err) {
      console.error('Error searching customers:', err);
      setCustomerResults([]);
    }

    setIsSearching(false);
  };

  // Create new appointment
  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newAppointmentForm.serviceId || !newAppointmentForm.staffId) {
      toast.error('Bitte Service und Mitarbeiter auswählen');
      return;
    }

    if (!newAppointmentForm.customerId && !newAppointmentForm.isNewCustomer && !newAppointmentForm.isGuestOnly) {
      toast.error('Bitte einen Kunden auswählen');
      return;
    }

    if ((newAppointmentForm.isNewCustomer || newAppointmentForm.isGuestOnly) && !newAppointmentForm.customerName) {
      toast.error('Bitte Kundennamen eingeben');
      return;
    }

    if (newAppointmentForm.isNewCustomer && !newAppointmentForm.customerEmail) {
      toast.error('E-Mail ist erforderlich für neue Kunden');
      return;
    }

    if (newAppointmentForm.sendConfirmation && !newAppointmentForm.customerEmail) {
      toast.error('Für eine Bestätigungsmail ist eine E-Mail erforderlich');
      return;
    }

    if (appointmentFormValidation.errors.length > 0) {
      toast.error(appointmentFormValidation.errors[0]);
      return;
    }

    setIsSaving(true);

    try {
      const selectedService = services.find(s => s.id === newAppointmentForm.serviceId);
      const selectedStaffMember = staff.find(s => s.id === newAppointmentForm.staffId);

      if (!selectedService || !selectedStaffMember) {
        throw new Error('Service oder Mitarbeiter nicht gefunden');
      }

      // Calculate times
      const startTime = new Date(`${newAppointmentForm.date}T${newAppointmentForm.startTime}:00`);
      const endTime = new Date(`${newAppointmentForm.date}T${newAppointmentForm.endTime}:00`);

      // Determine customer email for confirmation
      const customerEmail = newAppointmentForm.customerEmail || undefined;

      // Create appointment using server action (bypasses RLS)
      const result = await adminCreateAppointment({
        salonId: selectedStaffMember.salon_id,
        staffId: selectedStaffMember.id,
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        serviceDurationMinutes: selectedService.duration_minutes,
        servicePriceCents: selectedService.price_cents,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        notes: newAppointmentForm.notes || undefined,
        // Existing customer
        customerId: newAppointmentForm.customerId || undefined,
        // Guest-only mode (no customer record)
        guestName: newAppointmentForm.isGuestOnly ? newAppointmentForm.customerName : undefined,
        guestEmail: newAppointmentForm.isGuestOnly ? customerEmail : undefined,
        guestPhone: newAppointmentForm.isGuestOnly ? newAppointmentForm.customerPhone : undefined,
        // New customer creation (handled by server action)
        createNewCustomer: newAppointmentForm.isNewCustomer,
        newCustomerName: newAppointmentForm.isNewCustomer ? newAppointmentForm.customerName : undefined,
        newCustomerEmail: newAppointmentForm.isNewCustomer ? customerEmail : undefined,
        newCustomerPhone: newAppointmentForm.isNewCustomer ? newAppointmentForm.customerPhone : undefined,
        sendConfirmationEmail: newAppointmentForm.sendConfirmation && Boolean(customerEmail),
      });

      if (!result.success) {
        throw new Error(result.error || 'Fehler beim Erstellen des Termins');
      }

      toast.success('Termin erstellt' + (result.confirmationEmailSent ? ' und Bestätigung gesendet' : ''));
      setIsNewAppointmentOpen(false);
      resetNewAppointmentForm();

      // Refresh calendar
      const calendarApi = calendarRef.current?.getApi();
      if (calendarApi) {
        const view = calendarApi.view;
        fetchAppointments(view.activeStart, view.activeEnd);
      }
    } catch (error: unknown) {
      console.error('Error creating appointment:', error);
      const errorMessage = error instanceof Error ? error.message :
        (typeof error === 'object' && error !== null && 'message' in error) ? String((error as { message: unknown }).message) :
        'Unbekannter Fehler';
      toast.error(`Fehler beim Erstellen des Termins: ${errorMessage}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Create staff block
  const handleCreateBlock = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!blockForm.staffId) {
      toast.error('Bitte Mitarbeiter auswählen');
      return;
    }

    if (blockFormValidation.errors.length > 0) {
      toast.error(blockFormValidation.errors[0]);
      return;
    }

    setIsSaving(true);

    try {
      const selectedStaffMember = staff.find(s => s.id === blockForm.staffId);

      if (!selectedStaffMember) {
        throw new Error('Mitarbeiter nicht gefunden');
      }

      const startTime = new Date(`${blockForm.date}T${blockForm.startTime}:00`);
      const endTime = new Date(`${blockForm.date}T${blockForm.endTime}:00`);

      const result = await adminCreateStaffBlock({
        staffId: selectedStaffMember.id,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        reason: blockForm.reason || 'Blockiert',
      });

      if (!result.success) throw new Error(result.error);

      toast.success('Blockzeit erstellt');
      setIsBlockDialogOpen(false);
      resetBlockForm();

      // Refresh calendar
      const calendarApi = calendarRef.current?.getApi();
      if (calendarApi) {
        const view = calendarApi.view;
        fetchStaffBlocks(view.activeStart, view.activeEnd);
      }
    } catch (error) {
      console.error('Error creating block:', error);
      toast.error('Fehler beim Erstellen der Blockzeit');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete staff block
  const handleDeleteBlock = async () => {
    if (!selectedBlock) return;

    try {
      const result = await adminDeleteStaffBlock(selectedBlock.id);

      if (!result.success) throw new Error(result.error);

      toast.success('Blockzeit gelöscht');
      setIsDeleteBlockOpen(false);
      setSelectedBlock(null);

      // Refresh calendar
      const calendarApi = calendarRef.current?.getApi();
      if (calendarApi) {
        const view = calendarApi.view;
        fetchStaffBlocks(view.activeStart, view.activeEnd);
      }
    } catch (error) {
      console.error('Error deleting block:', error);
      toast.error('Fehler beim Löschen der Blockzeit');
    }
  };

  const resetNewAppointmentForm = () => {
    setNewAppointmentForm({
      customerId: '',
      customerSearch: '',
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      isNewCustomer: false,
      isGuestOnly: false,
      serviceId: '',
      staffId: staff[0]?.id || '',
      date: initialFormDate,
      startTime: initialFormStartTime,
      endTime: initialFormEndTime,
      notes: '',
      sendConfirmation: true,
    });
    setCustomerResults([]);
  };

  const resetBlockForm = () => {
    setBlockForm({
      staffId: staff[0]?.id || '',
      date: initialFormDate,
      startTime: initialFormStartTime,
      endTime: initialFormEndTime,
      reason: 'Blockiert',
    });
  };

  // Cancel appointment
  const handleCancelAppointment = async () => {
    if (!selectedAppointment) return;

    try {
      const result = await adminCancelAppointment(selectedAppointment.id);

      if (!result.success) {
        throw new Error(result.error);
      }

      toast.success('Termin storniert');
      setIsDetailDialogOpen(false);

      // Refresh
      const calendarApi = calendarRef.current?.getApi();
      if (calendarApi) {
        const view = calendarApi.view;
        fetchAppointments(view.activeStart, view.activeEnd);
      }
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      toast.error('Fehler beim Stornieren');
    }
  };

  // Confirm appointment
  const handleConfirmAppointment = async () => {
    if (!selectedAppointment) return;

    try {
      const result = await adminConfirmAppointment(selectedAppointment.id);

      if (!result.success) {
        throw new Error(result.error);
      }

      toast.success('Termin bestätigt');
      setIsDetailDialogOpen(false);

      // Refresh
      const calendarApi = calendarRef.current?.getApi();
      if (calendarApi) {
        const view = calendarApi.view;
        fetchAppointments(view.activeStart, view.activeEnd);
      }
    } catch (error) {
      console.error('Error confirming appointment:', error);
      toast.error('Fehler beim Bestätigen');
    }
  };

  // Approve appointment
  const handleApproveAppointment = async () => {
    if (!selectedAppointment) return;

    try {
      const result = await adminApproveAppointment(selectedAppointment.id);

      if (!result.success) {
        throw new Error(result.error);
      }

      toast.success('Termin genehmigt');

      // Update local state
      setSelectedAppointment(prev => prev
        ? { ...prev, status: 'confirmed', is_approved: true, approved_at: new Date().toISOString() }
        : null);

      // Refresh
      const calendarApi = calendarRef.current?.getApi();
      if (calendarApi) {
        const view = calendarApi.view;
        fetchAppointments(view.activeStart, view.activeEnd);
      }
    } catch (error) {
      console.error('Error approving appointment:', error);
      toast.error('Fehler beim Genehmigen');
    }
  };

  // Handle reschedule confirmation (with or without notification)
  const handleRescheduleConfirm = async (sendNotification: boolean) => {
    if (!pendingReschedule) return;

    setIsRescheduling(true);
    try {
      const result = await adminUpdateAppointmentTime(
        pendingReschedule.appointmentId,
        pendingReschedule.newStart.toISOString(),
        pendingReschedule.newEnd.toISOString(),
        pendingReschedule.durationMinutes,
        sendNotification
      );

      if (!result.success) throw new Error(result.error);

      if (sendNotification) {
        toast.success('Termin verschoben und Kunde benachrichtigt');
      } else {
        toast.success('Termin verschoben');
      }

      setIsRescheduleDialogOpen(false);
      setPendingReschedule(null);
    } catch (error) {
      console.error('Error rescheduling:', error);
      toast.error('Fehler beim Verschieben');
      pendingReschedule.revert();
      setIsRescheduleDialogOpen(false);
      setPendingReschedule(null);
    } finally {
      setIsRescheduling(false);
    }
  };

  // Cancel reschedule (revert the calendar change)
  const handleRescheduleCancel = () => {
    if (pendingReschedule) {
      pendingReschedule.revert();
    }
    setIsRescheduleDialogOpen(false);
    setPendingReschedule(null);
  };

  // Open payment dialog
  const openPaymentDialog = () => {
    if (!selectedAppointment) return;
    // Pre-fill with the total amount from appointment
    const totalCents = selectedAppointment.total_cents ||
      (selectedAppointment.appointment_services?.reduce((sum, s) => sum + s.price_cents, 0) || 0);
    setPaymentAmount((totalCents / 100).toFixed(2));
    setPaymentMethod('cash');
    setIsPaymentDialogOpen(true);
  };

  // Record payment
  const handleRecordPayment = async () => {
    if (!selectedAppointment) return;

    const amountCents = Math.round(parseFloat(paymentAmount || '0') * 100);
    if (amountCents <= 0) {
      toast.error('Bitte geben Sie einen gültigen Betrag ein');
      return;
    }

    setIsProcessingPayment(true);
    try {
      const result = await adminRecordPayment({
        appointmentId: selectedAppointment.id,
        amountCents,
        paymentMethod,
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      toast.success('Zahlung erfasst');
      setIsPaymentDialogOpen(false);

      // Update local state
      setSelectedAppointment(prev => prev ? {
        ...prev,
        paid_amount_cents: amountCents,
        paid_at: new Date().toISOString(),
        payment_method: paymentMethod
      } : null);

      // Refresh
      const calendarApi = calendarRef.current?.getApi();
      if (calendarApi) {
        const view = calendarApi.view;
        fetchAppointments(view.activeStart, view.activeEnd);
      }
    } catch (error) {
      console.error('Error recording payment:', error);
      toast.error('Fehler beim Erfassen der Zahlung');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Mark appointment as completed
  const handleCompleteAppointment = async () => {
    if (!selectedAppointment) return;

    try {
      const result = await markAppointmentCompleted(selectedAppointment.id);

      if (!result.success) {
        throw new Error(result.error);
      }

      toast.success('Termin abgeschlossen');
      setIsDetailDialogOpen(false);

      const calendarApi = calendarRef.current?.getApi();
      if (calendarApi) {
        const view = calendarApi.view;
        fetchAppointments(view.activeStart, view.activeEnd);
      }
    } catch (error) {
      console.error('Error completing appointment:', error);
      toast.error('Fehler beim Abschliessen');
    }
  };

  // Mark appointment as no-show
  const handleNoShowAppointment = async () => {
    if (!selectedAppointment) return;

    const confirmed = window.confirm('Diesen Termin wirklich als nicht erschienen markieren?');
    if (!confirmed) return;

    try {
      const result = await markAppointmentNoShow(selectedAppointment.id);

      if (!result.success) {
        throw new Error(result.error);
      }

      toast.success('Termin als No-show markiert');
      setIsDetailDialogOpen(false);

      const calendarApi = calendarRef.current?.getApi();
      if (calendarApi) {
        const view = calendarApi.view;
        fetchAppointments(view.activeStart, view.activeEnd);
      }
    } catch (error) {
      console.error('Error marking no-show:', error);
      toast.error('Fehler beim Markieren als No-show');
    }
  };

  // Get compatible staff for assignment (filtered by skills and working hours)
  const getCompatibleStaff = useCallback((appointment: Appointment | null) => {
    if (!appointment) return [];

    // Get service IDs from the appointment
    const appointmentServiceIds = appointment.appointment_services?.map(s => s.service_id) || [];

    // Get appointment day and time
    const appointmentDate = new Date(appointment.start_time);
    const dayOfWeek = appointmentDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const appointmentStartTime = format(appointmentDate, 'HH:mm:ss');
    const appointmentEndTime = format(new Date(appointment.end_time), 'HH:mm:ss');

    return staff.filter(s => {
      // Check if staff has all required skills
      const staffServiceIds = staffSkills
        .filter(skill => skill.staff_id === s.id)
        .map(skill => skill.service_id);

      const hasAllSkills = appointmentServiceIds.length === 0 ||
        appointmentServiceIds.every(serviceId => staffServiceIds.includes(serviceId));

      if (!hasAllSkills) return false;

      // Check if staff works during the appointment time
      const workingHoursForDay = staffWorkingHours.filter(
        wh => wh.staff_id === s.id && wh.day_of_week === dayOfWeek
      );

      if (workingHoursForDay.length === 0) return false;

      // Check if appointment falls within any working hours block
      const worksAtTime = workingHoursForDay.some(wh => {
        return appointmentStartTime >= wh.start_time && appointmentEndTime <= wh.end_time;
      });

      return worksAtTime;
    });
  }, [staff, staffSkills, staffWorkingHours]);

  // Assign staff to appointment
  const handleAssignStaff = async () => {
    if (!selectedAppointment || !assignStaffId) return;

    setIsAssigningStaff(true);
    try {
      const result = await adminAssignStaff(selectedAppointment.id, assignStaffId);

      if (!result.success) {
        throw new Error(result.error);
      }

      // Get the assigned staff details
      const assignedStaff = staff.find(s => s.id === assignStaffId);

      toast.success(`Mitarbeiter ${assignedStaff?.display_name || ''} zugewiesen`);

      // Update local state
      setSelectedAppointment(prev => prev ? {
        ...prev,
        staff: assignedStaff ? {
          id: assignedStaff.id,
          display_name: assignedStaff.display_name,
          color: assignedStaff.color,
        } : null
      } : null);

      // Reset selection
      setAssignStaffId('');

      // Refresh calendar
      const calendarApi = calendarRef.current?.getApi();
      if (calendarApi) {
        const view = calendarApi.view;
        fetchAppointments(view.activeStart, view.activeEnd);
      }
    } catch (error) {
      console.error('Error assigning staff:', error);
      toast.error('Fehler beim Zuweisen des Mitarbeiters');
    } finally {
      setIsAssigningStaff(false);
    }
  };

  // Toggle staff filter
  const toggleStaffFilter = (staffId: string) => {
    setSelectedStaff(prev =>
      prev.includes(staffId)
        ? prev.filter(id => id !== staffId)
        : [...prev, staffId]
    );
  };

  // Refetch when staff filter changes
  useEffect(() => {
    const calendarApi = calendarRef.current?.getApi();
    if (calendarApi) {
      const view = calendarApi.view;
      fetchAppointments(view.activeStart, view.activeEnd);
      fetchStaffBlocks(view.activeStart, view.activeEnd);
    }
  }, [selectedStaff, fetchAppointments, fetchStaffBlocks]);

  // Auto-refresh every 30 seconds (silent mode - no loading spinner)
  useEffect(() => {
    const interval = setInterval(() => {
      const calendarApi = calendarRef.current?.getApi();
      if (calendarApi) {
        const view = calendarApi.view;
        fetchAppointments(view.activeStart, view.activeEnd, true);
        fetchStaffBlocks(view.activeStart, view.activeEnd);
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [fetchAppointments, fetchStaffBlocks]);

  // Manual refresh handler
  const handleManualRefresh = () => {
    const calendarApi = calendarRef.current?.getApi();
    if (calendarApi) {
      const view = calendarApi.view;
      fetchAppointments(view.activeStart, view.activeEnd);
      fetchStaffBlocks(view.activeStart, view.activeEnd);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kalender</h1>
          <p className="text-muted-foreground">
            Termine, Mitarbeiterauslastung und Blockzeiten verwalten
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 xl:w-auto xl:justify-end">
          {/* Staff Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Mitarbeiter
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Mitarbeiter filtern</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {staff.map((s, index) => (
                <DropdownMenuCheckboxItem
                  key={s.id}
                  checked={selectedStaff.includes(s.id)}
                  onCheckedChange={() => toggleStaffFilter(s.id)}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: s.color || STAFF_COLORS[index % STAFF_COLORS.length] }}
                    />
                    {s.display_name}
                  </div>
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Ansicht</DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={showCancelled}
                onCheckedChange={(checked) => setShowCancelled(checked)}
              >
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gray-400" />
                  Stornierte anzeigen
                </div>
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Refresh Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            title={`Zuletzt aktualisiert: ${format(lastRefresh, 'HH:mm:ss')}`}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>

          {/* New Block Button */}
          <Button variant="outline" onClick={() => {
            resetBlockForm();
            setIsBlockDialogOpen(true);
          }}>
            <Ban className="h-4 w-4 mr-2" />
            Blockzeit
          </Button>

          {/* New Appointment Button */}
          <Button onClick={() => {
            resetNewAppointmentForm();
            setIsNewAppointmentOpen(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Neuer Termin
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border bg-card px-4 py-3">
          <div className="text-xs text-muted-foreground">Termine in Ansicht</div>
          <div className="mt-1 text-2xl font-semibold">{calendarStats.visibleAppointments}</div>
          <div className="text-xs text-muted-foreground">
            {calendarStats.actionableAppointments} aktiv
          </div>
        </div>
        <div className="rounded-lg border bg-card px-4 py-3">
          <div className="text-xs text-muted-foreground">Aktion erforderlich</div>
          <div className="mt-1 text-2xl font-semibold text-amber-600">{calendarStats.requiresAction}</div>
          <div className="text-xs text-muted-foreground">Zuweisung oder Genehmigung</div>
        </div>
        <div className="rounded-lg border bg-card px-4 py-3">
          <div className="text-xs text-muted-foreground">Blockzeiten</div>
          <div className="mt-1 text-2xl font-semibold">{calendarStats.staffBlocks}</div>
          <div className="text-xs text-muted-foreground">im geladenen Zeitraum</div>
        </div>
        <div className="rounded-lg border bg-card px-4 py-3">
          <div className="text-xs text-muted-foreground">Erfasste Zahlungen</div>
          <div className="mt-1 text-2xl font-semibold">{formatCurrency(calendarStats.paidCents)}</div>
          <div className="text-xs text-muted-foreground">
            {calendarStats.hiddenCancelled > 0
              ? `${calendarStats.hiddenCancelled} stornierte ausgeblendet`
              : `Zeitzone ${salonTimeZone}`}
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          <CalendarIcon className="h-3 w-3" />
          Ziehen zum Erstellen
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Klicken zum Bearbeiten
        </span>
        <span className="flex items-center gap-1">
          <Ban className="h-3 w-3" />
          Halbtransparent = Blockzeit
        </span>
      </div>

      {/* Staff Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {staff.filter(s => selectedStaff.includes(s.id)).map((s, index) => (
          <div key={s.id} className="flex items-center gap-2 text-sm">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: s.color || STAFF_COLORS[index % STAFF_COLORS.length] }}
            />
            <span>{s.display_name}</span>
          </div>
        ))}
        {/* Needs attention indicator */}
        <div className="flex items-center gap-2 text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <span>Aktion erforderlich</span>
        </div>
        {/* Paid indicator */}
        <div className="flex items-center gap-2 text-sm">
          <Check className="h-4 w-4 text-emerald-500" />
          <span>Bezahlt</span>
        </div>
      </div>

      {/* Calendar */}
      <Card>
        <CardContent className="relative p-3 sm:p-4">
          {isLoading && (
            <div className="absolute inset-0 bg-background/60 z-10 flex items-center justify-center rounded-lg backdrop-blur-sm">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          )}
          {!isLoading && calendarEvents.length === 0 && (
            <div className="pointer-events-none absolute left-1/2 top-24 z-[1] w-[min(420px,calc(100%-2rem))] -translate-x-1/2 rounded-lg border bg-background/95 p-4 text-center shadow-sm">
              <div className="font-medium">Keine Termine in dieser Ansicht</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Erstellen Sie einen Termin oder wechseln Sie den Zeitraum.
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <div className="min-w-[760px] lg:min-w-0">
              <FullCalendar
                ref={calendarRef}
                plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
                initialView="timeGridWeek"
                headerToolbar={{
                  left: 'prev,next today',
                  center: 'title',
                  right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
                }}
                buttonText={{
                  today: 'Heute',
                  month: 'Monat',
                  week: 'Woche',
                  day: 'Tag',
                  list: 'Liste',
                }}
                locale="de"
                firstDay={1}
                businessHours={businessHours}
                slotMinTime={calendarSlotBounds.min}
                slotMaxTime={calendarSlotBounds.max}
                slotDuration="00:15:00"
                slotLabelInterval="01:00:00"
                slotLabelFormat={{
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                }}
                eventTimeFormat={{
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                }}
                allDaySlot={false}
                nowIndicator={true}
                navLinks={true}
                dayMaxEvents={true}
                dayCellContent={(arg) => {
                  const closure = getClosureForDate(arg.date);
                  return (
                    <div className="fc-daygrid-day-frame">
                      <div className="fc-daygrid-day-top">
                        <span className="fc-daygrid-day-number">{arg.dayNumberText}</span>
                      </div>
                      {closure && (
                        <div className="bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 text-[10px] px-1 py-0.5 rounded mx-1 truncate" title={closure.reason || 'Betriebsferien'}>
                          {closure.reason || 'Betriebsferien'}
                        </div>
                      )}
                    </div>
                  );
                }}
                dayHeaderContent={(arg) => {
                  const closure = getClosureForDate(arg.date);
                  return (
                    <div className="flex flex-col items-center">
                      <span>{format(arg.date, 'EEE', { locale: de })}</span>
                      <span className="text-lg font-semibold">{format(arg.date, 'd')}</span>
                      {closure && (
                        <span className="bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 text-[10px] px-1.5 py-0.5 rounded-full truncate max-w-full" title={closure.reason || 'Betriebsferien'}>
                          {closure.reason || 'Betriebsferien'}
                        </span>
                      )}
                    </div>
                  );
                }}
                selectable={true}
                selectMirror={true}
                editable={true}
                eventResizableFromStart={true}
                events={calendarEvents}
                datesSet={handleDatesSet}
                eventClick={handleEventClick}
                select={handleDateSelect}
                dateClick={handleDateClick}
                eventDrop={handleEventDrop}
                eventResize={handleEventResize}
                height="auto"
                contentHeight={700}
                eventContent={(eventInfo) => {
                  const eventType = eventInfo.event.extendedProps.type;

                  if (eventType === 'block') {
                    return (
                      <div className="p-1 overflow-hidden h-full opacity-80">
                        <div className="font-medium text-xs truncate flex items-center gap-1">
                          <Ban className="h-3 w-3" />
                          {eventInfo.event.extendedProps.block?.reason || 'Blockiert'}
                        </div>
                        <div className="text-[10px] opacity-80 truncate">
                          {eventInfo.event.extendedProps.staffName}
                        </div>
                      </div>
                    );
                  }

                  const apt = eventInfo.event.extendedProps.appointment as Appointment;
                  const serviceName = apt?.appointment_services && apt.appointment_services.length > 0
                    ? apt.appointment_services[0].service_name
                    : 'Unbekannt';
                  const needsApproval = appointmentNeedsApproval(apt, requireAppointmentApproval);
                  const isUnassigned = eventInfo.event.extendedProps.isUnassigned;
                  const needsAttention = isUnassigned || needsApproval;
                  const isPaid = !!apt?.paid_at;
                  const attentionTitle = [
                    isUnassigned ? 'Mitarbeiter zuweisen' : '',
                    needsApproval ? 'Genehmigung ausstehend' : '',
                  ].filter(Boolean).join(' / ');
                  return (
                    <div className="p-1 pr-2 overflow-hidden h-full">
                      <div className="font-medium text-xs flex items-center justify-between gap-1">
                        <span className="truncate">{eventInfo.event.title}</span>
                        <span className="flex items-center gap-0.5 shrink-0">
                          {isPaid && (
                            <Check className="h-3 w-3" aria-label="Bezahlt" />
                          )}
                          {needsAttention && (
                            <AlertTriangle className="h-3 w-3 animate-pulse" aria-label={attentionTitle} />
                          )}
                        </span>
                      </div>
                      <div className="text-[10px] opacity-80 truncate">
                        {serviceName}
                      </div>
                    </div>
                  );
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selection Type Dialog */}
      <Dialog open={isSelectionTypeOpen} onOpenChange={setIsSelectionTypeOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Was möchten Sie erstellen?</DialogTitle>
            <DialogDescription>
              Wählen Sie, ob Sie einen Termin oder eine Blockzeit erstellen möchten.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <Button
              variant="outline"
              className="h-24 flex flex-col items-center justify-center gap-2"
              onClick={() => handleSelectionTypeChoice('appointment')}
            >
              <Scissors className="h-8 w-8 text-primary" />
              <span>Termin</span>
            </Button>
            <Button
              variant="outline"
              className="h-24 flex flex-col items-center justify-center gap-2"
              onClick={() => handleSelectionTypeChoice('block')}
            >
              <Ban className="h-8 w-8 text-orange-500" />
              <span>Blockzeit</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Appointment Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Termindetails</DialogTitle>
          </DialogHeader>
          {selectedAppointment && (
            <div className="space-y-4">
              {/* Status */}
              <div className="flex items-center justify-between">
                <Badge
                  style={{
                    backgroundColor: STATUS_CONFIG[selectedAppointment.status]?.color || '#6b7280',
                    color: 'white'
                  }}
                >
                  {STATUS_CONFIG[selectedAppointment.status]?.label || selectedAppointment.status}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {format(parseISO(selectedAppointment.start_time), 'EEEE, d. MMMM yyyy', { locale: de })}
                </span>
              </div>

              {/* Booking Number */}
              {selectedAppointment.booking_number && (
                <div className="text-sm text-muted-foreground text-center">
                  Buchungsnr: <span className="font-mono font-medium">{selectedAppointment.booking_number}</span>
                </div>
              )}

              {/* Time */}
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="font-medium">
                    {format(parseISO(selectedAppointment.start_time), 'HH:mm')} - {format(parseISO(selectedAppointment.end_time), 'HH:mm')}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {selectedAppointment.appointment_services && selectedAppointment.appointment_services.length > 0
                      ? selectedAppointment.appointment_services.reduce((sum, s) => sum + s.duration_minutes, 0)
                      : 0} Minuten
                  </div>
                </div>
              </div>

              {/* Customer */}
              {(selectedAppointment.customer || selectedAppointment.customer_name) && (
                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="font-medium">
                      {selectedAppointment.customer
                        ? `${selectedAppointment.customer.first_name} ${selectedAppointment.customer.last_name}`
                        : selectedAppointment.customer_name}
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                      {selectedAppointment.customer_email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {selectedAppointment.customer_email}
                        </span>
                      )}
                      {!selectedAppointment.customer_email && selectedAppointment.customer?.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {selectedAppointment.customer.email}
                        </span>
                      )}
                      {selectedAppointment.customer_phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {selectedAppointment.customer_phone}
                        </span>
                      )}
                      {!selectedAppointment.customer_phone && selectedAppointment.customer?.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {selectedAppointment.customer.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Service */}
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <Scissors className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <div className="font-medium">
                    {selectedAppointment.appointment_services && selectedAppointment.appointment_services.length > 0
                      ? selectedAppointment.appointment_services.map(s => s.service_name).join(', ')
                      : 'Unbekannt'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {selectedAppointment.staff
                      ? `bei ${selectedAppointment.staff.display_name}`
                      : <span className="text-purple-600 font-medium">⚠️ Mitarbeiter nicht zugewiesen</span>
                    }
                  </div>
                </div>
              </div>

              {/* Staff Assignment - show when no staff assigned */}
              {!selectedAppointment.staff && (() => {
                const compatibleStaff = getCompatibleStaff(selectedAppointment);
                return (
                  <div className="flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                    <User className="h-5 w-5 text-purple-600" />
                    <div className="flex-1">
                      <div className="font-medium text-purple-900 dark:text-purple-100">Mitarbeiter zuweisen</div>
                      {compatibleStaff.length === 0 ? (
                        <div className="text-sm text-muted-foreground mt-2">
                          Kein Mitarbeiter verfügbar (Skills oder Arbeitszeiten passen nicht)
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 mt-2">
                          <Select value={assignStaffId} onValueChange={setAssignStaffId}>
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Mitarbeiter wählen..." />
                            </SelectTrigger>
                            <SelectContent>
                              {compatibleStaff.map((s, index) => (
                                <SelectItem key={s.id} value={s.id}>
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="w-2 h-2 rounded-full"
                                      style={{ backgroundColor: s.color || STAFF_COLORS[index % STAFF_COLORS.length] }}
                                    />
                                    {s.display_name}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            onClick={handleAssignStaff}
                            disabled={!assignStaffId || isAssigningStaff}
                          >
                            {isAssigningStaff ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Notes */}
              {selectedAppointment.notes && (
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-sm font-medium mb-1">Notizen</div>
                  <p className="text-sm text-muted-foreground">{selectedAppointment.notes}</p>
                </div>
              )}

              {/* Approval Status */}
              {requireAppointmentApproval && (
                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <BadgeCheck className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="font-medium">Genehmigung</div>
                    <div className="text-sm text-muted-foreground">
                      {selectedAppointment.is_approved
                        ? selectedAppointment.approved_at
                          ? `Genehmigt am ${format(parseISO(selectedAppointment.approved_at), 'dd.MM.yyyy HH:mm')}`
                          : 'Automatisch genehmigt'
                        : 'Noch nicht genehmigt'}
                    </div>
                  </div>
                  {!selectedAppointment.is_approved && (
                    <Button size="sm" onClick={handleApproveAppointment}>
                      <BadgeCheck className="h-4 w-4 mr-2" />
                      Genehmigen
                    </Button>
                  )}
                </div>
              )}

              {/* Payment Status */}
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <Banknote className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <div className="font-medium">Zahlung</div>
                  <div className="text-sm text-muted-foreground">
                    {selectedAppointment.paid_at
                      ? `CHF ${(selectedAppointment.paid_amount_cents / 100).toFixed(2)} - ${selectedAppointment.payment_method === 'cash' ? 'Bargeld' : selectedAppointment.payment_method === 'card' ? 'Karte' : selectedAppointment.payment_method} am ${format(parseISO(selectedAppointment.paid_at), 'dd.MM.yyyy HH:mm')}`
                      : 'Noch nicht bezahlt'}
                  </div>
                </div>
                {!selectedAppointment.paid_at && (
                  <Button size="sm" variant="outline" onClick={openPaymentDialog}>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Bezahlt
                  </Button>
                )}
              </div>

              {/* Actions - only show for actionable appointments */}
              {!['cancelled', 'completed', 'no_show'].includes(selectedAppointment.status) && (
                <DialogFooter className="flex gap-2 sm:gap-0">
                  {selectedAppointment.status !== 'confirmed' && (
                    <Button onClick={handleConfirmAppointment} className="flex-1 sm:flex-none">
                      <Check className="h-4 w-4 mr-2" />
                      Bestätigen
                    </Button>
                  )}
                  {selectedAppointment.status === 'confirmed' && (
                    <>
                      <Button
                        variant="outline"
                        onClick={handleCompleteAppointment}
                        className="flex-1 sm:flex-none"
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Abschliessen
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleNoShowAppointment}
                        className="flex-1 sm:flex-none"
                      >
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        No-show
                      </Button>
                    </>
                  )}
                  <Button
                    variant="destructive"
                    onClick={handleCancelAppointment}
                    className="flex-1 sm:flex-none"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Stornieren
                  </Button>
                </DialogFooter>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Zahlung erfassen</DialogTitle>
            <DialogDescription>
              Erfassen Sie die Zahlung des Kunden
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="paymentAmount">Betrag (CHF)</Label>
              <Input
                id="paymentAmount"
                type="number"
                step="0.05"
                min="0"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Zahlungsart</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Zahlungsart wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Bargeld</SelectItem>
                  <SelectItem value="card">Kartenzahlung</SelectItem>
                  <SelectItem value="twint">TWINT</SelectItem>
                  <SelectItem value="voucher">Gutschein</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleRecordPayment} disabled={isProcessingPayment}>
              {isProcessingPayment ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Speichern...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Zahlung erfassen
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Appointment Dialog */}
      <Dialog open={isNewAppointmentOpen} onOpenChange={setIsNewAppointmentOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>Neuen Termin erstellen</DialogTitle>
            <DialogDescription>
              Erstellen Sie einen neuen Termin für einen Kunden.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateAppointment}>
            <div className="space-y-4 py-4">
              {/* Customer Search */}
              <div className="space-y-2">
                <Label>Kunde</Label>
                {!newAppointmentForm.customerId && !newAppointmentForm.isNewCustomer && !newAppointmentForm.isGuestOnly ? (
                  <div className="space-y-2">
                    <div className="relative">
                      <Input
                        placeholder="Kunde suchen (Name oder E-Mail)..."
                        value={newAppointmentForm.customerSearch}
                        onChange={(e) => {
                          setNewAppointmentForm(prev => ({
                            ...prev,
                            customerSearch: e.target.value
                          }));
                          searchCustomers(e.target.value);
                        }}
                      />
                      {isSearching && (
                        <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin" />
                      )}
                    </div>
                    {customerResults.length > 0 && (
                      <div className="border rounded-md divide-y max-h-40 overflow-y-auto">
                        {customerResults.map(customer => (
                          <button
                            key={customer.id}
                            type="button"
                            className="w-full p-2 text-left hover:bg-muted text-sm"
                            onClick={() => {
                              setNewAppointmentForm(prev => ({
                                ...prev,
                                customerId: customer.id,
                                customerName: `${customer.first_name} ${customer.last_name}`,
                                customerEmail: customer.email || customer.profiles?.email || '',
                                customerPhone: customer.phone || customer.profiles?.phone || '',
                                customerSearch: '',
                              }));
                              setCustomerResults([]);
                            }}
                          >
                            <div className="font-medium">
                              {customer.first_name} {customer.last_name}
                            </div>
                            <div className="flex gap-4 text-muted-foreground text-xs">
                              {(customer.email || customer.profiles?.email) && (
                                <span className="flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  {customer.email || customer.profiles?.email}
                                </span>
                              )}
                              {(customer.phone || customer.profiles?.phone) && (
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {customer.phone || customer.profiles?.phone}
                                </span>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => setNewAppointmentForm(prev => ({ ...prev, isNewCustomer: true }))}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Neuen Kunden anlegen
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => setNewAppointmentForm(prev => ({ ...prev, isGuestOnly: true }))}
                      >
                        <User className="h-4 w-4 mr-2" />
                        Kontakt ohne Konto
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-2 border rounded-md bg-muted">
                      <div>
                        {newAppointmentForm.isGuestOnly ? (
                          <span className="text-sm text-muted-foreground">Kontakt ohne Konto</span>
                        ) : newAppointmentForm.isNewCustomer ? (
                          <span className="text-sm text-muted-foreground">Neuer Kunde</span>
                        ) : (
                          <span className="font-medium">{newAppointmentForm.customerName}</span>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setNewAppointmentForm(prev => ({
                          ...prev,
                          customerId: '',
                          customerName: '',
                          customerEmail: '',
                          customerPhone: '',
                          isNewCustomer: false,
                          isGuestOnly: false,
                        }))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    {(newAppointmentForm.isNewCustomer || newAppointmentForm.isGuestOnly) && (
                      <>
                        <Input
                          placeholder="Name *"
                          value={newAppointmentForm.customerName}
                          onChange={(e) => setNewAppointmentForm(prev => ({
                            ...prev,
                            customerName: e.target.value
                          }))}
                        />
                        <Input
                          type="email"
                          placeholder={newAppointmentForm.isNewCustomer ? 'E-Mail *' : 'E-Mail (optional)'}
                          value={newAppointmentForm.customerEmail}
                          onChange={(e) => setNewAppointmentForm(prev => ({
                            ...prev,
                            customerEmail: e.target.value
                          }))}
                        />
                        <Input
                          type="tel"
                          placeholder="Telefon (optional)"
                          value={newAppointmentForm.customerPhone}
                          onChange={(e) => setNewAppointmentForm(prev => ({
                            ...prev,
                            customerPhone: e.target.value
                          }))}
                        />
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Service */}
              <div className="space-y-2">
                <Label>Service</Label>
                <ServiceCombobox
                  services={services}
                  value={newAppointmentForm.serviceId}
                  onValueChange={(value, service) => {
                    if (service) {
                      const startTime = new Date(`${newAppointmentForm.date}T${newAppointmentForm.startTime}:00`);
                      const endTime = addMinutes(startTime, service.duration_minutes);
                      setNewAppointmentForm(prev => ({
                        ...prev,
                        serviceId: value,
                        endTime: format(endTime, 'HH:mm'),
                      }));
                    }
                  }}
                />
              </div>

              {/* Staff */}
              <div className="space-y-2">
                <Label>Mitarbeiter</Label>
                <Select
                  value={newAppointmentForm.staffId}
                  onValueChange={(value) => setNewAppointmentForm(prev => ({ ...prev, staffId: value }))}
                  disabled={Boolean(newAppointmentForm.serviceId) && qualifiedStaffForSelectedService.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Mitarbeiter wählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(newAppointmentForm.serviceId ? qualifiedStaffForSelectedService : staff).map((s, index) => (
                      <SelectItem key={s.id} value={s.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: s.color || STAFF_COLORS[index % STAFF_COLORS.length] }}
                          />
                          {s.display_name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {newAppointmentForm.serviceId && qualifiedStaffForSelectedService.length === 0 && (
                  <p className="text-sm text-destructive">
                    Für diese Leistung ist aktuell kein aktiver Mitarbeiter hinterlegt.
                  </p>
                )}
              </div>

              {/* Date and Time */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Datum</Label>
                  <Input
                    type="date"
                    value={newAppointmentForm.date}
                    onChange={(e) => {
                      const newDate = e.target.value;
                      const selectedService = services.find(s => s.id === newAppointmentForm.serviceId);
                      if (selectedService) {
                        const startTime = new Date(`${newDate}T${newAppointmentForm.startTime}:00`);
                        const endTime = addMinutes(startTime, selectedService.duration_minutes);
                        setNewAppointmentForm(prev => ({
                          ...prev,
                          date: newDate,
                          endTime: format(endTime, 'HH:mm'),
                        }));
                      } else {
                        setNewAppointmentForm(prev => ({ ...prev, date: newDate }));
                      }
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Von</Label>
                  <Input
                    type="time"
                    value={newAppointmentForm.startTime}
                    onChange={(e) => {
                      const newStartTime = e.target.value;
                      const selectedService = services.find(s => s.id === newAppointmentForm.serviceId);
                      if (selectedService) {
                        const startTime = new Date(`${newAppointmentForm.date}T${newStartTime}:00`);
                        const endTime = addMinutes(startTime, selectedService.duration_minutes);
                        setNewAppointmentForm(prev => ({
                          ...prev,
                          startTime: newStartTime,
                          endTime: format(endTime, 'HH:mm'),
                        }));
                      } else {
                        setNewAppointmentForm(prev => ({ ...prev, startTime: newStartTime }));
                      }
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bis</Label>
                  <Input
                    type="time"
                    value={newAppointmentForm.endTime}
                    onChange={(e) => setNewAppointmentForm(prev => ({ ...prev, endTime: e.target.value }))}
                  />
                </div>
              </div>

              {(appointmentFormValidation.errors.length > 0 || appointmentFormValidation.warnings.length > 0) && (
                <div className="space-y-2">
                  {appointmentFormValidation.errors.length > 0 && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <ul className="list-disc space-y-1 pl-4">
                          {appointmentFormValidation.errors.map((error) => (
                            <li key={error}>{error}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}
                  {appointmentFormValidation.errors.length === 0 && appointmentFormValidation.warnings.length > 0 && (
                    <Alert>
                      <Check className="h-4 w-4" />
                      <AlertDescription>
                        {appointmentFormValidation.warnings[0]}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              {/* Notes */}
              <div className="space-y-2">
                <Label>Notizen (optional)</Label>
                <Textarea
                  value={newAppointmentForm.notes}
                  onChange={(e) => setNewAppointmentForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Interne Notizen..."
                  rows={2}
                />
              </div>

              {/* Send Confirmation */}
              {newAppointmentForm.customerEmail && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="sendConfirmation"
                    checked={newAppointmentForm.sendConfirmation}
                    onCheckedChange={(checked) => setNewAppointmentForm(prev => ({
                      ...prev,
                      sendConfirmation: checked as boolean
                    }))}
                  />
                  <Label htmlFor="sendConfirmation" className="text-sm cursor-pointer">
                    Bestätigungs-Email an Kunden senden
                  </Label>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsNewAppointmentOpen(false)}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={isSaving || appointmentFormValidation.errors.length > 0}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Erstelle...
                  </>
                ) : (
                  'Termin erstellen'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Block Time Dialog */}
      <Dialog open={isBlockDialogOpen} onOpenChange={setIsBlockDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Blockzeit erstellen</DialogTitle>
            <DialogDescription>
              Erstellen Sie eine Blockzeit für einen Mitarbeiter. In dieser Zeit können keine Termine gebucht werden.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateBlock}>
            <div className="space-y-4 py-4">
              {/* Staff */}
              <div className="space-y-2">
                <Label>Mitarbeiter</Label>
                <Select
                  value={blockForm.staffId}
                  onValueChange={(value) => setBlockForm(prev => ({ ...prev, staffId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Mitarbeiter wählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {staff.map((s, index) => (
                      <SelectItem key={s.id} value={s.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: s.color || STAFF_COLORS[index % STAFF_COLORS.length] }}
                          />
                          {s.display_name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date and Time */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Datum</Label>
                  <Input
                    type="date"
                    value={blockForm.date}
                    onChange={(e) => setBlockForm(prev => ({ ...prev, date: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Von</Label>
                  <Input
                    type="time"
                    value={blockForm.startTime}
                    onChange={(e) => setBlockForm(prev => ({ ...prev, startTime: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bis</Label>
                  <Input
                    type="time"
                    value={blockForm.endTime}
                    onChange={(e) => setBlockForm(prev => ({ ...prev, endTime: e.target.value }))}
                  />
                </div>
              </div>

              {blockFormValidation.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <ul className="list-disc space-y-1 pl-4">
                      {blockFormValidation.errors.map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Reason */}
              <div className="space-y-2">
                <Label>Grund</Label>
                <Input
                  value={blockForm.reason}
                  onChange={(e) => setBlockForm(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="z.B. Mittagspause, Meeting, Urlaub..."
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsBlockDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={isSaving || blockFormValidation.errors.length > 0}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Erstelle...
                  </>
                ) : (
                  'Blockzeit erstellen'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Block Confirmation Dialog */}
      <AlertDialog open={isDeleteBlockOpen} onOpenChange={setIsDeleteBlockOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Blockzeit löschen?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie diese Blockzeit wirklich löschen?
              {selectedBlock && (
                <div className="mt-3 p-3 bg-muted rounded-lg text-sm">
                  <div><strong>Grund:</strong> {selectedBlock.reason}</div>
                  <div><strong>Zeit:</strong> {format(parseISO(selectedBlock.start_time), 'dd.MM.yyyy HH:mm')} - {format(parseISO(selectedBlock.end_time), 'HH:mm')}</div>
                  <div><strong>Mitarbeiter:</strong> {selectedBlock.staff?.display_name}</div>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBlock}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reschedule Notification Dialog */}
      <AlertDialog open={isRescheduleDialogOpen} onOpenChange={(open) => {
        if (!open) handleRescheduleCancel();
      }}>
        <AlertDialogContent className="sm:max-w-md overflow-hidden">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 shrink-0">
                <CalendarIcon className="h-5 w-5 text-blue-600" />
              </div>
              <span>Termin verschoben</span>
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 pt-2">
                <p className="text-muted-foreground">
                  Möchten Sie den Kunden per E-Mail über die Terminänderung informieren?
                </p>
                {pendingReschedule && (
                  <div className="rounded-lg border bg-muted/50 p-4">
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-muted-foreground shrink-0" />
                      <div>
                        <div className="font-medium">
                          {format(pendingReschedule.newStart, 'EEEE, d. MMMM yyyy', { locale: de })}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {format(pendingReschedule.newStart, 'HH:mm')} - {format(pendingReschedule.newEnd, 'HH:mm')} Uhr
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2 sm:gap-2 flex-col-reverse sm:flex-row">
            <AlertDialogCancel disabled={isRescheduling} className="mt-0">
              Abbrechen
            </AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => handleRescheduleConfirm(false)}
              disabled={isRescheduling}
            >
              {isRescheduling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Ohne E-Mail
            </Button>
            <Button
              onClick={() => handleRescheduleConfirm(true)}
              disabled={isRescheduling}
            >
              {isRescheduling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
              Benachrichtigen
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
