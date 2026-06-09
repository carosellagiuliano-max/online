'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { features } from '@/lib/config/features';
import {
  ArrowLeft,
  Calendar,
  Mail,
  Phone,
  Gift,
  Star,
  Package,
  CreditCard,
  Edit2,
  Plus,
  Award,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

// ============================================
// TYPES
// ============================================

interface CustomerDetail {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  birthDate: string | null;
  gender: string | null;
  avatarUrl: string | null;
  notes: string | null;
  tags: string[];
  totalVisits: number;
  totalSpent: number;
  loyaltyPoints: number;
  loyaltyTier: string | null;
  createdAt: string;
  lastVisitAt: string | null;
  marketingConsent: boolean;
  dataProcessingConsent: boolean;
}

interface CustomerAppointment {
  id: string;
  date: string;
  time: string;
  serviceName: string;
  staffName: string;
  status: string;
  totalCents: number;
}

interface CustomerOrder {
  id: string;
  orderNumber: string;
  date: string;
  status: string;
  paymentStatus: string;
  totalCents: number;
  itemCount: number;
}

interface CustomerLoyaltyTransaction {
  id: string;
  date: string;
  type: string;
  points: number;
  description: string;
}

interface AdminCustomerDetailViewProps {
  customer: CustomerDetail;
  appointments: CustomerAppointment[];
  orders: CustomerOrder[];
  loyaltyTransactions: CustomerLoyaltyTransaction[];
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatCurrency(cents: number): string {
  return `CHF ${(cents / 100).toFixed(2)}`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function getStatusBadge(status: string) {
  const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
    confirmed: { variant: 'default', label: 'Bestätigt' },
    completed: { variant: 'secondary', label: 'Abgeschlossen' },
    cancelled: { variant: 'destructive', label: 'Storniert' },
    no_show: { variant: 'destructive', label: 'Nicht erschienen' },
    pending: { variant: 'outline', label: 'Ausstehend' },
    processing: { variant: 'outline', label: 'In Bearbeitung' },
    shipped: { variant: 'default', label: 'Versendet' },
    delivered: { variant: 'secondary', label: 'Geliefert' },
    succeeded: { variant: 'secondary', label: 'Bezahlt' },
    failed: { variant: 'destructive', label: 'Fehlgeschlagen' },
  };

  const config = statusConfig[status] || { variant: 'outline' as const, label: status };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

function getLoyaltyTierBadge(tier: string | null) {
  if (!tier) return null;

  const tierConfig: Record<string, { color: string; label: string }> = {
    bronze: { color: 'bg-amber-700', label: 'Bronze' },
    silver: { color: 'bg-gray-400', label: 'Silber' },
    gold: { color: 'bg-yellow-500', label: 'Gold' },
    platinum: { color: 'bg-purple-500', label: 'Platin' },
  };

  const config = tierConfig[tier] || { color: 'bg-gray-500', label: tier };
  return (
    <Badge className={`${config.color} text-white`}>
      <Award className="mr-1 h-3 w-3" />
      {config.label}
    </Badge>
  );
}

function getTransactionTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    earn_visit: 'Besuch',
    earn_purchase: 'Einkauf',
    earn_referral: 'Empfehlung',
    earn_birthday: 'Geburtstag',
    redeem: 'Eingelöst',
    expire: 'Verfallen',
    adjust: 'Anpassung',
    adjustment: 'Anpassung',
  };
  return labels[type] || type;
}

// ============================================
// COMPONENT
// ============================================

export function AdminCustomerDetailView({
  customer,
  appointments,
  orders,
  loyaltyTransactions,
}: AdminCustomerDetailViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Open edit dialog if ?edit=true is in URL
  useEffect(() => {
    if (searchParams.get('edit') === 'true') {
      setIsEditDialogOpen(true);
    }
  }, [searchParams]);
  const [isNotesDialogOpen, setIsNotesDialogOpen] = useState(false);
  const [isPointsDialogOpen, setIsPointsDialogOpen] = useState(false);
  const [editedCustomer, setEditedCustomer] = useState(customer);
  const [notes, setNotes] = useState(customer.notes || '');
  const [pointsAdjustment, setPointsAdjustment] = useState({ points: 0, reason: '' });
  const [isSaving, setIsSaving] = useState(false);

  const initials = `${customer.firstName.charAt(0)}${customer.lastName.charAt(0)}`.toUpperCase();

  // Handle customer update
  const handleSaveCustomer = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/customers/${customer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: editedCustomer.firstName,
          lastName: editedCustomer.lastName,
          phone: editedCustomer.phone,
          birthDate: editedCustomer.birthDate,
          gender: editedCustomer.gender,
        }),
      });

      if (!response.ok) {
        throw new Error('Fehler beim Speichern');
      }

      toast.success('Kundendaten aktualisiert');
      setIsEditDialogOpen(false);
      router.refresh();
    } catch {
      toast.error('Fehler beim Speichern der Kundendaten');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle notes update
  const handleSaveNotes = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/customers/${customer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });

      if (!response.ok) {
        throw new Error('Fehler beim Speichern');
      }

      toast.success('Notizen gespeichert');
      setIsNotesDialogOpen(false);
      router.refresh();
    } catch {
      toast.error('Fehler beim Speichern der Notizen');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle points adjustment
  const handleAdjustPoints = async () => {
    if (!pointsAdjustment.points || !pointsAdjustment.reason) {
      toast.error('Bitte Punkte und Grund angeben');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/customers/${customer.id}/loyalty`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          points: pointsAdjustment.points,
          reason: pointsAdjustment.reason,
        }),
      });

      if (!response.ok) {
        throw new Error('Fehler beim Anpassen');
      }

      toast.success('Punkte angepasst');
      setIsPointsDialogOpen(false);
      setPointsAdjustment({ points: 0, reason: '' });
      router.refresh();
    } catch {
      toast.error('Fehler beim Anpassen der Punkte');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/admin/kunden')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {customer.firstName} {customer.lastName}
            </h1>
            <p className="text-muted-foreground">Kunde seit {formatDate(customer.createdAt)}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsEditDialogOpen(true)}>
            <Edit2 className="mr-2 h-4 w-4" />
            Bearbeiten
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className={`grid gap-4 ${features.shopEnabled ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gesamtbesuche</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customer.totalVisits}</div>
            {customer.lastVisitAt && (
              <p className="text-xs text-muted-foreground">
                Letzter Besuch: {formatDate(customer.lastVisitAt)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gesamtumsatz</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(customer.totalSpent)}</div>
            <p className="text-xs text-muted-foreground">
              Ø {formatCurrency(customer.totalVisits > 0 ? customer.totalSpent / customer.totalVisits : 0)} pro Besuch
            </p>
          </CardContent>
        </Card>

        {features.shopEnabled && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Treuepunkte</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">{customer.loyaltyPoints}</span>
                {getLoyaltyTierBadge(customer.loyaltyTier)}
              </div>
              <Button
                variant="link"
                className="h-auto p-0 text-xs"
                onClick={() => setIsPointsDialogOpen(true)}
              >
                Punkte anpassen
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Profile */}
        <div className="space-y-6">
          {/* Profile Card */}
          <Card>
            <CardHeader>
              <CardTitle>Profil</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={customer.avatarUrl || undefined} alt={customer.firstName} />
                  <AvatarFallback className="text-lg">{initials}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold">
                    {customer.firstName} {customer.lastName}
                  </h3>
                  {customer.gender && (
                    <p className="text-sm text-muted-foreground">
                      {customer.gender === 'male' ? 'Männlich' : customer.gender === 'female' ? 'Weiblich' : 'Divers'}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{customer.email}</span>
                </div>
                {customer.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{customer.phone}</span>
                  </div>
                )}
                {customer.birthDate && (
                  <div className="flex items-center gap-3">
                    <Gift className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{formatDate(customer.birthDate)}</span>
                  </div>
                )}
              </div>

              {customer.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-2">
                  {customer.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Notizen</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setIsNotesDialogOpen(true)}>
                <Edit2 className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {customer.notes ? (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{customer.notes}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">Keine Notizen vorhanden</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Tabs */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="appointments" className="space-y-4">
            <TabsList>
              <TabsTrigger value="appointments">
                <Calendar className="mr-2 h-4 w-4" />
                Termine ({appointments.length})
              </TabsTrigger>
              {features.shopEnabled && (
                <>
                  <TabsTrigger value="orders">
                    <Package className="mr-2 h-4 w-4" />
                    Bestellungen ({orders.length})
                  </TabsTrigger>
                  <TabsTrigger value="loyalty">
                    <Star className="mr-2 h-4 w-4" />
                    Treuepunkte
                  </TabsTrigger>
                </>
              )}
            </TabsList>

            {/* Appointments Tab */}
            <TabsContent value="appointments">
              <Card>
                <CardHeader>
                  <CardTitle>Terminhistorie</CardTitle>
                  <CardDescription>Alle Termine dieses Kunden</CardDescription>
                </CardHeader>
                <CardContent>
                  {appointments.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">Keine Termine vorhanden</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Datum</TableHead>
                          <TableHead>Zeit</TableHead>
                          <TableHead>Service</TableHead>
                          <TableHead>Mitarbeiter</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Betrag</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {appointments.map((appointment) => (
                          <TableRow key={appointment.id}>
                            <TableCell>{appointment.date}</TableCell>
                            <TableCell>{appointment.time}</TableCell>
                            <TableCell>{appointment.serviceName}</TableCell>
                            <TableCell>{appointment.staffName}</TableCell>
                            <TableCell>{getStatusBadge(appointment.status)}</TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(appointment.totalCents)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Orders Tab */}
            {features.shopEnabled && (
              <TabsContent value="orders">
                <Card>
                  <CardHeader>
                    <CardTitle>Bestellungen</CardTitle>
                    <CardDescription>Alle Shop-Bestellungen dieses Kunden</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {orders.length === 0 ? (
                      <p className="text-center py-8 text-muted-foreground">Keine Bestellungen vorhanden</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Bestellnr.</TableHead>
                            <TableHead>Datum</TableHead>
                            <TableHead>Artikel</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Zahlung</TableHead>
                            <TableHead className="text-right">Betrag</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {orders.map((order) => (
                            <TableRow
                              key={order.id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => router.push(`/admin/bestellungen/${order.id}`)}
                            >
                              <TableCell className="font-mono">{order.orderNumber}</TableCell>
                              <TableCell>{formatDate(order.date)}</TableCell>
                              <TableCell>{order.itemCount} Artikel</TableCell>
                              <TableCell>{getStatusBadge(order.status)}</TableCell>
                              <TableCell>{getStatusBadge(order.paymentStatus)}</TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(order.totalCents)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* Loyalty Tab */}
            {features.shopEnabled && (
              <TabsContent value="loyalty">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Treuepunkte-Verlauf</CardTitle>
                      <CardDescription>
                        Aktueller Stand: {customer.loyaltyPoints} Punkte
                      </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setIsPointsDialogOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Anpassen
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {loyaltyTransactions.length === 0 ? (
                      <p className="text-center py-8 text-muted-foreground">
                        Keine Transaktionen vorhanden
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Datum</TableHead>
                            <TableHead>Typ</TableHead>
                            <TableHead>Beschreibung</TableHead>
                            <TableHead className="text-right">Punkte</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {loyaltyTransactions.map((transaction) => (
                            <TableRow key={transaction.id}>
                              <TableCell>{formatDate(transaction.date)}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{getTransactionTypeLabel(transaction.type)}</Badge>
                              </TableCell>
                              <TableCell>{transaction.description}</TableCell>
                              <TableCell
                                className={`text-right font-medium ${
                                  transaction.points >= 0 ? 'text-green-600' : 'text-red-600'
                                }`}
                              >
                                {transaction.points >= 0 ? '+' : ''}
                                {transaction.points}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>

      {/* Edit Customer Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Kunde bearbeiten</DialogTitle>
            <DialogDescription>Kundendaten aktualisieren</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Vorname</Label>
                <Input
                  id="firstName"
                  value={editedCustomer.firstName}
                  onChange={(e) =>
                    setEditedCustomer({ ...editedCustomer, firstName: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Nachname</Label>
                <Input
                  id="lastName"
                  value={editedCustomer.lastName}
                  onChange={(e) =>
                    setEditedCustomer({ ...editedCustomer, lastName: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefon</Label>
              <Input
                id="phone"
                value={editedCustomer.phone || ''}
                onChange={(e) =>
                  setEditedCustomer({ ...editedCustomer, phone: e.target.value || null })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="birthDate">Geburtsdatum</Label>
              <Input
                id="birthDate"
                type="date"
                value={editedCustomer.birthDate || ''}
                onChange={(e) =>
                  setEditedCustomer({ ...editedCustomer, birthDate: e.target.value || null })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSaveCustomer} disabled={isSaving}>
              {isSaving ? 'Speichern...' : 'Speichern'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notes Dialog */}
      <Dialog open={isNotesDialogOpen} onOpenChange={setIsNotesDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Notizen bearbeiten</DialogTitle>
            <DialogDescription>Interne Notizen zum Kunden</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notizen eingeben..."
              rows={6}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNotesDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSaveNotes} disabled={isSaving}>
              {isSaving ? 'Speichern...' : 'Speichern'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Points Adjustment Dialog */}
      <Dialog open={isPointsDialogOpen} onOpenChange={setIsPointsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Treuepunkte anpassen</DialogTitle>
            <DialogDescription>
              Aktueller Stand: {customer.loyaltyPoints} Punkte
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="points">Punkte (+ hinzufügen, - abziehen)</Label>
              <Input
                id="points"
                type="number"
                value={pointsAdjustment.points}
                onChange={(e) =>
                  setPointsAdjustment({ ...pointsAdjustment, points: parseInt(e.target.value) || 0 })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Grund</Label>
              <Input
                id="reason"
                value={pointsAdjustment.reason}
                onChange={(e) =>
                  setPointsAdjustment({ ...pointsAdjustment, reason: e.target.value })
                }
                placeholder="z.B. Kulanz, Korrektur, Bonus"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPointsDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleAdjustPoints} disabled={isSaving}>
              {isSaving ? 'Anpassen...' : 'Anpassen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
