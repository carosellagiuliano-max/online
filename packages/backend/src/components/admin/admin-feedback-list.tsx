'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Star,
  Check,
  X,
  Flag,
  Eye,
  EyeOff,
  MessageSquare,
  Clock,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  updateFeedbackStatus,
  respondToFeedback,
  type AdminFeedback,
  type FeedbackStatus,
} from '@/lib/actions';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

interface AdminFeedbackListProps {
  feedback: AdminFeedback[];
  stats: {
    total: number;
    pending: number;
    approved: number;
    averageRating: number;
  };
}

// ============================================
// HELPER COMPONENTS
// ============================================

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            'h-4 w-4',
            i < rating
              ? 'fill-yellow-400 text-yellow-400'
              : 'fill-muted text-muted'
          )}
        />
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: FeedbackStatus }) {
  const variants: Record<FeedbackStatus, { label: string; className: string }> = {
    pending: { label: 'Ausstehend', className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30' },
    approved: { label: 'Freigegeben', className: 'bg-green-500/10 text-green-600 border-green-500/30' },
    hidden: { label: 'Ausgeblendet', className: 'bg-gray-500/10 text-gray-600 border-gray-500/30' },
    flagged: { label: 'Markiert', className: 'bg-red-500/10 text-red-600 border-red-500/30' },
  };

  const { label, className } = variants[status];

  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function AdminFeedbackList({ feedback, stats }: AdminFeedbackListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState<FeedbackStatus | 'all'>('all');
  const [responseDialog, setResponseDialog] = useState<{
    open: boolean;
    feedbackId: string;
    currentResponse: string;
  }>({ open: false, feedbackId: '', currentResponse: '' });
  const [responseText, setResponseText] = useState('');

  const filteredFeedback = filter === 'all'
    ? feedback
    : feedback.filter((f) => f.status === filter);

  const handleStatusUpdate = (feedbackId: string, status: FeedbackStatus) => {
    startTransition(async () => {
      await updateFeedbackStatus(feedbackId, status);
      router.refresh();
    });
  };

  const handleOpenResponse = (feedbackId: string, currentResponse: string) => {
    setResponseText(currentResponse || '');
    setResponseDialog({
      open: true,
      feedbackId,
      currentResponse: currentResponse || '',
    });
  };

  const handleSaveResponse = () => {
    if (!responseText.trim()) return;

    startTransition(async () => {
      await respondToFeedback(responseDialog.feedbackId, responseText);
      setResponseDialog({ open: false, feedbackId: '', currentResponse: '' });
      setResponseText('');
      router.refresh();
    });
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('de-CH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Kundenbewertungen</h1>
        <p className="text-muted-foreground">
          Verwalten Sie Kundenfeedback und Bewertungen
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <MessageSquare className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Gesamt</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-500/10">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ausstehend</p>
                <p className="text-2xl font-bold">{stats.pending}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                <Check className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Freigegeben</p>
                <p className="text-2xl font-bold">{stats.approved}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Star className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Durchschnitt</p>
                <p className="text-2xl font-bold">
                  {stats.averageRating > 0 ? stats.averageRating.toFixed(1) : '-'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={filter} onValueChange={(v) => setFilter(v as FeedbackStatus | 'all')}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status filtern" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle anzeigen</SelectItem>
            <SelectItem value="pending">Ausstehend</SelectItem>
            <SelectItem value="approved">Freigegeben</SelectItem>
            <SelectItem value="hidden">Ausgeblendet</SelectItem>
            <SelectItem value="flagged">Markiert</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Feedback List */}
      <div className="space-y-4">
        {filteredFeedback.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">
                {filter === 'all'
                  ? 'Noch keine Bewertungen vorhanden'
                  : `Keine Bewertungen mit Status "${filter}"`}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredFeedback.map((item) => (
            <Card key={item.id} className={cn(
              'transition-colors',
              item.status === 'pending' && 'border-yellow-500/50'
            )}>
              <CardContent className="p-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  {/* Main Content */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{item.name}</span>
                      <StarRating rating={item.rating} />
                      <StatusBadge status={item.status} />
                    </div>

                    {item.comment && (
                      <p className="text-foreground/80">
                        &ldquo;{item.comment}&rdquo;
                      </p>
                    )}

                    <p className="text-xs text-muted-foreground">
                      {formatDate(item.submittedAt)}
                      {item.ipAddress && ` • IP: ${item.ipAddress}`}
                    </p>

                    {/* Response */}
                    {item.response && (
                      <div className="mt-3 rounded-lg bg-muted/50 p-3">
                        <p className="text-sm font-medium text-muted-foreground">
                          Ihre Antwort:
                        </p>
                        <p className="text-sm">{item.response}</p>
                        {item.respondedAt && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatDate(item.respondedAt)}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    {item.status === 'pending' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-600 hover:bg-green-50 hover:text-green-700"
                          onClick={() => handleStatusUpdate(item.id, 'approved')}
                          disabled={isPending}
                        >
                          <Check className="mr-1 h-4 w-4" />
                          Freigeben
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() => handleStatusUpdate(item.id, 'hidden')}
                          disabled={isPending}
                        >
                          <X className="mr-1 h-4 w-4" />
                          Ablehnen
                        </Button>
                      </>
                    )}

                    {item.status === 'approved' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStatusUpdate(item.id, 'hidden')}
                        disabled={isPending}
                      >
                        <EyeOff className="mr-1 h-4 w-4" />
                        Ausblenden
                      </Button>
                    )}

                    {item.status === 'hidden' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStatusUpdate(item.id, 'approved')}
                        disabled={isPending}
                      >
                        <Eye className="mr-1 h-4 w-4" />
                        Wieder anzeigen
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenResponse(item.id, item.response || '')}
                      disabled={isPending}
                    >
                      <MessageSquare className="mr-1 h-4 w-4" />
                      {item.response ? 'Antwort bearbeiten' : 'Antworten'}
                    </Button>

                    {item.status !== 'flagged' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-red-600"
                        onClick={() => handleStatusUpdate(item.id, 'flagged')}
                        disabled={isPending}
                      >
                        <Flag className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Response Dialog */}
      <Dialog
        open={responseDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setResponseDialog({ open: false, feedbackId: '', currentResponse: '' });
            setResponseText('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Auf Bewertung antworten</DialogTitle>
            <DialogDescription>
              Ihre Antwort wird unter der Bewertung angezeigt.
            </DialogDescription>
          </DialogHeader>

          <Textarea
            value={responseText}
            onChange={(e) => setResponseText(e.target.value)}
            placeholder="Vielen Dank für Ihr Feedback..."
            rows={4}
          />

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setResponseDialog({ open: false, feedbackId: '', currentResponse: '' });
                setResponseText('');
              }}
            >
              Abbrechen
            </Button>
            <Button
              onClick={handleSaveResponse}
              disabled={!responseText.trim() || isPending}
            >
              Antwort speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
