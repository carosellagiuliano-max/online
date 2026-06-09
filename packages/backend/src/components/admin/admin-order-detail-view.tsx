'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Package,
  Truck,
  CreditCard,
  User,
  MapPin,
  Calendar,
  Clock,
  RefreshCw,
  FileText,
  ExternalLink,
  Copy,
  Check,
  X,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

// ============================================
// TYPES
// ============================================

interface OrderDetail {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string | null;
  paymentIntentId: string | null;
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  shippingMethod: string | null;
  trackingNumber: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
  } | null;
  shippingAddress: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  } | null;
  billingAddress: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  } | null;
}

interface OrderItem {
  id: string;
  productId: string | null;
  productName: string;
  variantName: string | null;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  sku: string | null;
}

interface OrderEvent {
  id: string;
  eventType: string;
  description: string | null;
  createdAt: string;
  createdBy: string | null;
}

interface AdminOrderDetailViewProps {
  order: OrderDetail;
  items: OrderItem[];
  events: OrderEvent[];
}

// ============================================
// HELPERS
// ============================================

function formatCurrency(cents: number): string {
  return `CHF ${(cents / 100).toFixed(2)}`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusConfig(status: string) {
  const config: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    pending: { label: 'Offen', variant: 'secondary' },
    processing: { label: 'In Bearbeitung', variant: 'default' },
    shipped: { label: 'Versendet', variant: 'default' },
    completed: { label: 'Abgeschlossen', variant: 'outline' },
    cancelled: { label: 'Storniert', variant: 'destructive' },
  };
  return config[status] || { label: status, variant: 'outline' as const };
}

function getPaymentStatusConfig(status: string) {
  const config: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    pending: { label: 'Ausstehend', variant: 'secondary' },
    succeeded: { label: 'Bezahlt', variant: 'default' },
    failed: { label: 'Fehlgeschlagen', variant: 'destructive' },
    refunded: { label: 'Erstattet', variant: 'destructive' },
    partially_refunded: { label: 'Teilweise erstattet', variant: 'secondary' },
  };
  return config[status] || { label: status, variant: 'outline' as const };
}

function getEventLabel(eventType: string): string {
  const labels: Record<string, string> = {
    created: 'Bestellung erstellt',
    payment_received: 'Zahlung erhalten',
    processing: 'In Bearbeitung',
    shipped: 'Versendet',
    delivered: 'Zugestellt',
    cancelled: 'Storniert',
    refunded: 'Erstattet',
    note_added: 'Notiz hinzugefügt',
    status_changed: 'Status geändert',
  };
  return labels[eventType] || eventType;
}

// ============================================
// COMPONENT
// ============================================

