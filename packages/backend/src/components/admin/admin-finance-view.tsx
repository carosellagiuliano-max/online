'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Banknote,
  Calendar,
  CreditCard,
  Download,
  FileSpreadsheet,
  Receipt,
  ShoppingBag,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  type DailySales,
  type FinanceData,
  type FinancePaymentMethod,
  type FinancePaymentState,
  type FinancePeriod,
  type FinanceSource,
  type FinanceTransaction,
  financePaymentMethodLabels,
  financePaymentStateLabels,
  financeSourceLabels,
} from '@/lib/domain/finance';
import { cn } from '@/lib/utils';

interface AdminFinanceViewProps {
  data: FinanceData;
}

const periodLabels: Record<FinancePeriod, string> = {
  week: 'Letzte 7 Tage',
  month: 'Diesen Monat',
  quarter: 'Dieses Quartal',
  year: 'Dieses Jahr',
  custom: 'Benutzerdefiniert',
};

const sourceLabels: Record<FinanceSource, string> = {
  all: 'Alle',
  shop: 'Shop',
  salon: 'Salon',
};

const paymentStateOptions: FinancePaymentState[] = ['all', 'paid', 'open', 'refunded', 'failed'];
const paymentMethodOptions: FinancePaymentMethod[] = ['all', 'stripe_card', 'stripe_twint', 'cash', 'terminal', 'voucher', 'manual_adjustment', 'pay_at_venue'];

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

function getPaymentMethodLabel(method: string): string {
  return financePaymentMethodLabels[method as FinancePaymentMethod] || method || 'Unbekannt';
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Ausstehend',
    processing: 'In Bearbeitung',
    succeeded: 'Bezahlt',
    paid: 'Bezahlt',
    partially_paid: 'Teilbezahlt',
    open: 'Offen',
    failed: 'Fehlgeschlagen',
    refunded: 'Erstattet',
    partially_refunded: 'Teilweise erstattet',
    confirmed: 'Bestätigt',
    completed: 'Abgeschlossen',
    requested: 'Angefragt',
  };
  return labels[status] || status;
}

function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'succeeded' || status === 'paid' || status === 'completed') return 'default';
  if (status === 'failed' || status === 'cancelled') return 'destructive';
  if (status === 'refunded' || status === 'partially_refunded' || status === 'open') return 'outline';
  return 'secondary';
}

function getPaymentIcon(method: string) {
  if (method === 'cash' || method === 'pay_at_venue') return Banknote;
  if (method === 'voucher') return Wallet;
  return CreditCard;
}

function buildQuery(data: FinanceData, overrides: Partial<Record<string, string>> = {}) {
  const params = new URLSearchParams();
  params.set('period', overrides.period || data.filters.period);
  params.set('source', overrides.source || data.filters.source);
  params.set('state', overrides.state || data.filters.paymentState);
  params.set('method', overrides.method || data.filters.paymentMethod);

  const start = overrides.start || data.filters.startDate;
  const end = overrides.end || data.filters.endDate;
  if ((overrides.period || data.filters.period) === 'custom' && start && end) {
    params.set('start', start);
    params.set('end', end);
  }

  return params;
}

