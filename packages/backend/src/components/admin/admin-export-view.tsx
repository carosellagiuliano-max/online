'use client';

import { useState } from 'react';
import {
  Download,
  Upload,
  FileSpreadsheet,
  Users,
  Calendar,
  Package,
  ShoppingBag,
  Receipt,
  Star,
  Loader2,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import { features } from '@/lib/config/features';

// ============================================
// TYPES
// ============================================

type Period = 'week' | 'month' | 'quarter' | 'year' | 'all' | 'custom';

interface ExportOption {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  endpoint: string;
  shopOnly?: boolean;
  filters?: {
    dateRange?: boolean;
    status?: string[];
  };
}

// ============================================
// HELPERS
// ============================================

function getPeriodDates(period: Period): { from: string; to: string } | null {
  if (period === 'all') return null;
  if (period === 'custom') return null;

  const now = new Date();
  let startDate: Date;
  const endDate = now;

  switch (period) {
    case 'week':
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'quarter':
      const quarter = Math.floor(now.getMonth() / 3);
      startDate = new Date(now.getFullYear(), quarter * 3, 1);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      return null;
  }

  return {
    from: startDate.toISOString().split('T')[0],
    to: endDate.toISOString().split('T')[0],
  };
}

function formatDateRange(period: Period, customFrom?: string, customTo?: string): string {
  if (period === 'all') return 'Alle Daten';
  if (period === 'custom' && customFrom && customTo) {
    return `${formatDate(customFrom)} - ${formatDate(customTo)}`;
  }

  const dates = getPeriodDates(period);
  if (!dates) return '';
  return `${formatDate(dates.from)} - ${formatDate(dates.to)}`;
}

function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(dateString));
}

// ============================================
// EXPORT OPTIONS
// ============================================

const exportOptions: ExportOption[] = [
  {
    id: 'customers',
    name: 'Kunden',
    description: 'Kundendaten inkl. Kontaktinformationen',
    icon: Users,
    endpoint: '/api/admin/export/customers',
    filters: { dateRange: true },
  },
  {
    id: 'appointments',
    name: 'Termine',
    description: 'Alle Termine mit Details',
    icon: Calendar,
    endpoint: '/api/admin/export/appointments',
    filters: {
      dateRange: true,
      status: ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'],
    },
  },
  {
    id: 'orders',
    name: 'Bestellungen',
    description: 'Shop-Bestellungen und Umsätze',
    icon: ShoppingBag,
    endpoint: '/api/admin/export/orders',
    shopOnly: true,
    filters: {
      dateRange: true,
      status: ['pending', 'processing', 'shipped', 'completed', 'cancelled'],
    },
  },
  {
    id: 'products',
    name: 'Produkte',
    description: 'Produktkatalog mit Preisen und Bestand',
    icon: Package,
    endpoint: '/api/admin/export/products',
    shopOnly: true,
  },
  {
    id: 'services',
    name: 'Dienstleistungen',
    description: 'Alle Services mit Preisen und Dauer',
    icon: FileSpreadsheet,
    endpoint: '/api/admin/export/services',
  },
  {
    id: 'transactions',
    name: 'Transaktionen',
    description: 'Zahlungstransaktionen für Buchhaltung',
    icon: Receipt,
    endpoint: '/api/admin/export/transactions',
    shopOnly: true,
    filters: {
      dateRange: true,
      status: ['pending', 'processing', 'succeeded', 'failed', 'cancelled', 'refunded', 'partially_refunded'],
    },
  },
  {
    id: 'loyalty',
    name: 'Treuepunkte',
    description: 'Punktekonten und Transaktionen',
    icon: Star,
    endpoint: '/api/admin/export/loyalty',
    shopOnly: true,
  },
];

const statusLabels: Record<string, string> = {
  all: 'Alle',
  pending: 'Ausstehend',
  confirmed: 'Bestätigt',
  completed: 'Abgeschlossen',
  cancelled: 'Storniert',
  no_show: 'Nicht erschienen',
  processing: 'In Bearbeitung',
  succeeded: 'Erfolgreich',
  failed: 'Fehlgeschlagen',
  shipped: 'Versendet',
  delivered: 'Geliefert',
  refunded: 'Erstattet',
  partially_refunded: 'Teilweise erstattet',
};

// ============================================
// COMPONENT
// ============================================

