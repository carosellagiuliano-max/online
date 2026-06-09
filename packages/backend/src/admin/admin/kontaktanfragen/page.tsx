'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  MessageSquare,
  Mail,
  Phone,
  Calendar,
  Clock,
  User,
  Send,
  Trash2,
  CheckCircle,
  AlertCircle,
  Loader2,
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  Reply,
  Archive,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  getContactInquiries,
  updateContactInquiryStatus,
  sendContactReply,
  deleteContactInquiry,
  type ContactInquiry,
  type ContactInquiryStatus,
} from '@/lib/actions/contact';

// ============================================
// REASON LABELS
// ============================================

const REASON_LABELS: Record<string, string> = {
  termin: 'Terminanfrage',
  beratung: 'Beratungsgespräch',
  bewerbung: 'Bewerbung',
  feedback: 'Feedback',
  sonstiges: 'Sonstiges',
};

// ============================================
// STATUS CONFIG
// ============================================

const STATUS_CONFIG: Record<ContactInquiryStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  new: { label: 'Neu', variant: 'default' },
  in_progress: { label: 'In Bearbeitung', variant: 'secondary' },
  resolved: { label: 'Erledigt', variant: 'outline' },
  spam: { label: 'Spam', variant: 'destructive' },
};

// ============================================
// PAGE COMPONENT
// ============================================

