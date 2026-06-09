'use client';

import { useState } from 'react';
import {
  Mail,
  MessageSquare,
  Bell,
  Edit,
  Eye,
  Send,
  Check,
  X,
  Clock,
  AlertCircle,
  RefreshCw,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

interface NotificationTemplate {
  id: string;
  name: string;
  code: string;
  channel: 'email' | 'sms' | 'push';
  subject: string | null;
  bodyHtml: string | null;
  bodyText: string | null;
  smsBody: string | null;
  availableVariables: string[];
  isActive: boolean;
  updatedAt: string;
}

interface NotificationLog {
  id: string;
  templateCode: string;
  channel: string;
  recipientEmail: string | null;
  subject: string | null;
  status: string;
  sentAt: string | null;
  createdAt: string;
  errorMessage: string | null;
}

interface DefaultTemplate {
  code: string;
  name: string;
  variables: string[];
}

interface AdminNotificationTemplatesViewProps {
  templates: NotificationTemplate[];
  logs: NotificationLog[];
  defaultTemplates: DefaultTemplate[];
}

// ============================================
// HELPERS
// ============================================

function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateString));
}

function getChannelIcon(channel: string) {
  switch (channel) {
    case 'email':
      return Mail;
    case 'sms':
      return MessageSquare;
    case 'push':
      return Bell;
    default:
      return Mail;
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'sent':
      return { variant: 'default' as const, label: 'Gesendet', icon: Check };
    case 'pending':
      return { variant: 'secondary' as const, label: 'Ausstehend', icon: Clock };
    case 'sending':
      return { variant: 'secondary' as const, label: 'Wird gesendet', icon: RefreshCw };
    case 'failed':
      return { variant: 'destructive' as const, label: 'Fehlgeschlagen', icon: X };
    case 'bounced':
      return { variant: 'destructive' as const, label: 'Zurückgewiesen', icon: AlertCircle };
    default:
      return { variant: 'outline' as const, label: status, icon: Clock };
  }
}

// ============================================
// COMPONENT
// ============================================

