'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Search,
  Plus,
  MoreHorizontal,
  User,
  Users,
  UserCheck,
  Mail,
  Phone,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Eye,
  Edit,
  Archive,
  Clock,
  Loader2,
  X,
  AlertTriangle,
  BadgeCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { adminCreateAppointment, adminCreateCustomer, adminDeleteCustomer } from '@/lib/actions';
import { toast } from 'sonner';

// ============================================
// TYPES
// ============================================

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  profile: {
    email: string | null;
    phone: string | null;
    is_deleted?: boolean | null;
  } | null;
  created_at: string;
  is_active: boolean;
  appointments: { count: number }[];
}

interface AdminCustomerListProps {
  customers: Customer[];
  total: number;
  page: number;
  limit: number;
  initialSearch: string;
  stats: CustomerStats;
  appointmentOptions: CustomerAppointmentOptions;
}

interface Service {
  id: string;
  name: string;
  duration_minutes: number;
  price_cents: number;
}

interface Staff {
  id: string;
  display_name: string;
  salon_id: string;
  color: string | null;
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
  hasLunchBreak: boolean;
  lunchStart: string | null;
  lunchEnd: string | null;
}

interface CustomerStats {
  totalCustomers: number;
  activeCustomers: number;
  withAccount: number;
  withoutAccount: number;
  totalAppointments: number;
}

interface CustomerAppointmentOptions {
  salonTimeZone: string;
  services: Service[];
  staff: Staff[];
  staffSkills: StaffSkill[];
  staffWorkingHours: StaffWorkingHour[];
  openingHours: OpeningHour[];
}

interface AppointmentForm {
  serviceId: string;
  staffId: string;
  date: string;
  time: string;
  notes: string;
  sendConfirmation: boolean;
}

// ============================================
// HELPERS
// ============================================

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatCurrency(cents: number): string {
  return `CHF ${(cents / 100).toFixed(2)}`;
}

function getCustomerName(customer: Customer): string {
  return `${customer.first_name} ${customer.last_name}`.trim();
}

function getCustomerEmail(customer: Customer): string | null {
  return customer.profile?.email || customer.email;
}

function getCustomerPhone(customer: Customer): string | null {
  return customer.profile?.phone || customer.phone;
}

function timeToMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const [hour, minute] = value.substring(0, 5).split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

function minutesToTime(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(24 * 60, totalMinutes));
  const hour = Math.floor(clamped / 60);
  const minute = clamped % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function addMinutesToTime(time: string, minutes: number): string {
  const startMinutes = timeToMinutes(time) ?? 9 * 60;
  return minutesToTime(startMinutes + minutes);
}