function RevenueChart({ data, currency }: { data: DailySales[]; currency: string }) {
  const visible = data.filter((day) => day.totalRevenue !== 0 || day.refundAmount > 0);

  if (visible.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        Keine Umsätze in diesem Zeitraum
      </div>
    );
  }

  const maxRevenue = Math.max(...visible.map((day) => Math.max(Math.abs(day.totalRevenue), day.refundAmount)), 1);
  const labelInterval = visible.length > 14 ? Math.ceil(visible.length / 8) : 1;

  return (
    <div className="h-56">
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

export function AdminFinanceView({ data }: AdminFinanceViewProps) {
  const router = useRouter();
  const [isExporting, setIsExporting] = useState(false);
  const [customStart, setCustomStart] = useState(data.filters.startDate || formatDateInput(data.stats.periodStart, data.stats.timezone));
  const [customEnd, setCustomEnd] = useState(data.filters.endDate || formatDateInput(data.stats.periodEnd, data.stats.timezone));
  const currency = data.stats.currency || 'CHF';
  const totalMethodAmount = data.paymentMethods.reduce((sum, item) => sum + item.totalCents, 0);

  const navigate = (overrides: Partial<Record<string, string>>) => {
    router.push(`/admin/finanzen?${buildQuery(data, overrides).toString()}`);
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
      const response = await fetch(`/api/admin/export/finance?${buildQuery(data).toString()}`, {
        method: 'GET',
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error || 'Export fehlgeschlagen');
      }

      const blob = await response.blob();
      const disposition = response.headers.get('content-disposition') || '';
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] || `finanzen-export-${customStart}_bis_${customEnd}.xlsx`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('Excel-Export erstellt');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Excel-Export konnte nicht erstellt werden');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-normal">Finanzen</h1>
          <p className="text-sm text-muted-foreground">
            {data.stats.salonName} · {formatDate(data.stats.periodStart, data.stats.timezone)} bis {formatDate(data.stats.periodEnd, data.stats.timezone)}
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:justify-end">
          <Select value={data.filters.source} onValueChange={(value) => navigate({ source: value })}>
            <SelectTrigger className="h-10 w-full lg:w-[140px]">
              <SelectValue placeholder="Quelle" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Quellen</SelectItem>
              <SelectItem value="shop">Shop</SelectItem>
              <SelectItem value="salon">Salon</SelectItem>
            </SelectContent>
          </Select>

          <Select value={data.filters.paymentState} onValueChange={(value) => navigate({ state: value })}>
            <SelectTrigger className="h-10 w-full lg:w-[170px]">
              <SelectValue placeholder="Zahlungsstatus" />
            </SelectTrigger>
            <SelectContent>
              {paymentStateOptions.map((state) => (
                <SelectItem key={state} value={state}>{financePaymentStateLabels[state]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={data.filters.paymentMethod} onValueChange={(value) => navigate({ method: value })}>
            <SelectTrigger className="h-10 w-full lg:w-[180px]">
              <SelectValue placeholder="Zahlungsart" />
            </SelectTrigger>
            <SelectContent>
              {paymentMethodOptions.map((method) => (
                <SelectItem key={method} value={method}>{financePaymentMethodLabels[method]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={data.filters.period} onValueChange={(value) => navigate({ period: value })}>
            <SelectTrigger className="h-10 w-full lg:w-[170px]">
              <SelectValue placeholder="Zeitraum" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(periodLabels).map(([period, label]) => (
                <SelectItem key={period} value={period}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button className="h-10" onClick={handleExportExcel} disabled={isExporting}>
            {isExporting ? <Download className="mr-2 h-4 w-4 animate-pulse" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
            Excel exportieren
          </Button>
        </div>
      </div>

      {data.filters.period === 'custom' && (
        <Card>
          <CardContent className="grid gap-4 pt-6 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <div className="space-y-2">
              <Label htmlFor="finance-start">Von</Label>
              <Input id="finance-start" type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="finance-end">Bis</Label>
              <Input id="finance-end" type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} />
            </div>
            <Button onClick={handleCustomApply}>Zeitraum anwenden</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Bezahlter Umsatz" value={formatMoney(data.stats.paidRevenueCents, currency)} description={`${data.stats.paymentCount} Zahlungen · Ø ${formatMoney(data.stats.averagePaymentCents, currency)}`} icon={TrendingUp} />
        <MetricCard title="Netto nach Refunds" value={formatMoney(data.stats.netRevenueCents, currency)} description={`${formatMoney(data.stats.totalRefundsCents, currency)} Rückerstattungen abgezogen`} icon={Receipt} accent="text-green-600" />
        <MetricCard title="Offene Beträge" value={formatMoney(data.stats.openAmountCents, currency)} description={`${data.stats.openOrders} Bestellungen · ${data.stats.openAppointments} Termine offen`} icon={AlertTriangle} accent={data.stats.openAmountCents > 0 ? 'text-amber-600' : undefined} />
        <MetricCard title="MwSt enthalten" value={formatMoney(data.stats.vatCents, currency)} description={`${data.stats.vatRate}% · netto exkl. MwSt ${formatMoney(data.stats.netBeforeVatCents, currency)}`} icon={Wallet} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard title="Shop" value={formatMoney(data.stats.shopRevenueCents, currency)} description={`${data.stats.paidOrders} bezahlte von ${data.stats.totalOrders} Bestellungen`} icon={ShoppingBag} />
        <MetricCard title="Salon-Termine" value={formatMoney(data.stats.appointmentRevenueCents, currency)} description={`${data.stats.paidAppointments} bezahlte von ${data.stats.totalAppointments} Terminen`} icon={Calendar} />
        <MetricCard title="Zahlungsausfälle" value={formatMoney(data.stats.failedAmountCents, currency)} description="Fehlgeschlagene oder nicht abgeschlossene Zahlungen" icon={CreditCard} accent={data.stats.failedAmountCents > 0 ? 'text-red-600' : undefined} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Umsatzverlauf</CardTitle>
            <CardDescription>Bezahlte Umsätze abzüglich Refunds, nach Zeitraum gefiltert.</CardDescription>
          </CardHeader>
          <CardContent>
            <RevenueChart data={data.dailySales} currency={currency} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Zahlungsarten</CardTitle>
            <CardDescription>Netto-Zahlungen ohne offene Beträge.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.paymentMethods.length === 0 ? (
              <div className="flex h-40 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                Keine Zahlungen gefunden
              </div>
            ) : (
              data.paymentMethods.map((method) => {
                const Icon = getPaymentIcon(method.method);
                const percentage = totalMethodAmount > 0 ? Math.round((method.totalCents / totalMethodAmount) * 100) : 0;
                return (
                  <div key={method.method} className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate text-sm font-medium">{getPaymentMethodLabel(method.method)}</span>
                        <span className="text-xs text-muted-foreground">({method.count}x)</span>
                      </div>
                      <span className="text-sm font-medium">{formatMoney(method.totalCents, currency)}</span>
                    </div>
                    <Progress value={percentage} className="h-2" />
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="transactions" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:w-[560px]">
          <TabsTrigger value="transactions">Zahlungen</TabsTrigger>
          <TabsTrigger value="open">Offen</TabsTrigger>
          <TabsTrigger value="breakdown">Auswertung</TabsTrigger>
          <TabsTrigger value="notes">Hinweise</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions">
          <TransactionsTable rows={data.transactions.slice(0, 80)} currency={currency} timezone={data.stats.timezone} />
        </TabsContent>

        <TabsContent value="open">
          <OpenItemsTable data={data} />
        </TabsContent>

        <TabsContent value="breakdown">
          <div className="grid gap-6 xl:grid-cols-3">
            <BreakdownTable title="Mitarbeiter" rows={data.employeeBreakdown.slice(0, 12)} currency={currency} />
            <BreakdownTable title="Produkte & Leistungen" rows={data.productBreakdown.slice(0, 12)} currency={currency} />
            <BreakdownTable title="Kunden" rows={data.customerBreakdown.slice(0, 12)} currency={currency} />
          </div>
        </TabsContent>

        <TabsContent value="notes">
          <Card>
            <CardHeader>
              <CardTitle>Berechnungslogik</CardTitle>
              <CardDescription>Transparente Regeln für Tagesabschluss und Export.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Bezahlter Umsatz zählt Shop-Bestellungen mit erfolgreichem Zahlungsstatus und Terminzahlungen, die im Admin tatsächlich als bezahlt erfasst wurden.</p>
              <p>Offene Beträge zeigen aktive Bestellungen und Termine, bei denen der Gesamtbetrag noch nicht vollständig bezahlt ist. Stornierte Termine und vollständig erstattete Bestellungen werden nicht als offener Umsatz gezählt.</p>
              <p>Refunds werden separat ausgewiesen und für den Netto-Umsatz abgezogen. Der Excel-Export verwendet dieselben Filter und dieselbe Berechnungslogik wie diese Seite.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  accent,
}: {
  title: string;
  value: string;
  description: string;
  icon: typeof TrendingUp;
  accent?: string;
}) {
  return (
    <Card className="min-h-[136px]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className={cn('text-2xl font-bold tracking-normal', accent)}>{value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function TransactionsTable({ rows, currency, timezone }: { rows: FinanceTransaction[]; currency: string; timezone: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Zahlungen und Refunds</CardTitle>
        <CardDescription>Die letzten Finanzbewegungen innerhalb der aktuellen Filter.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead>
                <TableHead>Kunde</TableHead>
                <TableHead>Quelle</TableHead>
                <TableHead>Referenz</TableHead>
                <TableHead>Zahlungsart</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Brutto</TableHead>
                <TableHead className="text-right">Refund</TableHead>
                <TableHead className="text-right">Netto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-28 text-center text-muted-foreground">Keine Zahlungen in diesem Zeitraum</TableCell>
                </TableRow>
              ) : rows.map((row) => (
                <TableRow key={`${row.source}-${row.id}`}>
                  <TableCell className="whitespace-nowrap">{formatDateTime(row.date, timezone)}</TableCell>
                  <TableCell>
                    <div className="font-medium">{row.customerName}</div>
                    {row.customerEmail && <div className="text-xs text-muted-foreground">{row.customerEmail}</div>}
                  </TableCell>
                  <TableCell>{row.source === 'shop' ? 'Shop' : row.source === 'appointment' ? 'Termin' : 'Zahlung'}</TableCell>
                  <TableCell className="font-mono text-xs">{row.reference}</TableCell>
                  <TableCell>{getPaymentMethodLabel(row.method)}</TableCell>
                  <TableCell><Badge variant={getStatusVariant(row.status)}>{getStatusLabel(row.status)}</Badge></TableCell>
                  <TableCell className="text-right">{formatMoney(row.grossCents, currency)}</TableCell>
                  <TableCell className="text-right">{row.refundCents > 0 ? `-${formatMoney(row.refundCents, currency)}` : '-'}</TableCell>
                  <TableCell className="text-right font-medium">{formatMoney(row.netCents, currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function OpenItemsTable({ data }: { data: FinanceData }) {
  const currency = data.stats.currency;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Offene Beträge</CardTitle>
        <CardDescription>Aktive Bestellungen und Termine mit Restbetrag.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead>
                <TableHead>Kunde</TableHead>
                <TableHead>Quelle</TableHead>
                <TableHead>Referenz</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Bezahlt</TableHead>
                <TableHead className="text-right">Offen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.openItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-28 text-center text-muted-foreground">Keine offenen Beträge im aktuellen Filter</TableCell>
                </TableRow>
              ) : data.openItems.slice(0, 80).map((item) => (
                <TableRow key={`${item.source}-${item.id}`}>
                  <TableCell>{formatDateTime(item.date, data.stats.timezone)}</TableCell>
                  <TableCell>
                    <div className="font-medium">{item.customerName}</div>
                    <div className="text-xs text-muted-foreground">{item.customerEmail || item.customerPhone || 'Keine Kontaktdaten'}</div>
                  </TableCell>
                  <TableCell>{item.source === 'shop' ? 'Shop' : 'Termin'}</TableCell>
                  <TableCell className="font-mono text-xs">{item.reference}</TableCell>
                  <TableCell><Badge variant="outline">{getStatusLabel(item.status)}</Badge></TableCell>
                  <TableCell className="text-right">{formatMoney(item.totalCents, currency)}</TableCell>
                  <TableCell className="text-right">{formatMoney(item.paidCents, currency)}</TableCell>
                  <TableCell className="text-right font-medium text-amber-600">{formatMoney(item.openCents, currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function BreakdownTable({ title, rows, currency }: { title: string; rows: Array<{ id: string; label: string; count: number; netCents: number; openCents: number }>; currency: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Users className="h-4 w-4" />{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Anzahl</TableHead>
              <TableHead className="text-right">Umsatz</TableHead>
              <TableHead className="text-right">Offen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">Keine Daten</TableCell>
              </TableRow>
            ) : rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="max-w-40 truncate font-medium">{row.label}</TableCell>
                <TableCell className="text-right">{row.count}</TableCell>
                <TableCell className="text-right">{formatMoney(row.netCents, currency)}</TableCell>
                <TableCell className="text-right">{row.openCents > 0 ? formatMoney(row.openCents, currency) : '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
