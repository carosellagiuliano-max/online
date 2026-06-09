'use client';

import Link from 'next/link';
import {
  Calendar,
  Users,
  ShoppingBag,
  TrendingUp,
  Clock,
  AlertCircle,
  ChevronRight,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { features } from '@/lib/config/features';

// ============================================
// TYPES
// ============================================

interface DashboardStats {
  todayAppointments: number;
  weekAppointments: number;
  pendingOrders: number;
  monthlyRevenue: number;
  newCustomers: number;
  cancelledAppointments: number;
  pendingApprovals: number;
  unassignedAppointments: number;
  unpaidCompletedAppointments: number;
  failedNotifications: number;
  contactsWithoutAccount: number;
  lowStockProducts: number;
  activeWaitlist: number;
}

interface TodayAppointment {
  id: string;
  time: string;
  customerName: string;
  serviceName: string;
  staffName: string;
  status: string;
  duration: number;
}

interface RecentOrder {
  id: string;
  orderNumber: string;
  customerEmail: string;
  totalCents: number;
  status: string;
  createdAt: string;
}

interface DashboardAttentionItem {
  key: string;
  title: string;
  count: number;
  description: string;
  href: string;
  severity: 'critical' | 'warning' | 'info';
}

interface AdminDashboardContentProps {
  stats: DashboardStats;
  todayAppointments: TodayAppointment[];
  recentOrders: RecentOrder[];
  attentionItems: DashboardAttentionItem[];
}

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
    hour: '2-digit',
    minute: '2-digit',
  });
}

const statusConfig: Record<string, {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  icon: React.ComponentType<{ className?: string }>;
}> = {
  reserved: {
    label: 'Reserviert',
    variant: 'secondary',
    icon: Clock,
  },
  requested: {
    label: 'Angefragt',
    variant: 'secondary',
    icon: AlertCircle,
  },
  confirmed: {
    label: 'Bestätigt',
    variant: 'default',
    icon: CheckCircle,
  },
  pending: {
    label: 'Ausstehend',
    variant: 'secondary',
    icon: Clock,
  },
  cancelled: {
    label: 'Storniert',
    variant: 'destructive',
    icon: XCircle,
  },
  completed: {
    label: 'Abgeschlossen',
    variant: 'outline',
    icon: CheckCircle,
  },
  no_show: {
    label: 'Nicht erschienen',
    variant: 'destructive',
    icon: XCircle,
  },
};

const fallbackStatus = {
  label: 'Unbekannt',
  variant: 'outline' as const,
  icon: AlertCircle,
};

const attentionSeverityClass: Record<DashboardAttentionItem['severity'], string> = {
  critical: 'border-destructive/30 bg-destructive/5 text-destructive',
  warning: 'border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300',
  info: 'border-primary/30 bg-primary/5 text-primary',
};

const orderStatusLabels: Record<string, string> = {
  pending: 'Ausstehend',
  paid: 'Bezahlt',
  processing: 'In Bearbeitung',
  shipped: 'Versendet',
  delivered: 'Geliefert',
  completed: 'Abgeschlossen',
  cancelled: 'Storniert',
  refunded: 'Erstattet',
};

// ============================================
// STAT CARD COMPONENT
// ============================================

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  href,
}: {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: { value: number; isPositive: boolean };
  href?: string;
}) {
  const content = (
    <Card className={cn('h-full', href && 'transition-shadow hover:shadow-md')}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground mt-1 min-h-[1rem]">
          {description || '\u00A0'}
        </p>
        {trend && (
          <div
            className={cn(
              'flex items-center text-xs mt-1',
              trend.isPositive ? 'text-green-600' : 'text-red-600'
            )}
          >
            <TrendingUp
              className={cn('h-3 w-3 mr-1', !trend.isPositive && 'rotate-180')}
            />
            {trend.value}% vs. letzter Monat
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

// ============================================
// ADMIN DASHBOARD CONTENT
// ============================================

export function AdminDashboardContent({
  stats,
  todayAppointments,
  recentOrders,
  attentionItems,
}: AdminDashboardContentProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
      {/* Left Column - Today's Appointments */}
      <Card className="lg:row-span-2">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Termine heute</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/kalender">
              Alle anzeigen
              <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {todayAppointments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Keine Termine für heute
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {todayAppointments.map((appointment) => {
                const status = statusConfig[appointment.status] || fallbackStatus;
                const StatusIcon = status.icon;
                return (
                  <div
                    key={appointment.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-medium w-14">
                        {appointment.time}
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {appointment.customerName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {appointment.serviceName} - {appointment.staffName}
                        </p>
                      </div>
                    </div>
                    <Badge variant={status.variant} className="gap-1">
                      <StatusIcon className="h-3 w-3" />
                      {status.label}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Right Column - Stats and Quick Actions */}
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid gap-4 grid-cols-2">
          <StatCard
            title="Termine heute"
            value={stats.todayAppointments}
            description={`${stats.cancelledAppointments} storniert`}
            icon={Calendar}
            href="/admin/kalender"
          />
          <StatCard
            title="Diese Woche"
            value={stats.weekAppointments}
            description="Termine"
            icon={Clock}
            href="/admin/kalender"
          />
          {features.financeEnabled && (
            <StatCard
              title="Umsatz Monat"
              value={formatCurrency(stats.monthlyRevenue)}
              description="Shop + Termine"
              icon={TrendingUp}
              href="/admin/finanzen"
            />
          )}
          <StatCard
            title="Neue Kunden"
            value={stats.newCustomers}
            description="diesen Monat"
            icon={Users}
            href="/admin/kunden"
          />
        </div>

        {/* Needs Attention */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Handlungsbedarf</CardTitle>
          </CardHeader>
          <CardContent>
            {attentionItems.length === 0 ? (
              <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-green-600" />
                Keine offenen Aufgaben
              </div>
            ) : (
              <div className="space-y-2">
                {attentionItems.map((item) => (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={cn(
                      'flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/70',
                      attentionSeverityClass[item.severity]
                    )}
                  >
                    <div>
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs opacity-80">{item.description}</p>
                    </div>
                    <Badge variant={item.severity === 'critical' ? 'destructive' : 'outline'}>
                      {item.count}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Schnellaktionen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link href="/admin/kalender?action=new">
                <Calendar className="h-4 w-4 mr-2" />
                Termin erstellen
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link href="/admin/kunden?action=new">
                <Users className="h-4 w-4 mr-2" />
                Kunde anlegen
              </Link>
            </Button>
            {features.shopEnabled && (
              <>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link href="/admin/produkte?action=new">
                    <ShoppingBag className="h-4 w-4 mr-2" />
                    Produkt hinzufügen
                  </Link>
                </Button>
                {stats.pendingOrders > 0 && (
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <Link href="/admin/bestellungen">
                      <AlertCircle className="h-4 w-4 mr-2" />
                      {stats.pendingOrders} offene Bestellungen
                    </Link>
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Recent Orders (if shop enabled) */}
        {features.shopEnabled && recentOrders.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Letzte Bestellungen</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/admin/bestellungen">
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recentOrders.slice(0, 3).map((order) => (
                  <Link
                    key={order.id}
                    href={`/admin/bestellungen/${order.id}`}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium">#{order.orderNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(order.createdAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {formatCurrency(order.totalCents)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