export function AdminOrderDetailView({
  order,
  items,
  events,
}: AdminOrderDetailViewProps) {
  const router = useRouter();
  const [isRefundDialogOpen, setIsRefundDialogOpen] = useState(false);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [isTrackingDialogOpen, setIsTrackingDialogOpen] = useState(false);

  const [refundAmount, setRefundAmount] = useState(order.totalCents);
  const [refundReason, setRefundReason] = useState('');
  const [newStatus, setNewStatus] = useState(order.status);
  const [trackingNumber, setTrackingNumber] = useState(order.trackingNumber || '');
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const statusConfig = getStatusConfig(order.status);
  const paymentStatusConfig = getPaymentStatusConfig(order.paymentStatus);

  // Copy to clipboard
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('In Zwischenablage kopiert');
  };

  // Process refund
  const handleRefund = async () => {
    if (refundAmount <= 0 || refundAmount > order.totalCents) {
      toast.error('Ungültiger Betrag');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/orders/${order.id}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountCents: refundAmount,
          reason: refundReason,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Fehler bei der Erstattung');
      }

      toast.success('Erstattung erfolgreich');
      setIsRefundDialogOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Fehler bei der Erstattung');
    } finally {
      setIsSaving(false);
    }
  };

  // Confirm payment (for pay_at_venue orders)
  const handleConfirmPayment = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/orders/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmPayment: true, status: 'processing' }),
      });

      if (!response.ok) {
        throw new Error('Fehler beim Bestätigen der Zahlung');
      }

      toast.success('Zahlung bestätigt');
      router.refresh();
    } catch {
      toast.error('Fehler beim Bestätigen der Zahlung');
    } finally {
      setIsSaving(false);
    }
  };

  // Update status
  const handleUpdateStatus = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/orders/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Fehler beim Aktualisieren');
      }

      toast.success('Status aktualisiert');
      setIsStatusDialogOpen(false);
      router.refresh();
    } catch {
      toast.error('Fehler beim Aktualisieren des Status');
    } finally {
      setIsSaving(false);
    }
  };

  // Update tracking
  const handleUpdateTracking = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/orders/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackingNumber,
          status: 'shipped',
        }),
      });

      if (!response.ok) {
        throw new Error('Fehler beim Aktualisieren');
      }

      toast.success('Sendungsverfolgung aktualisiert');
      setIsTrackingDialogOpen(false);
      router.refresh();
    } catch {
      toast.error('Fehler beim Aktualisieren');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/admin/bestellungen')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{order.orderNumber}</h1>
              <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
              <Badge variant={paymentStatusConfig.variant}>{paymentStatusConfig.label}</Badge>
            </div>
            <p className="text-muted-foreground">{formatDate(order.createdAt)}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {order.paymentMethod === 'pay_at_venue' && order.paymentStatus === 'pending' && (
            <Button onClick={handleConfirmPayment} disabled={isSaving}>
              <CreditCard className="mr-2 h-4 w-4" />
              {isSaving ? 'Wird bestätigt...' : 'Bezahlung bestätigen'}
            </Button>
          )}
          {order.paymentStatus === 'succeeded' && order.status !== 'cancelled' && (
            <Button variant="outline" onClick={() => setIsRefundDialogOpen(true)}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Erstatten
            </Button>
          )}
          {order.status === 'processing' && (
            <Button onClick={() => setIsTrackingDialogOpen(true)}>
              <Truck className="mr-2 h-4 w-4" />
              Versand
            </Button>
          )}
          <Button variant="outline" onClick={() => setIsStatusDialogOpen(true)}>
            Status ändern
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Bestellte Artikel
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Artikel</TableHead>
                    <TableHead className="text-center">Menge</TableHead>
                    <TableHead className="text-right">Einzelpreis</TableHead>
                    <TableHead className="text-right">Gesamt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.productName}</p>
                          {item.variantName && (
                            <p className="text-sm text-muted-foreground">{item.variantName}</p>
                          )}
                          {item.sku && (
                            <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{item.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.unitPriceCents)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.totalCents)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={3}>Zwischensumme</TableCell>
                    <TableCell className="text-right">{formatCurrency(order.subtotalCents)}</TableCell>
                  </TableRow>
                  {order.shippingCents > 0 && (
                    <TableRow>
                      <TableCell colSpan={3}>Versand</TableCell>
                      <TableCell className="text-right">{formatCurrency(order.shippingCents)}</TableCell>
                    </TableRow>
                  )}
                  {order.taxCents > 0 && (
                    <TableRow>
                      <TableCell colSpan={3}>MwSt.</TableCell>
                      <TableCell className="text-right">{formatCurrency(order.taxCents)}</TableCell>
                    </TableRow>
                  )}
                  <TableRow>
                    <TableCell colSpan={3} className="font-bold">Total</TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(order.totalCents)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Verlauf
              </CardTitle>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <p className="text-center py-4 text-muted-foreground">Keine Ereignisse</p>
              ) : (
                <div className="space-y-4">
                  {events.map((event, index) => (
                    <div key={event.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                        {index < events.length - 1 && (
                          <div className="w-0.5 flex-1 bg-border mt-2" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <p className="font-medium">{getEventLabel(event.eventType)}</p>
                        {event.description && (
                          <p className="text-sm text-muted-foreground">{event.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDate(event.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Kunde
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {order.customer ? (
                <>
                  <p className="font-medium">
                    {order.customer.firstName} {order.customer.lastName}
                  </p>
                  <a
                    href={`mailto:${order.customer.email}`}
                    className="text-sm text-primary hover:underline block"
                  >
                    {order.customer.email}
                  </a>
                  {order.customer.phone && (
                    <a
                      href={`tel:${order.customer.phone}`}
                      className="text-sm text-muted-foreground block"
                    >
                      {order.customer.phone}
                    </a>
                  )}
                  <Button
                    variant="link"
                    className="p-0 h-auto"
                    onClick={() => router.push(`/admin/kunden/${order.customer!.id}`)}
                  >
                    Kundenprofil ansehen
                    <ExternalLink className="ml-1 h-3 w-3" />
                  </Button>
                </>
              ) : (
                <p className="text-muted-foreground">Kein Kunde zugeordnet</p>
              )}
            </CardContent>
          </Card>

          {/* Shipping Address */}
          {order.shippingAddress && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Lieferadresse
                </CardTitle>
              </CardHeader>
              <CardContent>
                <address className="not-italic text-sm">
                  <p>{order.shippingAddress.street}</p>
                  <p>{order.shippingAddress.postalCode} {order.shippingAddress.city}</p>
                  <p>{order.shippingAddress.country}</p>
                </address>
              </CardContent>
            </Card>
          )}

          {/* Payment Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Zahlung
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant={paymentStatusConfig.variant}>{paymentStatusConfig.label}</Badge>
              </div>
              {order.paymentIntentId && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Payment ID</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-1 font-mono text-xs"
                    onClick={() => handleCopy(order.paymentIntentId!)}
                  >
                    {order.paymentIntentId.slice(0, 15)}...
                    {copied ? <Check className="ml-1 h-3 w-3" /> : <Copy className="ml-1 h-3 w-3" />}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tracking Info */}
          {order.trackingNumber && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Sendungsverfolgung
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm">{order.trackingNumber}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(order.trackingNumber!)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          {order.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Notizen
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {order.notes}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Refund Dialog */}
      <Dialog open={isRefundDialogOpen} onOpenChange={setIsRefundDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Erstattung durchführen
            </DialogTitle>
            <DialogDescription>
              Der Betrag wird über Stripe erstattet. Diese Aktion kann nicht rückgängig gemacht werden.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="refundAmount">Betrag (Rappen)</Label>
              <Input
                id="refundAmount"
                type="number"
                value={refundAmount}
                onChange={(e) => setRefundAmount(parseInt(e.target.value) || 0)}
                max={order.totalCents}
                min={1}
              />
              <p className="text-sm text-muted-foreground">
                Max. {formatCurrency(order.totalCents)} | Eingegebener Betrag: {formatCurrency(refundAmount)}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="refundReason">Grund (optional)</Label>
              <Textarea
                id="refundReason"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="z.B. Kundenanfrage, Artikel beschädigt..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRefundDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={handleRefund} disabled={isSaving}>
              {isSaving ? 'Wird erstattet...' : `${formatCurrency(refundAmount)} erstatten`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Dialog */}
      <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bestellstatus ändern</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="newStatus">Neuer Status</Label>
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger id="newStatus" className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Offen</SelectItem>
                <SelectItem value="processing">In Bearbeitung</SelectItem>
                <SelectItem value="shipped">Versendet</SelectItem>
                <SelectItem value="completed">Abgeschlossen</SelectItem>
                <SelectItem value="cancelled">Storniert</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsStatusDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleUpdateStatus} disabled={isSaving}>
              {isSaving ? 'Speichern...' : 'Speichern'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tracking Dialog */}
      <Dialog open={isTrackingDialogOpen} onOpenChange={setIsTrackingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sendungsverfolgung</DialogTitle>
            <DialogDescription>
              Geben Sie die Tracking-Nummer ein. Der Bestellstatus wird auf &quot;Versendet&quot; gesetzt.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="trackingNumber">Tracking-Nummer</Label>
            <Input
              id="trackingNumber"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="z.B. 123456789"
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTrackingDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleUpdateTracking} disabled={isSaving || !trackingNumber}>
              {isSaving ? 'Speichern...' : 'Versand bestätigen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
