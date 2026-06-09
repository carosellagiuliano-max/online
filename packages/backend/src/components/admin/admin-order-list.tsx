'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Search,
  MoreHorizontal,
  ShoppingBag,
  Mail,
  Eye,
  Package,
  Truck,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Store,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

// ============================================
// TYPES
// ============================================

interface Order {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  payment_method: string | null;
  total_cents: number;
  customer_email: string;
  customer_name: string | null;
  shipping_method: string | null;
  created_at: string;
  paid_at: string | null;
}

interface AdminOrderListProps {
  orders: Order[];
  total: number;
  page: number;
  limit: number;
  initialSearch: string;
  initialStatus: string;
}

// ============================================
// CONSTANTS
// ============================================

const statusOptions = [
  { value: 'all', label: 'Alle Status' },
  { value: 'pending', label: 'Offen' },
  { value: 'processing', label: 'In Bearbeitung' },
  { value: 'shipped', label: 'Versendet' },
  { value: 'completed', label: 'Abgeschlossen' },
  { value: 'cancelled', label: 'Storniert' },
];

const statusConfig: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  pending: { label: 'Offen', variant: 'secondary' },
  processing: { label: 'In Bearbeitung', variant: 'default' },
  shipped: { label: 'Versendet', variant: 'default' },
  completed: { label: 'Abgeschlossen', variant: 'outline' },
  cancelled: { label: 'Storniert', variant: 'destructive' },
};

const paymentStatusConfig: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  pending: { label: 'Ausstehend', variant: 'secondary' },
  processing: { label: 'Verarbeitung', variant: 'secondary' },
  succeeded: { label: 'Erfolgreich', variant: 'default' },
  failed: { label: 'Fehlgeschlagen', variant: 'destructive' },
  refunded: { label: 'Erstattet', variant: 'outline' },
  partially_refunded: { label: 'Teilweise erstattet', variant: 'outline' },
};

const paymentMethodLabels: Record<string, string> = {
  stripe_card: 'Karte',
  stripe_twint: 'TWINT',
  cash: 'Bar',
  terminal: 'Terminal',
  voucher: 'Gutschein',
  pay_at_venue: 'Vor Ort',
};

const shippingMethodLabels: Record<string, string> = {
  standard: 'Standard',
  express: 'Express',
  pickup: 'Abholung',
  none: 'Keine',
};

// ============================================
// HELPERS
// ============================================

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF',
  }).format(cents / 100);
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

// ============================================
// ADMIN ORDER LIST
// ============================================

export function AdminOrderList({
  orders,
  total,
  page,
  limit,
  initialSearch,
  initialStatus,
}: AdminOrderListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(initialSearch);
  const [status, setStatus] = useState(initialStatus);

  const totalPages = Math.ceil(total / limit);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams);
    if (search) {
      params.set('search', search);
    } else {
      params.delete('search');
    }
    params.set('page', '1');
    router.push(`/admin/bestellungen?${params.toString()}`);
  };

  const handleStatusChange = (value: string) => {
    setStatus(value);
    const params = new URLSearchParams(searchParams);
    if (value && value !== 'all') {
      params.set('status', value);
    } else {
      params.delete('status');
    }
    params.set('page', '1');
    router.push(`/admin/bestellungen?${params.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', newPage.toString());
    router.push(`/admin/bestellungen?${params.toString()}`);
  };

  const handleViewOrder = (order: Order) => {
    router.push(`/admin/bestellungen/${order.id}`);
  };

  const handleOrderStatusUpdate = async (orderId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Fehler beim Aktualisieren');
      }

      toast.success('Status aktualisiert');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Fehler beim Aktualisieren des Status');
    }
  };

  const handleConfirmPayment = async (orderId: string) => {
    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmPayment: true, status: 'processing' }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Fehler beim Bestätigen');
      }

      toast.success('Zahlung bestätigt');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Fehler beim Bestätigen der Zahlung');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {total} Bestellungen insgesamt
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Suchen..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 w-48"
              />
            </div>
            <Button type="submit" variant="secondary">
              Suchen
            </Button>
          </form>
          <Select value={status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Orders Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bestellung</TableHead>
                <TableHead>Kunde</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Zahlung</TableHead>
                <TableHead>Versand</TableHead>
                <TableHead className="text-right">Betrag</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <ShoppingBag className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        Keine Bestellungen gefunden
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((order) => {
                  const orderStatus = statusConfig[order.status] || {
                    label: order.status,
                    variant: 'secondary' as const,
                  };
                  const paymentStatus = paymentStatusConfig[
                    order.payment_status
                  ] || {
                    label: order.payment_status,
                    variant: 'secondary' as const,
                  };

                  return (
                    <TableRow key={order.id}>
                      <TableCell>
                        <button
                          onClick={() => handleViewOrder(order)}
                          className="font-medium hover:text-primary transition-colors"
                        >
                          #{order.order_number}
                        </button>
                      </TableCell>
                      <TableCell>
                        <div>
                          {order.customer_name && (
                            <p className="font-medium">{order.customer_name}</p>
                          )}
                          <a
                            href={`mailto:${order.customer_email}`}
                            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                          >
                            <Mail className="h-3 w-3" />
                            {order.customer_email}
                          </a>
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="cursor-pointer">
                              <Badge variant={orderStatus.variant} className="hover:opacity-80 transition-opacity">
                                {orderStatus.label}
                              </Badge>
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            {statusOptions
                              .filter((o) => o.value !== 'all' && o.value !== order.status)
                              .map((option) => (
                                <DropdownMenuItem
                                  key={option.value}
                                  onClick={() => handleOrderStatusUpdate(order.id, option.value)}
                                >
                                  {option.label}
                                </DropdownMenuItem>
                              ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant={paymentStatus.variant} className="w-fit">
                            {paymentStatus.label}
                          </Badge>
                          {order.payment_method && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              {order.payment_method === 'pay_at_venue' ? (
                                <Store className="h-3 w-3" />
                              ) : (
                                <CreditCard className="h-3 w-3" />
                              )}
                              {paymentMethodLabels[order.payment_method] ||
                                order.payment_method}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {order.shipping_method && (
                          <span className="text-sm flex items-center gap-1">
                            {order.shipping_method === 'pickup' ? (
                              <Package className="h-3 w-3" />
                            ) : (
                              <Truck className="h-3 w-3" />
                            )}
                            {shippingMethodLabels[order.shipping_method] ||
                              order.shipping_method}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(order.total_cents)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(order.created_at)}
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
                              onClick={() => handleViewOrder(order)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Details anzeigen
                            </DropdownMenuItem>
                            {order.payment_method === 'pay_at_venue' && order.payment_status === 'pending' && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleConfirmPayment(order.id)}
                                >
                                  <CreditCard className="h-4 w-4 mr-2" />
                                  Bezahlung bestätigen
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleOrderStatusUpdate(order.id, 'shipped')}
                            >
                              <Truck className="h-4 w-4 mr-2" />
                              Als versendet markieren
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
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
    </div>
  );
}