export function AdminNotificationTemplatesView({
  templates,
  logs,
  defaultTemplates,
}: AdminNotificationTemplatesViewProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<NotificationTemplate | null>(null);

  // Edit form state
  const [editSubject, setEditSubject] = useState('');
  const [editBodyHtml, setEditBodyHtml] = useState('');
  const [editBodyText, setEditBodyText] = useState('');
  const [editSmsBody, setEditSmsBody] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Test send state
  const [testEmail, setTestEmail] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);

  // Open edit dialog
  const handleEdit = (template: NotificationTemplate) => {
    setSelectedTemplate(template);
    setEditSubject(template.subject || '');
    setEditBodyHtml(template.bodyHtml || '');
    setEditBodyText(template.bodyText || '');
    setEditSmsBody(template.smsBody || '');
    setEditIsActive(template.isActive);
    setEditDialogOpen(true);
  };

  // Open preview dialog
  const handlePreview = (template: NotificationTemplate) => {
    setSelectedTemplate(template);
    setPreviewDialogOpen(true);
  };

  // Open test send dialog
  const handleTestSend = (template: NotificationTemplate) => {
    setSelectedTemplate(template);
    setTestEmail('');
    setTestDialogOpen(true);
  };

  // Save template
  const handleSaveTemplate = async () => {
    if (!selectedTemplate) return;

    setIsSaving(true);

    try {
      const response = await fetch('/api/admin/notifications/templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedTemplate.id,
          subject: editSubject,
          bodyHtml: editBodyHtml,
          bodyText: editBodyText,
          smsBody: editSmsBody,
          isActive: editIsActive,
        }),
      });

      if (!response.ok) {
        throw new Error('Fehler beim Speichern');
      }

      toast.success('Vorlage gespeichert');
      setEditDialogOpen(false);
      window.location.reload();
    } catch (error) {
      toast.error('Fehler beim Speichern der Vorlage');
    } finally {
      setIsSaving(false);
    }
  };

  // Send test email
  const handleSendTest = async () => {
    if (!selectedTemplate || !testEmail) return;

    setIsSendingTest(true);

    try {
      const response = await fetch('/api/admin/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          recipientEmail: testEmail,
        }),
      });

      if (!response.ok) {
        throw new Error('Fehler beim Senden');
      }

      toast.success(`Test-E-Mail an ${testEmail} gesendet`);
      setTestDialogOpen(false);
    } catch (error) {
      toast.error('Fehler beim Senden der Test-E-Mail');
    } finally {
      setIsSendingTest(false);
    }
  };

  // Get template info
  const getTemplateInfo = (code: string) => {
    return defaultTemplates.find((t) => t.code === code);
  };

  // Merge templates with defaults
  const allTemplates = defaultTemplates.map((dt) => {
    const existing = templates.find((t) => t.code === dt.code);
    return existing || {
      id: '',
      name: dt.name,
      code: dt.code,
      channel: 'email' as const,
      subject: null,
      bodyHtml: null,
      bodyText: null,
      smsBody: null,
      availableVariables: dt.variables,
      isActive: false,
      updatedAt: '',
    };
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Benachrichtigungen</h1>
        <p className="text-muted-foreground">
          E-Mail- und SMS-Vorlagen verwalten
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="templates" className="space-y-4">
        <TabsList>
          <TabsTrigger value="templates">
            <Mail className="mr-2 h-4 w-4" />
            Vorlagen
          </TabsTrigger>
          <TabsTrigger value="logs">
            <Clock className="mr-2 h-4 w-4" />
            Verlauf
          </TabsTrigger>
        </TabsList>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>E-Mail-Vorlagen</CardTitle>
              <CardDescription>
                Passen Sie die automatischen Benachrichtigungen an
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vorlage</TableHead>
                    <TableHead>Kanal</TableHead>
                    <TableHead>Betreff</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Geändert</TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allTemplates.map((template) => {
                    const ChannelIcon = getChannelIcon(template.channel);
                    const info = getTemplateInfo(template.code);

                    return (
                      <TableRow key={template.code}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{info?.name || template.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {template.code}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <ChannelIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="capitalize">{template.channel}</span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {template.subject || (
                            <span className="text-muted-foreground">Nicht konfiguriert</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {template.id ? (
                            template.isActive ? (
                              <Badge variant="default">Aktiv</Badge>
                            ) : (
                              <Badge variant="secondary">Inaktiv</Badge>
                            )
                          ) : (
                            <Badge variant="outline">Neu</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {template.updatedAt ? formatDate(template.updatedAt) : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {template.id && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handlePreview(template)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleTestSend(template)}
                                >
                                  <Send className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(template)}
                            >
                              {template.id ? (
                                <Edit className="h-4 w-4" />
                              ) : (
                                <Plus className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Variables Help */}
          <Card>
            <CardHeader>
              <CardTitle>Verfügbare Variablen</CardTitle>
              <CardDescription>
                Diese Variablen können in den Vorlagen verwendet werden: {`{{variable_name}}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {Array.from(
                  new Set(defaultTemplates.flatMap((t) => t.variables))
                ).map((variable) => (
                  <Badge key={variable} variant="outline">
                    {`{{${variable}}}`}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Versandverlauf</CardTitle>
              <CardDescription>
                Die letzten 50 Benachrichtigungen
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>Vorlage</TableHead>
                    <TableHead>Empfänger</TableHead>
                    <TableHead>Betreff</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center">
                        Keine Benachrichtigungen vorhanden
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log) => {
                      const status = getStatusBadge(log.status);
                      const StatusIcon = status.icon;

                      return (
                        <TableRow key={log.id}>
                          <TableCell className="text-muted-foreground">
                            {formatDate(log.createdAt)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{log.templateCode}</Badge>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {log.recipientEmail || '-'}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {log.subject || '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge variant={status.variant}>
                                <StatusIcon className="mr-1 h-3 w-3" />
                                {status.label}
                              </Badge>
                              {log.errorMessage && (
                                <span
                                  className="text-xs text-red-500 cursor-help"
                                  title={log.errorMessage}
                                >
                                  (Fehler)
                                </span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedTemplate?.id ? 'Vorlage bearbeiten' : 'Neue Vorlage erstellen'}
            </DialogTitle>
            <DialogDescription>
              {selectedTemplate?.name} ({selectedTemplate?.code})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Subject */}
            <div className="space-y-2">
              <Label htmlFor="subject">Betreff</Label>
              <Input
                id="subject"
                placeholder="z.B. Ihre Terminbestätigung bei {{salon_name}}"
                value={editSubject}
                onChange={(e) => setEditSubject(e.target.value)}
              />
            </div>

            {/* HTML Body */}
            <div className="space-y-2">
              <Label htmlFor="bodyHtml">E-Mail-Inhalt (HTML)</Label>
              <Textarea
                id="bodyHtml"
                className="min-h-[200px] font-mono text-sm"
                placeholder="<p>Guten Tag {{customer_name}},</p>..."
                value={editBodyHtml}
                onChange={(e) => setEditBodyHtml(e.target.value)}
              />
            </div>

            {/* Text Body */}
            <div className="space-y-2">
              <Label htmlFor="bodyText">E-Mail-Inhalt (Text)</Label>
              <Textarea
                id="bodyText"
                className="min-h-[100px]"
                placeholder="Guten Tag {{customer_name}},..."
                value={editBodyText}
                onChange={(e) => setEditBodyText(e.target.value)}
              />
            </div>

            {/* SMS Body */}
            <div className="space-y-2">
              <Label htmlFor="smsBody">SMS-Inhalt (max. 160 Zeichen)</Label>
              <Textarea
                id="smsBody"
                className="min-h-[60px]"
                placeholder="Ihr Termin am {{appointment_date}}..."
                value={editSmsBody}
                onChange={(e) => setEditSmsBody(e.target.value)}
                maxLength={160}
              />
              <p className="text-xs text-muted-foreground">
                {editSmsBody.length}/160 Zeichen
              </p>
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="isActive">Vorlage aktiv</Label>
              <Switch
                id="isActive"
                checked={editIsActive}
                onCheckedChange={setEditIsActive}
              />
            </div>

            {/* Available Variables */}
            {selectedTemplate && (
              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm font-medium mb-2">Verfügbare Variablen:</p>
                <div className="flex flex-wrap gap-2">
                  {(selectedTemplate.availableVariables ||
                    getTemplateInfo(selectedTemplate.code)?.variables || []
                  ).map((v) => (
                    <Badge
                      key={v}
                      variant="outline"
                      className="cursor-pointer"
                      onClick={() => {
                        navigator.clipboard.writeText(`{{${v}}}`);
                        toast.success(`{{${v}}} kopiert`);
                      }}
                    >
                      {`{{${v}}}`}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSaveTemplate} disabled={isSaving}>
              {isSaving ? 'Wird gespeichert...' : 'Speichern'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vorschau: {selectedTemplate?.name}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {selectedTemplate?.subject && (
              <div>
                <Label>Betreff</Label>
                <p className="mt-1 p-3 bg-muted rounded-lg">
                  {selectedTemplate.subject}
                </p>
              </div>
            )}

            {selectedTemplate?.bodyHtml && (
              <div>
                <Label>E-Mail-Vorschau</Label>
                <div
                  className="mt-1 p-4 bg-white border rounded-lg prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: selectedTemplate.bodyHtml }}
                />
              </div>
            )}

            {selectedTemplate?.smsBody && (
              <div>
                <Label>SMS-Vorschau</Label>
                <p className="mt-1 p-3 bg-muted rounded-lg">
                  {selectedTemplate.smsBody}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewDialogOpen(false)}>
              Schliessen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Send Dialog */}
      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Test-E-Mail senden</DialogTitle>
            <DialogDescription>
              Senden Sie eine Test-E-Mail mit Beispieldaten
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="testEmail">Empfänger E-Mail</Label>
              <Input
                id="testEmail"
                type="email"
                placeholder="ihre@email.ch"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
              />
            </div>

            <p className="text-sm text-muted-foreground">
              Die Variablen werden mit Beispieldaten ausgefüllt.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTestDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={handleSendTest}
              disabled={!testEmail || isSendingTest}
            >
              {isSendingTest ? 'Wird gesendet...' : 'Test senden'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
