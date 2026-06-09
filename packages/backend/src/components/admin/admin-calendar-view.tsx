'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
  addDays,
  addWeeks,
  subWeeks,
  isSameDay,
  parseISO,
  setHours,
  setMinutes,
} from 'date-fns';
import { de } from 'date-fns/locale';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Filter,
  Calendar as CalendarIcon,
  Clock,
  User,
  Loader2,
  Phone,
  Mail,
  Ban,
  RefreshCw,
  X,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { createBrowserClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

// ============================================
// TYPES
// ============================================

interface Staff {
  id: string;
  display_name: string;
  color: string | null;
  is_active: boolean;
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
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  notes: string | null;
  customer: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
  } | null;
  service: {
    id: string;
    name: string;
    duration_minutes: number;
  } | null;
  staff: {
    id: string;
    display_name: string;
    color: string | null;
  } | null;
}

interface StaffBlock {
  id: string;
  staff_id: string;
  start_time: string;
  end_time: string;
  reason: string;
  is_all_day: boolean;
  staff: {
    id: string;
    display_name: string;
    color: string | null;
  } | null;
}

interface AdminCalendarViewProps {
  staff: Staff[];
  services: Service[];
}

type ViewMode = 'day' | 'week';

// ============================================
// CONSTANTS
// ============================================

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 8:00 - 20:00

const statusConfig: Record<
  Appointment['status'],
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  pending: { label: 'Ausstehend', variant: 'secondary' },
  confirmed: { label: 'Bestätigt', variant: 'default' },
  cancelled: { label: 'Storniert', variant: 'destructive' },
  completed: { label: 'Abgeschlossen', variant: 'outline' },
  no_show: { label: 'Nicht erschienen', variant: 'destructive' },
};

// ============================================
// HELPERS
// ============================================

function getAppointmentTop(startTime: string): number {
  const date = parseISO(startTime);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  return ((hours - 8) * 60 + minutes) * (60 / 60); // 1px per minute
}

function getAppointmentHeight(startTime: string, endTime: string): number {
  const start = parseISO(startTime);
  const end = parseISO(endTime);
  const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
  return durationMinutes; // 1px per minute
}

// ============================================
// ADMIN CALENDAR VIEW
// ============================================