function dateKeyToDayOfWeek(dateKey: string): number {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getNextOpenDateKey(openingHours: OpeningHour[]): string {
  const today = new Date();
  const openDays = new Set(
    openingHours
      .filter((hours) => hours.isOpen)
      .map((hours) => hours.dayOfWeek)
  );

  if (openDays.size === 0) {
    return formatDateKey(today);
  }

  for (let offset = 0; offset < 14; offset += 1) {
    const candidate = new Date(today);
    candidate.setDate(today.getDate() + offset);
    if (openDays.has(candidate.getDay())) {
      return formatDateKey(candidate);
    }
  }

  return formatDateKey(today);
}

function getDefaultStartTime(openingHours: OpeningHour[], dateKey: string): string {
  const dayOfWeek = dateKeyToDayOfWeek(dateKey);
  const hours = openingHours.find((item) => item.dayOfWeek === dayOfWeek && item.isOpen);
  const openMinutes = timeToMinutes(hours?.openTime);

  if (openMinutes === null) {
    return '09:00';
  }

  return minutesToTime(Math.ceil(openMinutes / 30) * 30);
}

// ============================================
// ADMIN CUSTOMER LIST
// ============================================

export function AdminCustomerList({
  customers,
  total,
  page,
  limit,
  initialSearch,
  stats,
  appointmentOptions,
}: AdminCustomerListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(initialSearch);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    createAccount: true,
  });

  // Appointment dialog state
  const [appointmentDialogOpen, setAppointmentDialogOpen] = useState(false);
  const [appointmentCustomer, setAppointmentCustomer] = useState<Customer | null>(null);
  const [isCreatingAppointment, setIsCreatingAppointment] = useState(false);
  const initialAppointmentDate = getNextOpenDateKey(appointmentOptions.openingHours);
  const initialAppointmentTime = getDefaultStartTime(appointmentOptions.openingHours, initialAppointmentDate);
  const [appointmentForm, setAppointmentForm] = useState<AppointmentForm>({
    serviceId: '',
    staffId: '',
    date: initialAppointmentDate,
    time: initialAppointmentTime,
    notes: '',
    sendConfirmation: true,
  });

  const totalPages = Math.ceil(total / limit);
  const appointmentServices = appointmentOptions.services;
  const staffMembers = appointmentOptions.staff;
  const selectedAppointmentService = appointmentServices.find(
    (service) => service.id === appointmentForm.serviceId
  ) || null;
  const selectedAppointmentStaff = staffMembers.find(
    (staff) => staff.id === appointmentForm.staffId
  ) || null;

  const qualifiedStaff = appointmentForm.serviceId && appointmentOptions.staffSkills.length > 0
    ? staffMembers.filter((staff) =>
        appointmentOptions.staffSkills.some(
          (skill) => skill.staff_id === staff.id && skill.service_id === appointmentForm.serviceId
        )
      )
    : staffMembers;

  const appointmentEndTime = selectedAppointmentService
    ? addMinutesToTime(appointmentForm.time, selectedAppointmentService.duration_minutes)
    : appointmentForm.time;

  const appointmentValidation = (() => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const startMinutes = timeToMinutes(appointmentForm.time);
    const endMinutes = timeToMinutes(appointmentEndTime);
    const dayOfWeek = dateKeyToDayOfWeek(appointmentForm.date);
    const openingHoursForDay = appointmentOptions.openingHours.find((hours) => hours.dayOfWeek === dayOfWeek);

    if (!appointmentForm.serviceId) {
      errors.push('Bitte eine Leistung wählen.');
    }

    if (!appointmentForm.staffId) {
      errors.push('Bitte einen Mitarbeiter wählen.');
    }

    if (!appointmentForm.date || startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
      errors.push('Bitte ein gültiges Datum und eine gültige Uhrzeit wählen.');
    }

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
        errors.push(`Der Termin liegt ausserhalb der Öffnungszeiten (${openingHoursForDay.openTime} - ${openingHoursForDay.closeTime}).`);
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

    if (
      appointmentForm.serviceId &&
      appointmentForm.staffId &&
      appointmentOptions.staffSkills.length > 0 &&
      !appointmentOptions.staffSkills.some(
        (skill) => skill.staff_id === appointmentForm.staffId && skill.service_id === appointmentForm.serviceId
      )
    ) {
      errors.push('Der ausgewählte Mitarbeiter bietet diese Leistung nicht an.');
    }

    if (appointmentForm.staffId && startMinutes !== null && endMinutes !== null) {
      const workingHoursForDay = appointmentOptions.staffWorkingHours.filter(
        (hours) => hours.staff_id === appointmentForm.staffId && hours.day_of_week === dayOfWeek
      );
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

    if (selectedAppointmentService && selectedAppointmentStaff && errors.length === 0) {
      warnings.push(
        `${selectedAppointmentService.name} bei ${selectedAppointmentStaff.display_name}, ${appointmentForm.time} - ${appointmentEndTime} Uhr.`
      );
    }

    return { errors, warnings };
  })();

  // Handle ?action=new query parameter
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'new') {
      setCreateDialogOpen(true);
      // Remove the query param from URL without refresh
      const url = new URL(window.location.href);
      url.searchParams.delete('action');
      window.history.replaceState({}, '', url.pathname + url.search);
    }
  }, [searchParams]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams);
    if (search) {
      params.set('search', search);
    } else {
      params.delete('search');
    }
    params.set('page', '1');
    router.push(`/admin/kunden?${params.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', newPage.toString());
    router.push(`/admin/kunden?${params.toString()}`);
  };

  const handleViewCustomer = (customer: Customer) => {
    router.push(`/admin/kunden/${customer.id}`);
  };

  const handleDeleteClick = (customer: Customer) => {
    setSelectedCustomer(customer);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedCustomer) return;

    setIsDeleting(true);
    try {
      const result = await adminDeleteCustomer(selectedCustomer.id);

      if (!result.success) {
        throw new Error(result.error || 'Fehler beim Archivieren des Kunden');
      }

      toast.success('Kunde erfolgreich archiviert');
      router.refresh();
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast.error(error instanceof Error ? error.message : 'Fehler beim Archivieren des Kunden');
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setSelectedCustomer(null);
    }
  };

  const handleEditCustomer = (customer: Customer) => {
    router.push(`/admin/kunden/${customer.id}?edit=true`);
  };

  const handleOpenAppointmentDialog = (customer: Customer) => {
    const hasEmail = !!(customer.profile?.email || customer.email);
    const defaultDate = getNextOpenDateKey(appointmentOptions.openingHours);
    const defaultTime = getDefaultStartTime(appointmentOptions.openingHours, defaultDate);

    setAppointmentCustomer(customer);
    setAppointmentForm({
      serviceId: '',
      staffId: '',
      date: defaultDate,
      time: defaultTime,
      notes: '',
      sendConfirmation: hasEmail,
    });
    setAppointmentDialogOpen(true);
  };

  useEffect(() => {
    if (!appointmentDialogOpen || !appointmentForm.serviceId || qualifiedStaff.length === 0) return;
    if (qualifiedStaff.some((staff) => staff.id === appointmentForm.staffId)) return;

    setAppointmentForm((prev) => ({
      ...prev,
      staffId: qualifiedStaff[0].id,
    }));
  }, [appointmentDialogOpen, appointmentForm.serviceId, appointmentForm.staffId, qualifiedStaff]);

  useEffect(() => {
    if (!appointmentDialogOpen || appointmentForm.serviceId || appointmentServices.length === 0) return;

    const firstService = appointmentServices[0];
    setAppointmentForm((prev) => ({
      ...prev,
      serviceId: firstService.id,
      time: prev.time || initialAppointmentTime,
    }));
  }, [appointmentDialogOpen, appointmentForm.serviceId, appointmentServices, initialAppointmentTime]);

  useEffect(() => {
    if (!selectedAppointmentService) return;

    setAppointmentForm((prev) => {
      if (!prev.staffId && qualifiedStaff[0]?.id) {
        return { ...prev, staffId: qualifiedStaff[0].id };
      }
      return prev;
    });
  }, [qualifiedStaff, selectedAppointmentService]);

  const handleAppointmentServiceChange = (serviceId: string) => {
    const service = appointmentServices.find((item) => item.id === serviceId);
    const nextQualifiedStaff = appointmentOptions.staffSkills.length > 0
      ? staffMembers.filter((staff) =>
          appointmentOptions.staffSkills.some(
            (skill) => skill.staff_id === staff.id && skill.service_id === serviceId
          )
        )
      : staffMembers;

    setAppointmentForm((prev) => ({
      ...prev,
      serviceId,
      staffId: nextQualifiedStaff.some((staff) => staff.id === prev.staffId)
        ? prev.staffId
        : nextQualifiedStaff[0]?.id || '',
      time: prev.time || initialAppointmentTime,
    }));

    if (service && nextQualifiedStaff.length === 0) {
      toast.warning('Für diese Leistung ist aktuell kein buchbarer Mitarbeiter hinterlegt.');
    }
  };

  const handleCreateAppointmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appointmentCustomer) return;

    setIsCreatingAppointment(true);

    try {
      // Find selected service and staff
      const selectedService = appointmentServices.find(s => s.id === appointmentForm.serviceId);
      const selectedStaff = staffMembers.find(s => s.id === appointmentForm.staffId);

      if (!selectedService || !selectedStaff) {
        toast.error('Bitte wählen Sie Service und Mitarbeiter');
        return;
      }

      if (appointmentValidation.errors.length > 0) {
        toast.error(appointmentValidation.errors[0]);
        return;
      }

      // Calculate start and end time
      const startTime = new Date(`${appointmentForm.date}T${appointmentForm.time}:00`);
      const endTime = new Date(startTime.getTime() + selectedService.duration_minutes * 60000);

      const result = await adminCreateAppointment({
        salonId: selectedStaff.salon_id,
        staffId: selectedStaff.id,
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        serviceDurationMinutes: selectedService.duration_minutes,
        servicePriceCents: selectedService.price_cents,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        notes: appointmentForm.notes || undefined,
        customerId: appointmentCustomer.id,
        sendConfirmationEmail: appointmentForm.sendConfirmation,
      });

      if (!result.success) {
        throw new Error(result.error || 'Fehler beim Erstellen des Termins');
      }

      toast.success(
        `Termin für ${appointmentCustomer.first_name} ${appointmentCustomer.last_name} erstellt` +
          (result.confirmationEmailSent ? ' und Bestätigung gesendet' : '')
      );
      setAppointmentDialogOpen(false);
      setAppointmentCustomer(null);
      router.refresh();
    } catch (error) {
      console.error('Error creating appointment:', error);
      toast.error(error instanceof Error ? error.message : 'Fehler beim Erstellen des Termins');
    } finally {
      setIsCreatingAppointment(false);
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      const result = await adminCreateCustomer({
        firstName: newCustomer.first_name,
        lastName: newCustomer.last_name,
        email: newCustomer.email,
        phone: newCustomer.phone || undefined,
        createAccount: newCustomer.createAccount,
      });

      if (!result.success) {
        throw new Error(result.error || 'Fehler beim Erstellen des Kunden');
      }

      const successMessage =
        result.accountStatus === 'linked'
          ? 'Kunde mit bestehendem Konto verknüpft'
          : result.accountStatus === 'invited'
            ? 'Kunde erstellt und Konto-Einladung gesendet'
            : 'Kontakt erfolgreich erstellt';

      toast.success(successMessage);
      setCreateDialogOpen(false);
      setNewCustomer({ first_name: '', last_name: '', email: '', phone: '', createAccount: true });
      router.refresh();
    } catch (error) {
      console.error('Error creating customer:', error);
      toast.error(error instanceof Error ? error.message : 'Fehler beim Erstellen des Kunden');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-muted-foreground">Kunden</p>
              <div className="mt-1 text-2xl font-semibold">{stats.totalCustomers}</div>
              <p className="text-xs text-muted-foreground">{stats.activeCustomers} aktiv</p>
            </div>
            <Users className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-muted-foreground">Mit Konto</p>
              <div className="mt-1 text-2xl font-semibold">{stats.withAccount}</div>
              <p className="text-xs text-muted-foreground">Login-fähig verknüpft</p>
            </div>
            <UserCheck className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-muted-foreground">Kontakte</p>
              <div className="mt-1 text-2xl font-semibold">{stats.withoutAccount}</div>
              <p className="text-xs text-muted-foreground">ohne Kundenkonto</p>
            </div>
            <Mail className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-muted-foreground">Termine</p>
              <div className="mt-1 text-2xl font-semibold">{stats.totalAppointments}</div>
              <p className="text-xs text-muted-foreground">nicht stornierte Buchungen</p>
            </div>
            <Calendar className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="gap-4 pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle>Kundenübersicht</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {total} Treffer{initialSearch ? ` für "${initialSearch}"` : ''}.
              </p>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Neuer Kunde
            </Button>
          </div>
          <form onSubmit={handleSearch} className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Name, E-Mail oder Telefon suchen..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-9"
              />
              {search && (
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setSearch('')}
                  aria-label="Suche leeren"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="submit" variant="secondary" className="flex-1 sm:flex-none">
                Suchen
              </Button>
              {initialSearch && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/admin/kunden')}
                >
                  Zurücksetzen
                </Button>
              )}
            </div>
          </form>
        </CardHeader>

      {/* Customer Table */}
        <CardContent className="p-0">
          <div className="divide-y md:hidden">
            {customers.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
                <User className="h-9 w-9 text-muted-foreground" />
                <div>
                  <p className="font-medium">Keine Kunden gefunden</p>
                  <p className="text-sm text-muted-foreground">
                    Passen Sie die Suche an oder legen Sie einen neuen Kontakt an.
                  </p>
                </div>
                <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Neuer Kunde
                </Button>
              </div>
            ) : (
              customers.map((customer) => (
                <div key={customer.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <button
                      onClick={() => handleViewCustomer(customer)}
                      className="text-left font-medium hover:text-primary"
                    >
                      {getCustomerName(customer)}
                    </button>
                    <Badge variant={customer.is_active ? 'default' : 'outline'}>
                      {customer.is_active ? 'Aktiv' : 'Inaktiv'}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    {getCustomerEmail(customer) && (
                      <a href={`mailto:${getCustomerEmail(customer)}`} className="flex items-center gap-2 hover:text-foreground">
                        <Mail className="h-3.5 w-3.5" />
                        {getCustomerEmail(customer)}
                      </a>
                    )}
                    {getCustomerPhone(customer) && (
                      <a href={`tel:${getCustomerPhone(customer)}`} className="flex items-center gap-2 hover:text-foreground">
                        <Phone className="h-3.5 w-3.5" />
                        {getCustomerPhone(customer)}
                      </a>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {customer.profile && !customer.profile.is_deleted ? (
                      <Badge variant="outline" className="text-xs">
                        <User className="mr-1 h-3 w-3" />
                        Konto aktiv
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">Ohne Konto</Badge>
                    )}
                    <Badge variant="secondary" className="text-xs">
                      {customer.appointments?.[0]?.count || 0} Termine
                    </Badge>
                    <span className="text-xs text-muted-foreground">seit {formatDate(customer.created_at)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleViewCustomer(customer)}>
                      <Eye className="mr-2 h-4 w-4" />
                      Anzeigen
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleOpenAppointmentDialog(customer)}>
                      <Calendar className="mr-2 h-4 w-4" />
                      Termin
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <Table className="min-w-[860px]">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>E-Mail</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead className="text-center">Termine</TableHead>
                <TableHead>Erstellt am</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <User className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">Keine Kunden gefunden</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                customers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleViewCustomer(customer)}
                          className="font-medium hover:text-primary transition-colors text-left"
                        >
                          {customer.first_name} {customer.last_name}
                        </button>
                        {customer.profile && !customer.profile.is_deleted ? (
                          <Badge variant="outline" className="text-xs shrink-0">
                            <User className="h-3 w-3 mr-1" />
                            Konto aktiv
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs shrink-0">
                            Ohne Konto
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {(customer.profile?.email || customer.email) ? (
                        <a
                          href={`mailto:${customer.profile?.email || customer.email}`}
                          className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                        >
                          <Mail className="h-3 w-3" />
                          {customer.profile?.email || customer.email}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {(customer.profile?.phone || customer.phone) ? (
                        <a
                          href={`tel:${customer.profile?.phone || customer.phone}`}
                          className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                        >
                          <Phone className="h-3 w-3" />
                          {customer.profile?.phone || customer.phone}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">
                        {customer.appointments?.[0]?.count || 0}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(customer.created_at)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={customer.is_active ? 'default' : 'outline'}>
                        {customer.is_active ? 'Aktiv' : 'Inaktiv'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleViewCustomer(customer)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Anzeigen
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleEditCustomer(customer)}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Bearbeiten
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleOpenAppointmentDialog(customer)}
                          >
                            <Calendar className="h-4 w-4 mr-2" />
                            Termin erstellen
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDeleteClick(customer)}
                            className="text-destructive"
                          >
                            <Archive className="h-4 w-4 mr-2" />
                            Archivieren
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Seite {page} von {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={page <= 1}
              onClick={() => handlePageChange(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={page >= totalPages}
              onClick={() => handlePageChange(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kunde archivieren</DialogTitle>
            <DialogDescription>
              Sind Sie sicher, dass Sie {selectedCustomer?.first_name}{' '}
              {selectedCustomer?.last_name} archivieren möchten? Bestehende Termine
              und Historie bleiben erhalten.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={isDeleting}
              onClick={() => setDeleteDialogOpen(false)}
            >
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={isDeleting}>
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Archiviere...
                </>
              ) : (
                'Archivieren'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Customer Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Neuen Kunden erstellen</DialogTitle>
            <DialogDescription>
              Legen Sie einen Kontakt an oder senden Sie direkt eine Konto-Einladung.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateCustomer}>
            <div className="space-y-4 py-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="first_name">Vorname</Label>
                  <Input
                    id="first_name"
                    value={newCustomer.first_name}
                    onChange={(e) =>
                      setNewCustomer({ ...newCustomer, first_name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Nachname</Label>
                  <Input
                    id="last_name"
                    value={newCustomer.last_name}
                    onChange={(e) =>
                      setNewCustomer({ ...newCustomer, last_name: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-Mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={newCustomer.email}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, email: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefon (optional)</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={newCustomer.phone}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, phone: e.target.value })
                  }
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="create-account"
                  checked={newCustomer.createAccount}
                  onCheckedChange={(checked) =>
                    setNewCustomer({ ...newCustomer, createAccount: checked === true })
                  }
                />
                <Label htmlFor="create-account" className="cursor-pointer text-sm">
                  Konto-Einladung senden
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Ohne Konto-Einladung wird nur ein administrativer Kontakt gespeichert. Das ist sinnvoll für Telefonkunden oder Walk-ins.
              </p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
              >
                Abbrechen
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? 'Erstelle...' : newCustomer.createAccount ? 'Einladen' : 'Kontakt speichern'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Appointment Dialog */}
      <Dialog open={appointmentDialogOpen} onOpenChange={setAppointmentDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Termin erstellen</DialogTitle>
            <DialogDescription>
              Neuen Termin für {appointmentCustomer?.first_name} {appointmentCustomer?.last_name} erstellen.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateAppointmentSubmit}>
            <div className="space-y-4 py-4">
              {appointmentServices.length === 0 || staffMembers.length === 0 ? (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Es sind aktuell keine aktiven Leistungen oder buchbaren Mitarbeiter hinterlegt.
                  </AlertDescription>
                </Alert>
              ) : null}

              <div className="space-y-2">
                <Label>Leistung</Label>
                <Select
                  value={appointmentForm.serviceId}
                  onValueChange={handleAppointmentServiceChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Leistung wählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {appointmentServices.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        <div className="flex min-w-0 items-center justify-between gap-3">
                          <span className="truncate">{service.name}</span>
                          <span className="shrink-0 text-muted-foreground">
                            {service.duration_minutes} Min. · {formatCurrency(service.price_cents)}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Mitarbeiter</Label>
                <Select
                  value={appointmentForm.staffId}
                  onValueChange={(value) =>
                    setAppointmentForm({ ...appointmentForm, staffId: value })
                  }
                  disabled={Boolean(appointmentForm.serviceId) && qualifiedStaff.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Mitarbeiter wählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(appointmentForm.serviceId ? qualifiedStaff : staffMembers).map((staff) => (
                      <SelectItem key={staff.id} value={staff.id}>
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: staff.color || '#0284c7' }}
                          />
                          {staff.display_name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {appointmentForm.serviceId && qualifiedStaff.length === 0 && (
                  <p className="text-sm text-destructive">
                    Für diese Leistung ist aktuell kein buchbarer Mitarbeiter hinterlegt.
                  </p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="appointment-date">Datum</Label>
                  <Input
                    id="appointment-date"
                    type="date"
                    value={appointmentForm.date}
                    onChange={(e) =>
                      setAppointmentForm({ ...appointmentForm, date: e.target.value })
                    }
                    min={formatDateKey(new Date())}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="appointment-time">Von</Label>
                  <Input
                    id="appointment-time"
                    type="time"
                    value={appointmentForm.time}
                    onChange={(e) =>
                      setAppointmentForm({ ...appointmentForm, time: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bis</Label>
                  <Input value={appointmentEndTime} readOnly className="bg-muted" />
                </div>
              </div>

              {(appointmentValidation.errors.length > 0 || appointmentValidation.warnings.length > 0) && (
                <Alert variant={appointmentValidation.errors.length > 0 ? 'destructive' : 'default'}>
                  {appointmentValidation.errors.length > 0 ? (
                    <AlertTriangle className="h-4 w-4" />
                  ) : (
                    <BadgeCheck className="h-4 w-4" />
                  )}
                  <AlertDescription>
                    {appointmentValidation.errors.length > 0 ? (
                      <ul className="list-disc space-y-1 pl-4">
                        {appointmentValidation.errors.map((error) => (
                          <li key={error}>{error}</li>
                        ))}
                      </ul>
                    ) : (
                      appointmentValidation.warnings[0]
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="appointment-notes">Notizen (optional)</Label>
                <Textarea
                  id="appointment-notes"
                  value={appointmentForm.notes}
                  onChange={(e) =>
                    setAppointmentForm({ ...appointmentForm, notes: e.target.value })
                  }
                  placeholder="Interne Notizen zum Termin..."
                  rows={3}
                />
              </div>

              {(appointmentCustomer?.profile?.email || appointmentCustomer?.email) && (
                <div className="flex items-center gap-2 rounded-lg border p-3">
                  <Checkbox
                    id="appointment-send-confirmation"
                    checked={appointmentForm.sendConfirmation}
                    onCheckedChange={(checked) =>
                      setAppointmentForm({
                        ...appointmentForm,
                        sendConfirmation: checked === true,
                      })
                    }
                  />
                  <Label htmlFor="appointment-send-confirmation" className="cursor-pointer text-sm">
                    Bestätigungs-E-Mail an {appointmentCustomer ? getCustomerEmail(appointmentCustomer) : 'Kunden'} senden
                  </Label>
                </div>
              )}

              {selectedAppointmentService && (
                <div className="rounded-lg bg-muted p-3 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>{selectedAppointmentService.duration_minutes} Minuten</span>
                    <span className="ml-auto font-medium text-foreground">
                      {formatCurrency(selectedAppointmentService.price_cents)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAppointmentDialogOpen(false)}
              >
                Abbrechen
              </Button>
              <Button
                type="submit"
                disabled={
                  isCreatingAppointment ||
                  appointmentValidation.errors.length > 0 ||
                  appointmentServices.length === 0 ||
                  staffMembers.length === 0
                }
              >
                {isCreatingAppointment ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
    </div>
  );
}