export default function KontaktanfragenPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [inquiries, setInquiries] = useState<ContactInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Dialog states
  const [selectedInquiry, setSelectedInquiry] = useState<ContactInquiry | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [replyDialogOpen, setReplyDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Reply form
  const [replySubject, setReplySubject] = useState('');
  const [replyMessage, setReplyMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  // ============================================
  // FETCH DATA
  // ============================================

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const data = await getContactInquiries();
      setInquiries(data);
      setLoading(false);
    }
    fetchData();
  }, []);

  // ============================================
  // FILTER INQUIRIES
  // ============================================

  const filteredInquiries = inquiries.filter((inquiry) => {
    // Status filter
    if (statusFilter !== 'all' && inquiry.status !== statusFilter) {
      return false;
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const fullName = `${inquiry.firstName} ${inquiry.lastName}`.toLowerCase();
      return (
        fullName.includes(query) ||
        inquiry.email.toLowerCase().includes(query) ||
        inquiry.message.toLowerCase().includes(query)
      );
    }

    return true;
  });

  // ============================================
  // HANDLERS
  // ============================================

  const handleView = (inquiry: ContactInquiry) => {
    setSelectedInquiry(inquiry);
    setViewDialogOpen(true);
  };

  const handleReply = (inquiry: ContactInquiry) => {
    setSelectedInquiry(inquiry);
    setReplySubject(`Re: ${REASON_LABELS[inquiry.reason] || inquiry.reason}`);
    setReplyMessage('');
    setReplyDialogOpen(true);
  };

  const handleStatusChange = async (inquiry: ContactInquiry, status: ContactInquiryStatus) => {
    startTransition(async () => {
      const result = await updateContactInquiryStatus(inquiry.id, status);
      if (result.success) {
        setInquiries((prev) =>
          prev.map((i) => (i.id === inquiry.id ? { ...i, status } : i))
        );
        toast.success('Status aktualisiert');
      } else {
        toast.error(result.error || 'Fehler beim Aktualisieren');
      }
    });
  };

  const handleDelete = (inquiry: ContactInquiry) => {
    setSelectedInquiry(inquiry);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedInquiry) return;

    startTransition(async () => {
      const result = await deleteContactInquiry(selectedInquiry.id);
      if (result.success) {
        setInquiries((prev) => prev.filter((i) => i.id !== selectedInquiry.id));
        toast.success('Anfrage gelöscht');
        setDeleteDialogOpen(false);
        setSelectedInquiry(null);
      } else {
        toast.error(result.error || 'Fehler beim Löschen');
      }
    });
  };

  const handleSendReply = async () => {
    if (!selectedInquiry || !replySubject.trim() || !replyMessage.trim()) {
      toast.error('Bitte Betreff und Nachricht eingeben');
      return;
    }

    setIsSending(true);
    const result = await sendContactReply(selectedInquiry.id, replySubject, replyMessage);
    setIsSending(false);

    if (result.success) {
      toast.success('Antwort gesendet');
      setReplyDialogOpen(false);
      // Update status locally
      if (selectedInquiry.status === 'new') {
        setInquiries((prev) =>
          prev.map((i) =>
            i.id === selectedInquiry.id ? { ...i, status: 'in_progress' as ContactInquiryStatus } : i
          )
        );
      }
      setReplySubject('');
      setReplyMessage('');
    } else {
      toast.error(result.error || 'Fehler beim Senden');
    }
  };

  // ============================================
  // RENDER
  // ============================================

  const newCount = inquiries.filter((i) => i.status === 'new').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageSquare className="h-6 w-6" />
          Kontaktanfragen
          {newCount > 0 && (
            <Badge variant="default" className="ml-2">
              {newCount} neu
            </Badge>
          )}
        </h1>
        <p className="text-muted-foreground">
          Verwalten Sie eingehende Kontaktanfragen von der Website.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Suchen nach Name, E-Mail oder Nachricht..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status filtern" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                <SelectItem value="new">Neu</SelectItem>
                <SelectItem value="in_progress">In Bearbeitung</SelectItem>
                <SelectItem value="resolved">Erledigt</SelectItem>
                <SelectItem value="spam">Spam</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredInquiries.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">
                {searchQuery || statusFilter !== 'all'
                  ? 'Keine Anfragen gefunden.'
                  : 'Noch keine Kontaktanfragen eingegangen.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Anliegen</TableHead>
                  <TableHead className="hidden md:table-cell">E-Mail</TableHead>
                  <TableHead className="hidden lg:table-cell">Datum</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInquiries.map((inquiry) => (
                  <TableRow key={inquiry.id}>
                    <TableCell>
                      <Badge variant={STATUS_CONFIG[inquiry.status].variant}>
                        {STATUS_CONFIG[inquiry.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {inquiry.firstName} {inquiry.lastName}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {REASON_LABELS[inquiry.reason] || inquiry.reason}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <a
                        href={`mailto:${inquiry.email}`}
                        className="text-sm text-muted-foreground hover:text-foreground"
                      >
                        {inquiry.email}
                      </a>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span className="text-sm text-muted-foreground">
                        {new Date(inquiry.createdAt).toLocaleDateString('de-CH', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleView(inquiry)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Ansehen
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleReply(inquiry)}>
                            <Reply className="h-4 w-4 mr-2" />
                            Antworten
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleStatusChange(inquiry, 'in_progress')}
                            disabled={inquiry.status === 'in_progress'}
                          >
                            <Clock className="h-4 w-4 mr-2" />
                            In Bearbeitung
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleStatusChange(inquiry, 'resolved')}
                            disabled={inquiry.status === 'resolved'}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Als erledigt markieren
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleStatusChange(inquiry, 'spam')}
                            disabled={inquiry.status === 'spam'}
                          >
                            <AlertTriangle className="h-4 w-4 mr-2" />
                            Als Spam markieren
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(inquiry)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Löschen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Kontaktanfrage</DialogTitle>
            <DialogDescription>
              Details zur Anfrage von {selectedInquiry?.firstName} {selectedInquiry?.lastName}
            </DialogDescription>
          </DialogHeader>

          {selectedInquiry && (
            <div className="space-y-6">
              {/* Contact Info */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-medium">
                      {selectedInquiry.firstName} {selectedInquiry.lastName}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">E-Mail</p>
                    <a
                      href={`mailto:${selectedInquiry.email}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {selectedInquiry.email}
                    </a>
                  </div>
                </div>

                {selectedInquiry.phone && (
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Phone className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Telefon</p>
                      <a
                        href={`tel:${selectedInquiry.phone}`}
                        className="font-medium hover:underline"
                      >
                        {selectedInquiry.phone}
                      </a>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Calendar className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Datum</p>
                    <p className="font-medium">
                      {new Date(selectedInquiry.createdAt).toLocaleString('de-CH')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Reason & Status */}
              <div className="flex items-center gap-4">
                <Badge variant="secondary">
                  {REASON_LABELS[selectedInquiry.reason] || selectedInquiry.reason}
                </Badge>
                <Badge variant={STATUS_CONFIG[selectedInquiry.status].variant}>
                  {STATUS_CONFIG[selectedInquiry.status].label}
                </Badge>
              </div>

              {/* Message */}
              <div>
                <p className="text-sm text-muted-foreground mb-2">Nachricht</p>
                <div className="p-4 bg-muted rounded-lg whitespace-pre-wrap">
                  {selectedInquiry.message}
                </div>
              </div>

              {/* Notes */}
              {selectedInquiry.notes && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Notizen</p>
                  <div className="p-4 bg-muted/50 rounded-lg whitespace-pre-wrap text-sm">
                    {selectedInquiry.notes}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Schliessen
            </Button>
            <Button onClick={() => {
              setViewDialogOpen(false);
              if (selectedInquiry) handleReply(selectedInquiry);
            }}>
              <Reply className="h-4 w-4 mr-2" />
              Antworten
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reply Dialog */}
      <Dialog open={replyDialogOpen} onOpenChange={setReplyDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Antwort senden</DialogTitle>
            <DialogDescription>
              Antwort an {selectedInquiry?.email}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reply-subject">Betreff</Label>
              <Input
                id="reply-subject"
                value={replySubject}
                onChange={(e) => setReplySubject(e.target.value)}
                placeholder="Betreff der Antwort"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reply-message">Nachricht</Label>
              <Textarea
                id="reply-message"
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                placeholder="Ihre Antwort..."
                rows={8}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReplyDialogOpen(false)}
              disabled={isSending}
            >
              Abbrechen
            </Button>
            <Button onClick={handleSendReply} disabled={isSending}>
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Wird gesendet...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Senden
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anfrage löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie die Anfrage von {selectedInquiry?.firstName}{' '}
              {selectedInquiry?.lastName} wirklich löschen? Diese Aktion kann
              nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Löschen'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