export function AdminExportView() {
  const [selectedExport, setSelectedExport] = useState<ExportOption | null>(null);
  const [period, setPeriod] = useState<Period>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [statusFilters, setStatusFilters] = useState<Record<string, string>>({});
  const [isExporting, setIsExporting] = useState(false);

  // Import state
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importType, setImportType] = useState<string>('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    message: string;
    imported?: number;
    updated?: number;
    errors?: string[];
  } | null>(null);

  // Get effective date range
  const getDateRange = (): { from?: string; to?: string } => {
    if (period === 'all') return {};
    if (period === 'custom') {
      return { from: customFrom || undefined, to: customTo || undefined };
    }
    const dates = getPeriodDates(period);
    return dates || {};
  };

  // Handle export
  const handleExport = async (option: ExportOption) => {
    setIsExporting(true);
    setSelectedExport(option);

    try {
      const params = new URLSearchParams();
      const { from, to } = getDateRange();
      if (from) params.append('from', from);
      if (to) params.append('to', to);
      const statusFilter = statusFilters[option.id] || 'all';
      if (option.filters?.status && statusFilter !== 'all') params.append('status', statusFilter);

      const response = await fetch(`${option.endpoint}?${params.toString()}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Export error:', response.status, errorData);
        throw new Error(errorData.error || 'Export fehlgeschlagen');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${option.id}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      toast.success(`${option.name} exportiert`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Export fehlgeschlagen';
      toast.error(message);
    } finally {
      setIsExporting(false);
      setSelectedExport(null);
    }
  };

  // Handle import
  const handleImport = async () => {
    if (!importFile || !importType) {
      toast.error('Bitte Datei und Typ auswählen');
      return;
    }

    setIsImporting(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('type', importType);

      const response = await fetch('/api/admin/import', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      const result = await response.json();

      if (!response.ok) {
        setImportResult({
          success: false,
          message: result.error || 'Import fehlgeschlagen',
          errors: result.errors,
        });
      } else {
        setImportResult({
          success: true,
          message: 'Import erfolgreich',
          imported: result.imported,
          updated: result.updated,
        });
        const changed = (result.imported || 0) + (result.updated || 0);
        toast.success(`${changed} Einträge verarbeitet`);
      }
    } catch (error) {
      setImportResult({
        success: false,
        message: 'Fehler beim Import',
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Datenexport</h1>
          <p className="text-muted-foreground">
            {period === 'all'
              ? 'Exportieren Sie alle Daten im CSV-Format'
              : `Zeitraum: ${formatDateRange(period, customFrom, customTo)}`
            }
          </p>
        </div>
        <Button variant="outline" onClick={() => setIsImportDialogOpen(true)}>
          <Upload className="mr-2 h-4 w-4" />
          Daten importieren
        </Button>
      </div>

      {/* Filter Card */}
      <Card>
        <CardHeader>
          <CardTitle>Filter</CardTitle>
          <CardDescription>Zeitraum und Status für den Export auswählen</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            {/* Period Filter */}
            <div className="space-y-2">
              <Label>Zeitraum</Label>
              <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Zeitraum wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Letzte Woche</SelectItem>
                  <SelectItem value="month">Diesen Monat</SelectItem>
                  <SelectItem value="quarter">Dieses Quartal</SelectItem>
                  <SelectItem value="year">Dieses Jahr</SelectItem>
                  <SelectItem value="all">Alle Daten</SelectItem>
                  <SelectItem value="custom">Benutzerdefiniert</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom Date Picker */}
            {period === 'custom' && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Calendar className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="custom-from">Von</Label>
                      <Input
                        id="custom-from"
                        type="date"
                        value={customFrom}
                        onChange={(e) => setCustomFrom(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="custom-to">Bis</Label>
                      <Input
                        id="custom-to"
                        type="date"
                        value={customTo}
                        onChange={(e) => setCustomTo(e.target.value)}
                      />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}

          </div>
        </CardContent>
      </Card>

      {/* Export Options */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {exportOptions
          .filter((option) => !option.shopOnly || features.shopEnabled)
          .map((option) => {
            const Icon = option.icon;
            const isCurrentlyExporting = isExporting && selectedExport?.id === option.id;

            return (
              <Card key={option.id} className="hover:border-primary/50 transition-colors">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                  <CardTitle className="text-lg">{option.name}</CardTitle>
                  <CardDescription>{option.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {option.filters?.status && (
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select
                        value={statusFilters[option.id] || 'all'}
                        onValueChange={(value) =>
                          setStatusFilters((current) => ({ ...current, [option.id]: value }))
                        }
                        disabled={isExporting}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Alle" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Alle</SelectItem>
                          {option.filters.status.map((status) => (
                            <SelectItem key={status} value={status}>
                              {statusLabels[status] || status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <Button
                    className="w-full"
                    onClick={() => handleExport(option)}
                    disabled={isExporting}
                  >
                    {isCurrentlyExporting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Exportieren...
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
                        Als CSV exportieren
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
      </div>

      {/* Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Daten importieren</DialogTitle>
            <DialogDescription>
              Laden Sie eine CSV-Datei hoch, um Daten zu importieren
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="importType">Import-Typ</Label>
              <Select value={importType} onValueChange={setImportType}>
                <SelectTrigger id="importType">
                  <SelectValue placeholder="Typ auswählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customers">Kunden</SelectItem>
                  {features.shopEnabled && (
                    <SelectItem value="products">Produkte</SelectItem>
                  )}
                  <SelectItem value="services">Dienstleistungen</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="importFile">CSV-Datei</Label>
              <Input
                id="importFile"
                type="file"
                accept=".csv"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              />
              <p className="text-xs text-muted-foreground">
                Die erste Zeile muss die Spaltenüberschriften enthalten
              </p>
            </div>

            {importResult && (
              <Alert variant={importResult.success ? 'default' : 'destructive'}>
                {importResult.success ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertTitle>
                  {importResult.success ? 'Import erfolgreich' : 'Import fehlgeschlagen'}
                </AlertTitle>
                <AlertDescription>
                  {importResult.message}
                  {importResult.imported && (
                    <p className="mt-1">{importResult.imported} Einträge importiert</p>
                  )}
                  {importResult.updated ? (
                    <p className="mt-1">{importResult.updated} Einträge aktualisiert</p>
                  ) : null}
                  {importResult.errors && importResult.errors.length > 0 && (
                    <ul className="mt-2 list-disc pl-4 text-sm">
                      {importResult.errors.slice(0, 5).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                      {importResult.errors.length > 5 && (
                        <li>...und {importResult.errors.length - 5} weitere Fehler</li>
                      )}
                    </ul>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={handleImport}
              disabled={isImporting || !importFile || !importType}
            >
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importieren...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Importieren
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