export function AdminCalendarView({ staff, services }: AdminCalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [selectedStaff, setSelectedStaff] = useState<string[]>(
    staff.map((s) => s.id)
  );
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [staffBlocks, setStaffBlocks] = useState<StaffBlock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] =
    useState<Appointment | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Staff Block Dialog
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  const [blockForm, setBlockForm] = useState({
    staffId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: '09:00',
    endTime: '17:00',
    reason: '',
    isAllDay: false,
  });

  // Reschedule Dialog
  const [isRescheduleDialogOpen, setIsRescheduleDialogOpen] = useState(false);
  const [rescheduleForm, setRescheduleForm] = useState({
    newDate: '',
    newTime: '',
    newStaffId: '',
  });

  // New Appointment Dialog (Offline Booking)
  const [isNewAppointmentOpen, setIsNewAppointmentOpen] = useState(false);
  const [newAppointmentForm, setNewAppointmentForm] = useState({
    customerSearch: '',
    customerId: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    isNewCustomer: false,
    serviceId: '',
    staffId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '09:00',
    notes: '',
  });
  const [customerResults, setCustomerResults] = useState<Array<{
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
  }>>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const searchParams = useSearchParams();

  // Handle ?action=new query parameter
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'new') {
      setIsNewAppointmentOpen(true);
      // Remove the query param from URL without refresh
      const url = new URL(window.location.href);
      url.searchParams.delete('action');
      window.history.replaceState({}, '', url.pathname + url.search);
    }
  }, [searchParams]);

  // Calculate date range based on view mode
  const getDateRange = useCallback(() => {
    if (viewMode === 'day') {
      return {
        start: startOfDay(currentDate),
        end: endOfDay(currentDate),
      };
    }
    return {
      start: startOfWeek(currentDate, { weekStartsOn: 1 }),
      end: endOfWeek(currentDate, { weekStartsOn: 1 }),
    };
  }, [currentDate, viewMode]);

  // Fetch appointments and staff blocks
  const fetchAppointments = useCallback(async () => {
    setIsLoading(true);
    const supabase = createBrowserClient() as any;
    const { start, end } = getDateRange();

    // Fetch appointments
    const { data, error } = await supabase
      .from('appointments')
      .select(
        `
        id,
        start_time,
        end_time,
        status,
        notes,
        customers (
          id,
          first_name,
          last_name,
          email,
          phone
        ),
        services (
          id,
          name,
          duration_minutes
        ),
        staff (
          id,
          display_name,
          color
        )
      `
      )
      .gte('start_time', start.toISOString())
      .lte('start_time', end.toISOString())
      .in('staff_id', selectedStaff.length > 0 ? selectedStaff : ['none'])
      .neq('status', 'cancelled')
      .order('start_time');

    if (!error && data) {
      setAppointments(
        data.map((apt) => ({
          id: apt.id,
          start_time: apt.start_time,
          end_time: apt.end_time,
          status: apt.status as Appointment['status'],
          notes: apt.notes,
          customer: apt.customers as Appointment['customer'],
          service: apt.services as Appointment['service'],
          staff: apt.staff as Appointment['staff'],
        }))
      );
    }

    // Fetch staff blocks
    const { data: blocksData } = await supabase
      .from('staff_blocks')
      .select(
        `
        id,
        staff_id,
        start_time,
        end_time,
        reason,
        is_all_day,
        staff (
          id,
          display_name,
          color
        )
      `
      )
      .gte('start_time', start.toISOString())
      .lte('start_time', end.toISOString())
      .in('staff_id', selectedStaff.length > 0 ? selectedStaff : ['none']);

    if (blocksData) {
      setStaffBlocks(
        blocksData.map((block) => ({
          id: block.id,
          staff_id: block.staff_id,
          start_time: block.start_time,
          end_time: block.end_time,
          reason: block.reason || 'Blockiert',
          is_all_day: block.is_all_day,
          staff: block.staff as StaffBlock['staff'],
        }))
      );
    }

    setIsLoading(false);
  }, [getDateRange, selectedStaff]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // Navigation
  const goToToday = () => setCurrentDate(new Date());
  const goPrevious = () => {
    setCurrentDate(viewMode === 'week' ? subWeeks(currentDate, 1) : addDays(currentDate, -1));
  };
  const goNext = () => {
    setCurrentDate(viewMode === 'week' ? addWeeks(currentDate, 1) : addDays(currentDate, 1));
  };

  // Get week days for week view
  const weekDays = Array.from({ length: 7 }, (_, i) =>
    addDays(startOfWeek(currentDate, { weekStartsOn: 1 }), i)
  );

  // Filter appointments by day
  const getAppointmentsForDay = (date: Date) =>
    appointments.filter((apt) => isSameDay(parseISO(apt.start_time), date));

  // Filter staff blocks by day
  const getBlocksForDay = (date: Date) =>
    staffBlocks.filter((block) => isSameDay(parseISO(block.start_time), date));

  // Toggle staff filter
  const toggleStaffFilter = (staffId: string) => {
    setSelectedStaff((prev) =>
      prev.includes(staffId)
        ? prev.filter((id) => id !== staffId)
        : [...prev, staffId]
    );
  };

  // Open block dialog for a specific day
  const openBlockDialog = (date?: Date) => {
    setBlockForm({
      staffId: staff[0]?.id || '',
      date: format(date || currentDate, 'yyyy-MM-dd'),
      startTime: '09:00',
      endTime: '17:00',
      reason: '',
      isAllDay: false,
    });
    setIsBlockDialogOpen(true);
  };

  // Create staff block
  const handleCreateBlock = async () => {
    if (!blockForm.staffId) {
      toast.error('Bitte Mitarbeiter auswählen');
      return;
    }

    setIsSaving(true);
    const supabase = createBrowserClient() as any;

    const startDateTime = blockForm.isAllDay
      ? `${blockForm.date}T08:00:00`
      : `${blockForm.date}T${blockForm.startTime}:00`;
    const endDateTime = blockForm.isAllDay
      ? `${blockForm.date}T20:00:00`
      : `${blockForm.date}T${blockForm.endTime}:00`;

    const { error } = await supabase.from('staff_blocks').insert({
      staff_id: blockForm.staffId,
      start_time: startDateTime,
      end_time: endDateTime,
      reason: blockForm.reason || 'Blockiert',
      is_all_day: blockForm.isAllDay,
    });

    if (error) {
      toast.error('Fehler beim Erstellen der Blockierung');
    } else {
      toast.success('Zeitblock erstellt');
      setIsBlockDialogOpen(false);
      fetchAppointments();
    }

    setIsSaving(false);
  };

  // Delete staff block
  const handleDeleteBlock = async (blockId: string) => {
    const supabase = createBrowserClient() as any;
    const { error } = await supabase.from('staff_blocks').delete().eq('id', blockId);

    if (error) {
      toast.error('Fehler beim Löschen');
    } else {
      toast.success('Blockierung gelöscht');
      fetchAppointments();
    }
  };

  // Open reschedule dialog
  const openRescheduleDialog = () => {
    if (!selectedAppointment) return;
    setRescheduleForm({
      newDate: format(parseISO(selectedAppointment.start_time), 'yyyy-MM-dd'),
      newTime: format(parseISO(selectedAppointment.start_time), 'HH:mm'),
      newStaffId: selectedAppointment.staff?.id || '',
    });
    setIsRescheduleDialogOpen(true);
  };

  // Handle reschedule
  const handleReschedule = async () => {
    if (!selectedAppointment || !rescheduleForm.newDate || !rescheduleForm.newTime) {
      toast.error('Bitte Datum und Zeit angeben');
      return;
    }

    setIsSaving(true);
    const supabase = createBrowserClient() as any;

    // Calculate new end time based on service duration
    const serviceDuration = selectedAppointment.service?.duration_minutes || 60;
    const newStartTime = parseISO(`${rescheduleForm.newDate}T${rescheduleForm.newTime}:00`);
    const newEndTime = new Date(newStartTime.getTime() + serviceDuration * 60000);

    const { error } = await supabase
      .from('appointments')
      .update({
        start_time: newStartTime.toISOString(),
        end_time: newEndTime.toISOString(),
        staff_id: rescheduleForm.newStaffId || selectedAppointment.staff?.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', selectedAppointment.id);

    if (error) {
      toast.error('Fehler beim Verschieben des Termins');
    } else {
      toast.success('Termin verschoben');
      setIsRescheduleDialogOpen(false);
      setSelectedAppointment(null);
      fetchAppointments();
    }

    setIsSaving(false);
  };

  // Cancel appointment
  const handleCancelAppointment = async () => {
    if (!selectedAppointment) return;

    const supabase = createBrowserClient() as any;
    const { error } = await supabase
      .from('appointments')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', selectedAppointment.id);

    if (error) {
      toast.error('Fehler beim Stornieren');
    } else {
      toast.success('Termin storniert');
      setSelectedAppointment(null);
      fetchAppointments();
    }
  };

  // Confirm appointment
  const handleConfirmAppointment = async () => {
    if (!selectedAppointment) return;

    const supabase = createBrowserClient() as any;
    const { error } = await supabase
      .from('appointments')
      .update({ status: 'confirmed', updated_at: new Date().toISOString() })
      .eq('id', selectedAppointment.id);

    if (error) {
      toast.error('Fehler beim Bestätigen');
    } else {
      toast.success('Termin bestätigt');
      setSelectedAppointment(null);
      fetchAppointments();
    }
  };

  // Open new appointment dialog
  const openNewAppointmentDialog = (date?: Date) => {
    setNewAppointmentForm({
      customerSearch: '',
      customerId: '',
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      isNewCustomer: false,
      serviceId: services[0]?.id || '',
      staffId: staff[0]?.id || '',
      date: format(date || currentDate, 'yyyy-MM-dd'),
      time: '09:00',
      notes: '',
    });
    setCustomerResults([]);
    setIsNewAppointmentOpen(true);
  };

  // Search customers
  const searchCustomers = async (query: string) => {
    if (query.length < 2) {
      setCustomerResults([]);
      return;
    }

    setIsSearching(true);
    const supabase = createBrowserClient() as any;

    const { data } = await supabase
      .from('customers')
      .select('id, first_name, last_name, email, phone')
      .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`)
      .limit(5);

    setCustomerResults(data || []);
    setIsSearching(false);
  };

  // Select customer from search results
  const selectCustomer = (customer: typeof customerResults[0]) => {
    setNewAppointmentForm({
      ...newAppointmentForm,
      customerId: customer.id,
      customerName: `${customer.first_name} ${customer.last_name}`,
      customerEmail: customer.email,
      customerPhone: customer.phone || '',
      customerSearch: `${customer.first_name} ${customer.last_name}`,
      isNewCustomer: false,
    });
    setCustomerResults([]);
  };

  // Create new appointment (offline booking)
  const handleCreateAppointment = async () => {
    const form = newAppointmentForm;

    if (!form.serviceId || !form.staffId || !form.date || !form.time) {
      toast.error('Bitte alle Pflichtfelder ausfüllen');
      return;
    }

    if (!form.customerId && !form.isNewCustomer) {
      toast.error('Bitte einen Kunden auswählen oder neu erstellen');
      return;
    }

    if (form.isNewCustomer && (!form.customerName || !form.customerEmail)) {
      toast.error('Bitte Name und E-Mail für neuen Kunden angeben');
      return;
    }

    setIsSaving(true);
    const supabase = createBrowserClient() as any;

    let customerId = form.customerId;

    // Get salon_id first (needed for both customer and appointment)
    const { data: staffData } = await supabase
      .from('staff')
      .select('salon_id')
      .eq('id', form.staffId)
      .single();

    if (!staffData?.salon_id) {
      toast.error('Salon-ID nicht gefunden');
      setIsSaving(false);
      return;
    }

    const salonId = staffData.salon_id;

    // Create new customer if needed
    if (form.isNewCustomer) {
      const nameParts = form.customerName.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      const { data: newCustomer, error: customerError } = await supabase
        .from('customers')
        .insert({
          salon_id: salonId,
          first_name: firstName,
          last_name: lastName,
          email: form.customerEmail,
          phone: form.customerPhone || null,
        })
        .select('id')
        .single();

      if (customerError) {
        toast.error('Fehler beim Erstellen des Kunden');
        setIsSaving(false);
        return;
      }

      customerId = newCustomer.id;
    }

    // Get service duration
    const selectedService = services.find((s) => s.id === form.serviceId);
    const durationMinutes = selectedService?.duration_minutes || 60;

    // Calculate end time
    const startDateTime = parseISO(`${form.date}T${form.time}:00`);
    const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60000);

    // Create appointment
    const { error: appointmentError } = await supabase.from('appointments').insert({
      salon_id: salonId,
      customer_id: customerId,
      service_id: form.serviceId,
      staff_id: form.staffId,
      start_time: startDateTime.toISOString(),
      end_time: endDateTime.toISOString(),
      duration_minutes: durationMinutes,
      status: 'confirmed', // Admin-created appointments are auto-confirmed
      notes: form.notes || null,
      confirmed_at: new Date().toISOString(),
    });

    if (appointmentError) {
      toast.error('Fehler beim Erstellen des Termins');
    } else {
      toast.success('Termin erfolgreich erstellt');
      setIsNewAppointmentOpen(false);
      fetchAppointments();
    }

    setIsSaving(false);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goPrevious}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={goToToday}>
            Heute
          </Button>
          <Button variant="outline" size="icon" onClick={goNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold ml-2">
            {viewMode === 'week'
              ? `${format(weekDays[0], 'd. MMM', { locale: de })} - ${format(weekDays[6], 'd. MMM yyyy', { locale: de })}`
              : format(currentDate, 'EEEE, d. MMMM yyyy', { locale: de })}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={viewMode}
            onValueChange={(value) => setViewMode(value as ViewMode)}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Tag</SelectItem>
              <SelectItem value="week">Woche</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsFilterOpen(true)}
          >
            <Filter className="h-4 w-4" />
          </Button>

          <Button variant="outline" onClick={() => openBlockDialog()}>
            <Ban className="h-4 w-4 mr-2" />
            Zeitblock
          </Button>

          <Button onClick={() => openNewAppointmentDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Neuer Termin
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-96">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-auto">
              <div className="min-w-[800px]">
                {/* Header with days */}
                <div className="grid grid-cols-[60px_1fr] border-b">
                  <div className="p-2 border-r" />
                  <div
                    className={cn(
                      'grid',
                      viewMode === 'week' ? 'grid-cols-7' : 'grid-cols-1'
                    )}
                  >
                    {(viewMode === 'week' ? weekDays : [currentDate]).map(
                      (day) => (
                        <div
                          key={day.toISOString()}
                          className={cn(
                            'p-2 text-center border-r last:border-r-0',
                            isSameDay(day, new Date()) && 'bg-primary/5'
                          )}
                        >
                          <div className="text-sm text-muted-foreground">
                            {format(day, 'EEE', { locale: de })}
                          </div>
                          <div
                            className={cn(
                              'text-lg font-semibold',
                              isSameDay(day, new Date()) &&
                                'text-primary'
                            )}
                          >
                            {format(day, 'd')}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>

                {/* Time grid */}
                <div className="grid grid-cols-[60px_1fr] relative">
                  {/* Time labels */}
                  <div className="border-r">
                    {HOURS.map((hour) => (
                      <div
                        key={hour}
                        className="h-[60px] border-b text-xs text-muted-foreground p-1"
                      >
                        {hour}:00
                      </div>
                    ))}
                  </div>

                  {/* Appointment columns */}
                  <div
                    className={cn(
                      'grid relative',
                      viewMode === 'week' ? 'grid-cols-7' : 'grid-cols-1'
                    )}
                  >
                    {(viewMode === 'week' ? weekDays : [currentDate]).map(
                      (day) => (
                        <div
                          key={day.toISOString()}
                          className="border-r last:border-r-0 relative"
                        >
                          {/* Hour lines */}
                          {HOURS.map((hour) => (
                            <div
                              key={hour}
                              className="h-[60px] border-b border-dashed"
                            />
                          ))}

                          {/* Staff Blocks */}
                          {getBlocksForDay(day).map((block) => {
                            const top = getAppointmentTop(block.start_time);
                            const height = getAppointmentHeight(
                              block.start_time,
                              block.end_time
                            );

                            return (
                              <div
                                key={block.id}
                                className="absolute left-1 right-1 rounded-md p-1 overflow-hidden bg-gray-400/80 text-white text-xs border-2 border-dashed border-gray-500 group"
                                style={{
                                  top: `${top}px`,
                                  height: `${Math.max(height, 20)}px`,
                                }}
                              >
                                <div className="flex items-center gap-1">
                                  <Ban className="h-3 w-3 flex-shrink-0" />
                                  <span className="truncate">{block.reason}</span>
                                  <button
                                    onClick={() => handleDeleteBlock(block.id)}
                                    className="ml-auto opacity-0 group-hover:opacity-100 hover:bg-white/20 rounded p-0.5 transition-opacity"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                                {height >= 40 && block.staff && (
                                  <div className="truncate opacity-80">
                                    {block.staff.display_name}
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {/* Appointments */}
                          {getAppointmentsForDay(day).map((apt) => {
                            const top = getAppointmentTop(apt.start_time);
                            const height = getAppointmentHeight(
                              apt.start_time,
                              apt.end_time
                            );
                            const staffColor =
                              apt.staff?.color || 'hsl(var(--primary))';

                            return (
                              <button
                                key={apt.id}
                                onClick={() => setSelectedAppointment(apt)}
                                className={cn(
                                  'absolute left-1 right-1 rounded-md p-1 text-left overflow-hidden transition-opacity hover:opacity-90',
                                  'text-white text-xs'
                                )}
                                style={{
                                  top: `${top}px`,
                                  height: `${Math.max(height, 20)}px`,
                                  backgroundColor: staffColor,
                                }}
                              >
                                <div className="font-medium truncate">
                                  {apt.customer
                                    ? `${apt.customer.first_name} ${apt.customer.last_name}`
                                    : 'Unbekannt'}
                                </div>
                                {height >= 40 && (
                                  <div className="truncate opacity-90">
                                    {apt.service?.name}
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Staff Filter Dialog */}
      <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mitarbeiter filtern</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedStaff(staff.map((s) => s.id))}
              >
                Alle auswählen
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedStaff([])}
              >
                Keine auswählen
              </Button>
            </div>
            <div className="space-y-2">
              {staff.map((member) => (
                <div key={member.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={member.id}
                    checked={selectedStaff.includes(member.id)}
                    onCheckedChange={() => toggleStaffFilter(member.id)}
                  />
                  <Label
                    htmlFor={member.id}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{
                        backgroundColor:
                          member.color || 'hsl(var(--primary))',
                      }}
                    />
                    {member.display_name}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Appointment Detail Dialog */}
      <Dialog
        open={!!selectedAppointment}
        onOpenChange={() => setSelectedAppointment(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Termindetails</DialogTitle>
          </DialogHeader>
          {selectedAppointment && (
            <div className="space-y-4">
              {/* Customer Info */}
              <div className="space-y-2">
                <h4 className="font-medium">Kunde</h4>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {selectedAppointment.customer
                      ? `${selectedAppointment.customer.first_name} ${selectedAppointment.customer.last_name}`
                      : 'Unbekannt'}
                  </span>
                </div>
                {selectedAppointment.customer?.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={`mailto:${selectedAppointment.customer.email}`}
                      className="text-primary hover:underline"
                    >
                      {selectedAppointment.customer.email}
                    </a>
                  </div>
                )}
                {selectedAppointment.customer?.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={`tel:${selectedAppointment.customer.phone}`}
                      className="text-primary hover:underline"
                    >
                      {selectedAppointment.customer.phone}
                    </a>
                  </div>
                )}
              </div>

              {/* Appointment Info */}
              <div className="space-y-2">
                <h4 className="font-medium">Termin</h4>
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {format(
                      parseISO(selectedAppointment.start_time),
                      'EEEE, d. MMMM yyyy',
                      { locale: de }
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {format(parseISO(selectedAppointment.start_time), 'HH:mm')} -{' '}
                    {format(parseISO(selectedAppointment.end_time), 'HH:mm')} Uhr
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={statusConfig[selectedAppointment.status].variant}>
                    {statusConfig[selectedAppointment.status].label}
                  </Badge>
                </div>
              </div>

              {/* Service */}
              {selectedAppointment.service && (
                <div className="space-y-2">
                  <h4 className="font-medium">Leistung</h4>
                  <p>{selectedAppointment.service.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedAppointment.service.duration_minutes} Minuten
                  </p>
                </div>
              )}

              {/* Staff */}
              {selectedAppointment.staff && (
                <div className="space-y-2">
                  <h4 className="font-medium">Mitarbeiter</h4>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{
                        backgroundColor:
                          selectedAppointment.staff.color ||
                          'hsl(var(--primary))',
                      }}
                    />
                    <span>{selectedAppointment.staff.display_name}</span>
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedAppointment.notes && (
                <div className="space-y-2">
                  <h4 className="font-medium">Notizen</h4>
                  <p className="text-sm text-muted-foreground">
                    {selectedAppointment.notes}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t">
                {selectedAppointment.status === 'pending' && (
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={handleConfirmAppointment}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Bestätigen
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={openRescheduleDialog}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Verschieben
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={handleCancelAppointment}
                >
                  <X className="h-4 w-4 mr-2" />
                  Stornieren
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Staff Block Dialog */}
      <Dialog open={isBlockDialogOpen} onOpenChange={setIsBlockDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Zeitblock erstellen</DialogTitle>
            <DialogDescription>
              Blockieren Sie einen Zeitraum für einen Mitarbeiter
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="blockStaff">Mitarbeiter</Label>
              <Select
                value={blockForm.staffId}
                onValueChange={(value) =>
                  setBlockForm({ ...blockForm, staffId: value })
                }
              >
                <SelectTrigger id="blockStaff">
                  <SelectValue placeholder="Mitarbeiter wählen" />
                </SelectTrigger>
                <SelectContent>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="blockDate">Datum</Label>
              <Input
                id="blockDate"
                type="date"
                value={blockForm.date}
                onChange={(e) =>
                  setBlockForm({ ...blockForm, date: e.target.value })
                }
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isAllDay"
                checked={blockForm.isAllDay}
                onCheckedChange={(checked) =>
                  setBlockForm({ ...blockForm, isAllDay: checked === true })
                }
              />
              <Label htmlFor="isAllDay">Ganzer Tag</Label>
            </div>
            {!blockForm.isAllDay && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="blockStart">Von</Label>
                  <Input
                    id="blockStart"
                    type="time"
                    value={blockForm.startTime}
                    onChange={(e) =>
                      setBlockForm({ ...blockForm, startTime: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="blockEnd">Bis</Label>
                  <Input
                    id="blockEnd"
                    type="time"
                    value={blockForm.endTime}
                    onChange={(e) =>
                      setBlockForm({ ...blockForm, endTime: e.target.value })
                    }
                  />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="blockReason">Grund</Label>
              <Textarea
                id="blockReason"
                placeholder="z.B. Urlaub, Krankheit, Weiterbildung..."
                value={blockForm.reason}
                onChange={(e) =>
                  setBlockForm({ ...blockForm, reason: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBlockDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleCreateBlock} disabled={isSaving}>
              {isSaving ? 'Erstellen...' : 'Erstellen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reschedule Dialog */}
      <Dialog open={isRescheduleDialogOpen} onOpenChange={setIsRescheduleDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Termin verschieben</DialogTitle>
            <DialogDescription>
              Wählen Sie ein neues Datum und eine neue Uhrzeit für den Termin
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newDate">Neues Datum</Label>
              <Input
                id="newDate"
                type="date"
                value={rescheduleForm.newDate}
                onChange={(e) =>
                  setRescheduleForm({ ...rescheduleForm, newDate: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newTime">Neue Uhrzeit</Label>
              <Input
                id="newTime"
                type="time"
                value={rescheduleForm.newTime}
                onChange={(e) =>
                  setRescheduleForm({ ...rescheduleForm, newTime: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newStaff">Mitarbeiter (optional)</Label>
              <Select
                value={rescheduleForm.newStaffId}
                onValueChange={(value) =>
                  setRescheduleForm({ ...rescheduleForm, newStaffId: value })
                }
              >
                <SelectTrigger id="newStaff">
                  <SelectValue placeholder="Mitarbeiter beibehalten" />
                </SelectTrigger>
                <SelectContent>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRescheduleDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleReschedule} disabled={isSaving}>
              {isSaving ? 'Verschieben...' : 'Verschieben'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Appointment Dialog (Offline Booking) */}
      <Dialog open={isNewAppointmentOpen} onOpenChange={setIsNewAppointmentOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Neuer Termin</DialogTitle>
            <DialogDescription>
              Erstellen Sie einen Termin für einen Kunden
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Customer Selection */}
            <div className="space-y-2">
              <Label>Kunde</Label>
              {!newAppointmentForm.isNewCustomer ? (
                <div className="space-y-2">
                  <div className="relative">
                    <Input
                      placeholder="Kunde suchen (Name oder E-Mail)..."
                      value={newAppointmentForm.customerSearch}
                      onChange={(e) => {
                        setNewAppointmentForm({
                          ...newAppointmentForm,
                          customerSearch: e.target.value,
                          customerId: '',
                        });
                        searchCustomers(e.target.value);
                      }}
                    />
                    {isSearching && (
                      <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin" />
                    )}
                  </div>
                  {customerResults.length > 0 && (
                    <div className="border rounded-md divide-y">
                      {customerResults.map((customer) => (
                        <button
                          key={customer.id}
                          type="button"
                          className="w-full px-3 py-2 text-left hover:bg-muted text-sm"
                          onClick={() => selectCustomer(customer)}
                        >
                          <div className="font-medium">
                            {customer.first_name} {customer.last_name}
                          </div>
                          <div className="text-muted-foreground text-xs">
                            {customer.email}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {newAppointmentForm.customerId && (
                    <div className="p-2 bg-muted rounded-md text-sm">
                      <div className="font-medium">{newAppointmentForm.customerName}</div>
                      <div className="text-muted-foreground">{newAppointmentForm.customerEmail}</div>
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setNewAppointmentForm({
                        ...newAppointmentForm,
                        isNewCustomer: true,
                        customerId: '',
                        customerSearch: '',
                      })
                    }
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Neuen Kunden anlegen
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 p-3 border rounded-md">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Neuer Kunde</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setNewAppointmentForm({
                          ...newAppointmentForm,
                          isNewCustomer: false,
                          customerName: '',
                          customerEmail: '',
                          customerPhone: '',
                        })
                      }
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <Input
                    placeholder="Name *"
                    value={newAppointmentForm.customerName}
                    onChange={(e) =>
                      setNewAppointmentForm({
                        ...newAppointmentForm,
                        customerName: e.target.value,
                      })
                    }
                  />
                  <Input
                    type="email"
                    placeholder="E-Mail *"
                    value={newAppointmentForm.customerEmail}
                    onChange={(e) =>
                      setNewAppointmentForm({
                        ...newAppointmentForm,
                        customerEmail: e.target.value,
                      })
                    }
                  />
                  <Input
                    type="tel"
                    placeholder="Telefon (optional)"
                    value={newAppointmentForm.customerPhone}
                    onChange={(e) =>
                      setNewAppointmentForm({
                        ...newAppointmentForm,
                        customerPhone: e.target.value,
                      })
                    }
                  />
                </div>
              )}
            </div>

            {/* Service Selection */}
            <div className="space-y-2">
              <Label htmlFor="newService">Leistung *</Label>
              <Select
                value={newAppointmentForm.serviceId}
                onValueChange={(value) =>
                  setNewAppointmentForm({ ...newAppointmentForm, serviceId: value })
                }
              >
                <SelectTrigger id="newService">
                  <SelectValue placeholder="Leistung wählen" />
                </SelectTrigger>
                <SelectContent>
                  {services
                    .filter((s) => s.is_active)
                    .map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name} ({service.duration_minutes} Min.)
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Staff Selection */}
            <div className="space-y-2">
              <Label htmlFor="newStaff">Mitarbeiter *</Label>
              <Select
                value={newAppointmentForm.staffId}
                onValueChange={(value) =>
                  setNewAppointmentForm({ ...newAppointmentForm, staffId: value })
                }
              >
                <SelectTrigger id="newStaff">
                  <SelectValue placeholder="Mitarbeiter wählen" />
                </SelectTrigger>
                <SelectContent>
                  {staff
                    .filter((s) => s.is_active)
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: s.color || 'hsl(var(--primary))' }}
                          />
                          {s.display_name}
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="newDate">Datum *</Label>
                <Input
                  id="newDate"
                  type="date"
                  value={newAppointmentForm.date}
                  onChange={(e) =>
                    setNewAppointmentForm({ ...newAppointmentForm, date: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newTime">Uhrzeit *</Label>
                <Input
                  id="newTime"
                  type="time"
                  value={newAppointmentForm.time}
                  onChange={(e) =>
                    setNewAppointmentForm({ ...newAppointmentForm, time: e.target.value })
                  }
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="newNotes">Notizen (optional)</Label>
              <Textarea
                id="newNotes"
                placeholder="Besondere Wünsche oder Anmerkungen..."
                value={newAppointmentForm.notes}
                onChange={(e) =>
                  setNewAppointmentForm({ ...newAppointmentForm, notes: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewAppointmentOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleCreateAppointment} disabled={isSaving}>
              {isSaving ? 'Erstellen...' : 'Termin erstellen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
