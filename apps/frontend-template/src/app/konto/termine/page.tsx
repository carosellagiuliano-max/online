import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  Calendar,
  Clock,
  User,
  MapPin,
  AlertCircle,
  CheckCircle2,
  XCircle,
  CalendarPlus,
} from 'lucide-react';

// Force dynamic rendering (API not available at build time)
export const dynamic = 'force-dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getCurrentUser, getCustomerAppointments, getSalon } from '@/lib/actions';
import { CancelAppointmentButton } from '@/components/customer/cancel-appointment-button';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Meine Termine',
  description: 'Verwalten Sie Ihre Termine bei BeautifyPRO.',
};

// ============================================
// PAGE COMPONENT
// ============================================

export default async function TerminePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/konto/login?redirect=/konto/termine');
  }

  const [appointments, salon] = await Promise.all([
    getCustomerAppointments(user.id),
    getSalon(),
  ]);

  const now = new Date();
  const upcomingAppointments = appointments.filter(
    (a) => a.startsAt > now && ['reserved', 'requested', 'confirmed'].includes(a.status)
  );
  const pastAppointments = appointments.filter(
    (a) => a.startsAt <= now || ['completed', 'cancelled', 'no_show'].includes(a.status)
  );

  const formatPrice = (cents: number) => `CHF ${(cents / 100).toFixed(2)}`;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Bestätigt
          </Badge>
        );
      case 'reserved':
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Reserviert
          </Badge>
        );
      case 'requested':
        return (
          <Badge variant="outline" className="border-amber-500/50 bg-amber-500/10 text-amber-700">
            <Clock className="h-3 w-3 mr-1" />
            Wartet auf Bestätigung
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Storniert
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="outline">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Abgeschlossen
          </Badge>
        );
      case 'no_show':
        return (
          <Badge variant="destructive">
            <AlertCircle className="h-3 w-3 mr-1" />
            Nicht erschienen
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Meine Termine</h2>
        <Button asChild>
          <Link href="/termin-buchen">
            <CalendarPlus className="h-4 w-4 mr-2" />
            Neuer Termin
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="upcoming" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upcoming">
            Anstehend ({upcomingAppointments.length})
          </TabsTrigger>
          <TabsTrigger value="past">
            Vergangene ({pastAppointments.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-6">
          {upcomingAppointments.length === 0 ? (
            <Card className="border-border/50">
              <CardContent className="py-12 text-center">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold mb-2">Keine anstehenden Termine</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Sie haben aktuell keine gebuchten Termine.
                </p>
                <Button asChild>
                  <Link href="/termin-buchen">Jetzt Termin buchen</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {upcomingAppointments.map((appointment) => (
                <Card key={appointment.id} className="border-border/50">
                  <CardContent className="p-6">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                      {/* Date Badge */}
                      <div className="flex-shrink-0 text-center bg-primary/10 rounded-lg p-3 w-20">
                        <p className="text-2xl font-bold text-primary">
                          {format(appointment.startsAt, 'd')}
                        </p>
                        <p className="text-xs text-muted-foreground uppercase">
                          {format(appointment.startsAt, 'MMM', { locale: de })}
                        </p>
                      </div>

                      {/* Details */}
                      <div className="flex-1 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold">
                              {appointment.services.map((s) => s.name).join(', ')}
                            </p>
                            {getStatusBadge(appointment.status)}
                          </div>
                          <p className="font-semibold text-primary">
                            {formatPrice(appointment.totalPriceCents)}
                          </p>
                        </div>

                        <div className="grid gap-2 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            <span>
                              {format(appointment.startsAt, 'EEEE, d. MMMM yyyy', {
                                locale: de,
                              })}
                            </span>
                            <span>
                              {format(appointment.startsAt, 'HH:mm')} -{' '}
                              {format(appointment.endsAt, 'HH:mm')} Uhr
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            <span>{appointment.staffName}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            <span>
                              {salon?.name}, {salon?.address}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        {appointment.canCancel && (
                          <div className="pt-2">
                            <CancelAppointmentButton
                              appointmentId={appointment.id}
                              customerId={user.id}
                            />
                          </div>
                        )}
                        {!appointment.canCancel &&
                          ['reserved', 'requested', 'confirmed'].includes(appointment.status) && (
                            <p className="text-xs text-muted-foreground pt-2">
                              {appointment.cancellationDisabledMessage ||
                                'Dieser Termin kann nicht online storniert werden.'}
                            </p>
                          )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="past" className="mt-6">
          {pastAppointments.length === 0 ? (
            <Card className="border-border/50">
              <CardContent className="py-12 text-center">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold mb-2">Keine vergangenen Termine</h3>
                <p className="text-sm text-muted-foreground">
                  Sie haben noch keine Termine bei uns gehabt.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {pastAppointments.map((appointment) => (
                <Card
                  key={appointment.id}
                  className="border-border/50 bg-muted/30"
                >
                  <CardContent className="p-6">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                      {/* Date Badge */}
                      <div className="flex-shrink-0 text-center bg-muted rounded-lg p-3 w-20">
                        <p className="text-2xl font-bold text-muted-foreground">
                          {format(appointment.startsAt, 'd')}
                        </p>
                        <p className="text-xs text-muted-foreground uppercase">
                          {format(appointment.startsAt, 'MMM', { locale: de })}
                        </p>
                      </div>

                      {/* Details */}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-muted-foreground">
                              {appointment.services.map((s) => s.name).join(', ')}
                            </p>
                            {getStatusBadge(appointment.status)}
                          </div>
                          <p className="font-medium text-muted-foreground">
                            {formatPrice(appointment.totalPriceCents)}
                          </p>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>
                            {format(appointment.startsAt, 'd. MMMM yyyy', {
                              locale: de,
                            })}
                          </span>
                          <span>{appointment.staffName}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
