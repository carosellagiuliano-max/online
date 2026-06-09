'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Calendar,
  XCircle,
  CheckCircle2,
  Bell,
  CheckCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

interface AdminNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

// ============================================
// NOTIFICATION ICON MAPPING
// ============================================

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'new_appointment':
      return <Calendar className="h-5 w-5 text-green-500" />;
    case 'appointment_cancelled':
      return <XCircle className="h-5 w-5 text-red-500" />;
    default:
      return <Bell className="h-5 w-5 text-blue-500" />;
  }
};

// ============================================
// MITTEILUNGEN PAGE
// ============================================

export default function MitteilungenPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/notifications?limit=50');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Mark notifications as read
  const markAsRead = async (notificationIds?: string[]) => {
    try {
      const body = notificationIds
        ? { notificationIds }
        : { markAllRead: true };

      await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      fetchNotifications();
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  // Handle notification click
  const handleNotificationClick = async (notification: AdminNotification) => {
    if (!notification.is_read) {
      await markAsRead([notification.id]);
    }
    if (notification.link) {
      router.push(notification.link);
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-CH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Format relative time
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Gerade eben';
    if (diffMins < 60) return `Vor ${diffMins} Min.`;
    if (diffHours < 24) return `Vor ${diffHours} Std.`;
    if (diffDays < 7) return `Vor ${diffDays} Tagen`;
    return formatDate(dateString);
  };

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Filter notifications based on tab
  const filteredNotifications =
    activeTab === 'unread'
      ? notifications.filter((n) => !n.is_read)
      : notifications;

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mitteilungen</h1>
          <p className="text-muted-foreground">
            Benachrichtigungen zu Terminen und Aktivitäten
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" onClick={() => markAsRead()}>
            <CheckCheck className="h-4 w-4 mr-2" />
            Alle als gelesen markieren
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'all' | 'unread')}>
        <TabsList>
          <TabsTrigger value="all">
            Alle
            <Badge variant="secondary" className="ml-2">
              {notifications.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="unread">
            Ungelesen
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {unreadCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-8 text-center text-muted-foreground">
                  Laden...
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Bell className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>Keine Mitteilungen</p>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={cn(
                        'flex items-start gap-4 p-4 hover:bg-muted/50 cursor-pointer transition-colors',
                        !notification.is_read && 'bg-primary/5'
                      )}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      {/* Icon */}
                      <div className="mt-1">
                        {getNotificationIcon(notification.type)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{notification.title}</span>
                          {!notification.is_read && (
                            <span className="h-2 w-2 rounded-full bg-primary" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {formatRelativeTime(notification.created_at)}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        {!notification.is_read && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead([notification.id]);
                            }}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
