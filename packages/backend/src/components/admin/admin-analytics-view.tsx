'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  Calendar as CalendarIcon,
  Download,
  FileSpreadsheet,
  Scissors,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  analyticsPeriodLabels,
  analyticsSourceLabels,
  type AnalyticsData,
  type AnalyticsPeriod,
  type AnalyticsSource,
} from '@/lib/domain/analytics';
import { cn } from '@/lib/utils';

interface AdminAnalyticsViewProps {
  data: AnalyticsData;
}

const periodOptions: AnalyticsPeriod[] = ['week', 'month', 'quarter', 'year', 'custom'];
const sourceOptions: AnalyticsSource[] = ['all', 'appointments', 'shop'];

function formatMoney(cents: number, currency = 'CHF'): string {
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

function formatDate(value: string, timezone = 'Europe/Zurich'): string {
  return new Intl.DateTimeFormat('de-CH', {
    timeZone: timezone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

function formatDateTime(value: string, timezone = 'Europe/Zurich'): string {
  return new Intl.DateTimeFormat('de-CH', {
    timeZone: timezone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatDateInput(value: string, timezone = 'Europe/Zurich'): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  const year = parts.find((part) => part.type === 'year')?.value || '';
  const month = parts.find((part) => part.type === 'month')?.value || '';
  const day = parts.find((part) => part.type === 'day')?.value || '';
  return `${year}-${month}-${day}`;
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat('de-CH', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function buildQuery(data: AnalyticsData, overrides: Partial<Record<string, string>> = {}) {
  const params = new URLSearchParams();
  const period = (overrides.period || data.filters.period) as AnalyticsPeriod;
  params.set('period', period);
  params.set('source', overrides.source || data.filters.source);

  const start = overrides.start || data.filters.startDate;
  const end = overrides.end || data.filters.endDate;
  if (period === 'custom' && start && end) {
    params.set('start', start);
    params.set('end', end);
  }

  return params;
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    reserved: 'Reserviert',
    requested: 'Angefragt',
    confirmed: 'Bestätigt',
    completed: 'Abgeschlossen',
    cancelled: 'Storniert',
    no_show: 'No-Show',
    paid: 'Bezahlt',
    partially_paid: 'Teilbezahlt',
    open: 'Offen',
    pending: 'Ausstehend',
    succeeded: 'Bezahlt',
    refunded: 'Erstattet',
    partially_refunded: 'Teilweise erstattet',
    failed: 'Fehler',
  };
  return labels[status] || status;
}

function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'completed' || status === 'confirmed' || status === 'paid' || status === 'succeeded') return 'default';
  if (status === 'cancelled' || status === 'no_show' || status === 'failed') return 'destructive';
  if (status === 'open' || status === 'refunded' || status === 'partially_refunded') return 'outline';
  return 'secondary';
}

function ChangeBadge({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-xs text-muted-foreground">kein Vergleich</span>;
  }

  const isPositive = value >= 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs', isPositive ? 'text-emerald-700' : 'text-red-700')}>
      <Icon className="h-3 w-3" />
      {isPositive ? '+' : ''}{formatPercent(value)}%
    </span>
  );
}

function RevenueChart({ data, currency }: { data: AnalyticsData['dailyRevenue']; currency: string }) {
  const visible = data.filter((day) => day.totalRevenue !== 0 || day.refundAmount > 0);

  if (visible.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        Keine Umsätze im gewählten Zeitraum
      </div>
    );
  }

  const maxRevenue = Math.max(...visible.map((day) => Math.max(Math.abs(day.totalRevenue), day.refundAmount)), 1);
  const labelInterval = visible.length > 14 ? Math.ceil(visible.length / 8) : 1;

  return (
    <div className="h-64">
      <div className="flex h-full items-end gap-1">
        {visible.map((day, index) => {
          const height = Math.max((Math.abs(day.totalRevenue) / maxRevenue) * 100, day.totalRevenue !== 0 ? 6 : 2);
          const showLabel = index % labelInterval === 0 || index === visible.length - 1;

          return (
            <div
              key={day.date}
              className="flex h-full min-w-6 flex-1 flex-col items-center"
              title={`${day.date}: ${formatMoney(day.totalRevenue, currency)}`}
            >
              <div className="flex w-full flex-1 items-end">
                <div
                  className={cn(
                    'w-full rounded-t transition-colors',
                    day.totalRevenue > 0 ? 'bg-primary' : day.totalRevenue < 0 ? 'bg-red-500' : 'bg-muted'
                  )}
                  style={{ height: `${height}%` }}
                />
              </div>
              <span className={cn('mt-1 text-[11px] text-muted-foreground', !showLabel && 'invisible')}>
                {day.date.slice(5)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AdminAnalyticsView({ data }: AdminAnalyticsViewProps) {
  const router = useRouter();
  const [isExporting, setIsExporting] = useState(false);
  const [customStart, setCustomStart] = useState(data.filters.startDate || formatDateInput(data.periodStart, data.timezone));
  const [customEnd, setCustomEnd] = useState(data.filters.endDate || formatDateInput(data.periodEnd, data.timezone));
  const currency = data.currency || 'CHF';

  const navigate = (overrides: Partial<Record<string, string>>) => {
    router.push(`/admin/analytics?${buildQuery(data, overrides).toString()}`);
  };

  const handleCustomApply = () => {
    if (!customStart || !customEnd) {
      toast.error('Bitte Start- und Enddatum wählen');
      return;
    }
    navigate({ period: 'custom', start: customStart, end: customEnd });
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const response = await fetch(`/api/admin/export/analytics?${buildQuery(data).toString()}`, {
        method: 'GET',
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error || 'Export fehlgeschlagen');
      }

      const blob = await response.blob();
      const disposition = response.headers.get('content-disposition') || '';
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] || `analytics-export-${customStart}_bis_${customEnd}.xlsx`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      toast.success('Analytics-Export wurde erstellt');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Export konnte nicht erstellt werden');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-normal">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            {data.salonName} · {formatDate(data.periodStart, data.timezone)} bis {formatDate(data.periodEnd, data.timezone)}
          </p>
        </div>

        <div className="flex flex-col gap-2 rounded-md border bg-card p-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-40 space-y-1">
            <Label className="text-xs">Zeitraum</Label>
            <Select value={data.filters.period} onValueChange={(value) => navigate({ period: value })}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {periodOptions.map((period) => (
                  <SelectItem key={period} value={period}>{analyticsPeriodLabels[period]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-40 space-y-1">
            <Label className="text-xs">Quelle</Label>
            <Select value={data.filters.source} onValueChange={(value) => navigate({ source: value })}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sourceOptions.map((source) => (
                  <SelectItem key={source} value={source}>{analyticsSourceLabels[source]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {data.filters.period === 'custom' && (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Von</Label>
                <Input className="h-9 w-36" type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Bis</Label>
                <Input className="h-9 w-36" type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} />
              </div>
              <Button variant="outline" className="h-9" onClick={handleCustomApply}>
                Anwenden
              </Button>
            </>
          )}

          <Button className="h-9" onClick={handleExportExcel} disabled={isExporting}>
            {isExporting ? <Download className="mr-2 h-4 w-4 animate-pulse" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
            Excel exportieren
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Netto-Umsatz"
          value={formatMoney(data.kpis.netRevenueCents, currency)}
          description="nach Rückerstattungen"
          icon={TrendingUp}
          footer={<ChangeBadge value={data.kpis.revenueChangePercent} />}
        />
        <KpiCard
          title="Termine"
          value={String(data.kpis.totalAppointments)}
          description={`${data.kpis.completedAppointments} abgeschlossen · ${data.kpis.cancelledAppointments} storniert`}
          icon={CalendarIcon}
        />
        <KpiCard
          title="Kunden"
          value={String(data.kpis.activeCustomers)}
          description={`${data.kpis.newCustomers} neu · ${data.kpis.returningCustomers} wiederkehrend`}
          icon={Users}
          footer={<ChangeBadge value={data.kpis.newCustomersChangePercent} />}
        />
        <KpiCard
          title="Ø Terminwert"
          value={formatMoney(data.kpis.averageAppointmentValueCents, currency)}
          description={`${formatPercent(data.kpis.cancellationRate)}% Storno · ${formatPercent(data.kpis.noShowRate)}% No-Show`}
          icon={Activity}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Umsatzverlauf</CardTitle>
            <CardDescription>
              Bezahlt, offen und Refunds basieren auf derselben Logik wie die Finanzseite.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RevenueChart data={data.dailyRevenue} currency={currency} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Operative Qualität</CardTitle>
            <CardDescription>Status und Buchungsquelle der Termine</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <MetricLine label="Bestätigt" value={data.kpis.confirmedAppointments} total={data.kpis.totalAppointments} />
            <MetricLine label="Abgeschlossen" value={data.kpis.completedAppointments} total={data.kpis.totalAppointments} />
            <MetricLine label="Anfragen" value={data.kpis.requestedAppointments} total={data.kpis.totalAppointments} />
            <MetricLine label="Online gebucht" value={data.kpis.onlineBookings} total={data.kpis.totalAppointments} />
            <MetricLine label="Admin gebucht" value={data.kpis.adminBookings} total={data.kpis.totalAppointments} />
            {data.kpis.openAmountCents > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4" />
                  <div>
                    <p className="font-medium">Offene Beträge vorhanden</p>
                    <p>{formatMoney(data.kpis.openAmountCents, currency)} sind nicht als Umsatz gezählt.</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="services" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="services"><Scissors className="mr-2 h-4 w-4" />Leistungen</TabsTrigger>
          <TabsTrigger value="staff"><UserCheck className="mr-2 h-4 w-4" />Mitarbeiter</TabsTrigger>
          <TabsTrigger value="customers"><Users className="mr-2 h-4 w-4" />Kunden</TabsTrigger>
          <TabsTrigger value="appointments"><CalendarIcon className="mr-2 h-4 w-4" />Termine</TabsTrigger>
          <TabsTrigger value="shop"><ShoppingBag className="mr-2 h-4 w-4" />Shop</TabsTrigger>
        </TabsList>

        <TabsContent value="services">
          <Card>
            <CardHeader>
              <CardTitle>Top-Leistungen</CardTitle>
              <CardDescription>Buchungen, Umsatz und Anteil am Terminumsatz</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Leistung</TableHead>
                    <TableHead className="text-right">Buchungen</TableHead>
                    <TableHead className="text-right">Umsatz</TableHead>
                    <TableHead className="text-right">Ø Preis</TableHead>
                    <TableHead className="text-right">Anteil</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.topServices.length === 0 ? (
                    <EmptyRow colSpan={5} text="Keine Leistungsdaten in diesem Zeitraum" />
                  ) : data.topServices.map((service) => (
                    <TableRow key={service.id}>
                      <TableCell className="font-medium">{service.name}</TableCell>
                      <TableCell className="text-right">{service.bookings}</TableCell>
                      <TableCell className="text-right">{formatMoney(service.revenueCents, currency)}</TableCell>
                      <TableCell className="text-right">{formatMoney(service.averagePriceCents, currency)}</TableCell>
                      <TableCell className="text-right">{formatPercent(service.sharePercent)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="staff">
          <Card>
            <CardHeader>
              <CardTitle>Mitarbeiter-Auswertung</CardTitle>
              <CardDescription>Terminanzahl, Umsatz und Qualitätsindikatoren</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mitarbeiter</TableHead>
                    <TableHead className="text-right">Termine</TableHead>
                    <TableHead className="text-right">Abgeschlossen</TableHead>
                    <TableHead className="text-right">Storniert</TableHead>
                    <TableHead className="text-right">No-Shows</TableHead>
                    <TableHead className="text-right">Umsatz</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.topStaff.length === 0 ? (
                    <EmptyRow colSpan={6} text="Keine Mitarbeiterdaten in diesem Zeitraum" />
                  ) : data.topStaff.map((staff) => (
                    <TableRow key={staff.id}>
                      <TableCell className="font-medium">{staff.name}</TableCell>
                      <TableCell className="text-right">{staff.appointments}</TableCell>
                      <TableCell className="text-right">{staff.completedAppointments}</TableCell>
                      <TableCell className="text-right">{staff.cancelledAppointments}</TableCell>
                      <TableCell className="text-right">{staff.noShowAppointments}</TableCell>
                      <TableCell className="text-right">{formatMoney(staff.revenueCents, currency)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customers">
          <Card>
            <CardHeader>
              <CardTitle>Kunden-Auswertung</CardTitle>
              <CardDescription>Umsatzstärkste Kunden und letzte Aktivität</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kunde</TableHead>
                    <TableHead>Kontakt</TableHead>
                    <TableHead className="text-right">Termine</TableHead>
                    <TableHead className="text-right">Bestellungen</TableHead>
                    <TableHead className="text-right">Umsatz</TableHead>
                    <TableHead>Typ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.topCustomers.length === 0 ? (
                    <EmptyRow colSpan={6} text="Keine Kundendaten in diesem Zeitraum" />
                  ) : data.topCustomers.slice(0, 20).map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">{customer.name}</TableCell>
                      <TableCell className="text-muted-foreground">{customer.email || customer.phone || '-'}</TableCell>
                      <TableCell className="text-right">{customer.appointments}</TableCell>
                      <TableCell className="text-right">{customer.orders}</TableCell>
                      <TableCell className="text-right">{formatMoney(customer.revenueCents, currency)}</TableCell>
                      <TableCell>
                        <Badge variant={customer.customerType === 'new' ? 'default' : 'secondary'}>
                          {customer.customerType === 'new' ? 'Neukunde' : 'Wiederkehrend'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appointments">
          <Card>
            <CardHeader>
              <CardTitle>Termin-Rohdaten</CardTitle>
              <CardDescription>Die letzten Termine im gewählten Zeitraum</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>Kunde</TableHead>
                    <TableHead>Mitarbeiter</TableHead>
                    <TableHead>Leistung(en)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Betrag</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.appointmentRows.length === 0 ? (
                    <EmptyRow colSpan={6} text="Keine Termine in diesem Zeitraum" />
                  ) : data.appointmentRows.slice(0, 25).map((appointment) => (
                    <TableRow key={appointment.id}>
                      <TableCell>{formatDateTime(appointment.startTime, data.timezone)}</TableCell>
                      <TableCell className="font-medium">{appointment.customerName}</TableCell>
                      <TableCell>{appointment.staffName}</TableCell>
                      <TableCell className="max-w-72 truncate">{appointment.services}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(appointment.status)}>{getStatusLabel(appointment.status)}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatMoney(appointment.amountCents, currency)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shop">
          <Card>
            <CardHeader>
              <CardTitle>Shop-Auswertung</CardTitle>
              <CardDescription>Bestellungen und Produktumsatz im Zeitraum</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bestellung</TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead>Kunde</TableHead>
                    <TableHead>Produkte</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Netto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.orderRows.length === 0 ? (
                    <EmptyRow colSpan={6} text="Keine Shop-Bestellungen in diesem Zeitraum" />
                  ) : data.orderRows.slice(0, 25).map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.orderNumber}</TableCell>
                      <TableCell>{formatDateTime(order.createdAt, data.timezone)}</TableCell>
                      <TableCell>{order.customerName}</TableCell>
                      <TableCell className="max-w-80 truncate">{order.products}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(order.paymentStatus)}>{getStatusLabel(order.paymentStatus)}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatMoney(order.netCents, currency)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KpiCard({
  title,
  value,
  description,
  icon: Icon,
  footer,
}: {
  title: string;
  value: string;
  description: string;
  icon: LucideIcon;
  footer?: ReactNode;
}) {
  return (
    <Card className="min-h-36">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        {footer && <div className="mt-3">{footer}</div>}
      </CardContent>
    </Card>
  );
}

function MetricLine({ label, value, total }: { label: string; value: number; total: number }) {
  const width = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="font-medium">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="h-24 text-center text-muted-foreground">
        {text}
      </TableCell>
    </TableRow>
  );
}
