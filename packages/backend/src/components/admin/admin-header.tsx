'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bell,
  Menu,
  LayoutDashboard,
  Calendar,
  Users,
  ShoppingBag,
  Package,
  UserCog,
  Settings,
  LogOut,
  User,
  ExternalLink,
  Scissors,
  Inbox,
  Warehouse,
  ImageIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

interface AdminHeaderProps {
  user: {
    name: string;
    email: string;
    role: string;
  };
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

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
// MOBILE NAVIGATION DATA
// ============================================

interface MobileNavSection {
  label?: string;
  items: NavItem[];
}

const mobileNavSections: MobileNavSection[] = [
  {
    items: [
      { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
      { label: 'Kalender', href: '/admin/kalender', icon: Calendar },
      { label: 'Kunden', href: '/admin/kunden', icon: Users },
    ],
  },
  {
    label: 'Shop',
    items: [
      { label: 'Bestellungen', href: '/admin/bestellungen', icon: ShoppingBag },
      { label: 'Produkte', href: '/admin/produkte', icon: Package },
      { label: 'Inventar', href: '/admin/inventar', icon: Warehouse },
    ],
  },
  {
    items: [
      { label: 'Team', href: '/admin/team', icon: UserCog },
      { label: 'Mitteilungen', href: '/admin/mitteilungen', icon: Inbox },
      { label: 'Galerie', href: '/admin/galerie', icon: ImageIcon },
      { label: 'Einstellungen', href: '/admin/einstellungen', icon: Settings },
    ],
  },
];

// ============================================
// PAGE TITLES
// ============================================

const pageTitles: Record<string, string> = {
  '/admin': 'Dashboard',
  '/admin/kalender': 'Kalender',
  '/admin/kunden': 'Kundenverwaltung',
  '/admin/bestellungen': 'Bestellungen',
  '/admin/produkte': 'Produktverwaltung',
  '/admin/inventar': 'Inventar',
  '/admin/team': 'Team & Mitarbeiter',
  '/admin/mitteilungen': 'Mitteilungen',
  '/admin/galerie': 'Galerie',
  '/admin/einstellungen': 'Einstellungen',
  '/admin/hilfe': 'Hilfe & Support',
};

// ============================================
// ROLE LABELS
// ============================================

const roleLabels: Record<string, string> = {
  admin: 'Administrator',
  manager: 'Manager',
  staff: 'Mitarbeiter',
  hq: 'Hauptverwaltung',
};

// ============================================
// ADMIN HEADER COMPONENT
// ============================================

export function AdminHeader({ user }: AdminHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [notificationCount, setNotificationCount] = useState(0);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/notifications?limit=5', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setNotificationCount(data.unreadCount || 0);
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.error('Failed to fetch notifications:', res.status, errorData);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
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
        credentials: 'include',
        body: JSON.stringify(body),
      });

      // Refresh notifications
      fetchNotifications();
    } catch (error) {
      console.error('Failed to mark notifications as read:', error);
    }
  };

  // Handle notification click
  const handleNotificationClick = async (notification: AdminNotification) => {
    // Mark as read
    if (!notification.is_read) {
      await markAsRead([notification.id]);
    }
    // Navigate if there's a link
    if (notification.link) {
      router.push(notification.link);
    }
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
    if (diffMins < 60) return `Vor ${diffMins} Minuten`;
    if (diffHours < 24) return `Vor ${diffHours} Stunden`;
    if (diffDays < 7) return `Vor ${diffDays} Tagen`;
    return date.toLocaleDateString('de-CH');
  };

  // Fetch notifications on mount and poll every 30 seconds
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Get current page title
  const getPageTitle = () => {
    // Check for exact match first
    if (pageTitles[pathname]) {
      return pageTitles[pathname];
    }
    // Check for partial matches (for sub-pages)
    for (const [path, title] of Object.entries(pageTitles)) {
      if (pathname.startsWith(path) && path !== '/admin') {
        return title;
      }
    }
    return 'Admin';
  };

  const isActive = (href: string) => {
    if (href === '/admin') {
      return pathname === '/admin';
    }
    return pathname.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background px-4 lg:px-6">
      {/* Mobile Menu Button */}
      <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Menu öffnen</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="border-b px-4 py-3">
            <SheetTitle className="flex items-center gap-2">
              <Scissors className="h-5 w-5 text-primary" />
              BeautifyPRO Admin
            </SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col gap-1 p-2">
            {mobileNavSections.map((section, idx) => (
              <div key={section.label ?? idx}>
                {section.label && (
                  <div className="px-3 pt-3 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {section.label}
                  </div>
                )}
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-md transition-colors',
                        active
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-sm font-medium">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
          <div className="absolute bottom-0 left-0 right-0 border-t p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                <span className="text-sm font-medium">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-xs text-muted-foreground">
                  {roleLabels[user.role] || user.role}
                </p>
              </div>
            </div>
            <form action="/api/auth/signout" method="POST">
              <Button variant="outline" className="w-full" type="submit">
                <LogOut className="h-4 w-4 mr-2" />
                Abmelden
              </Button>
            </form>
          </div>
        </SheetContent>
      </Sheet>

      {/* Page Title */}
      <div className="flex-1">
        <h1 className="text-lg font-semibold lg:text-xl">{getPageTitle()}</h1>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* View Website */}
        <Button
          variant="ghost"
          size="icon"
          asChild
          className="hidden sm:flex"
        >
          <Link href="/" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-5 w-5" />
            <span className="sr-only">Website öffnen</span>
          </Link>
        </Button>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {notificationCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                >
                  {notificationCount > 9 ? '9+' : notificationCount}
                </Badge>
              )}
              <span className="sr-only">Benachrichtigungen</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <div className="flex items-center justify-between px-2">
              <DropdownMenuLabel>Benachrichtigungen</DropdownMenuLabel>
              {notificationCount > 0 && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    markAsRead();
                  }}
                  className="text-xs text-primary hover:underline"
                >
                  Alle gelesen
                </button>
              )}
            </div>
            <DropdownMenuSeparator />
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Keine neuen Benachrichtigungen
                </div>
              ) : (
                notifications.map((notification) => (
                  <DropdownMenuItem
                    key={notification.id}
                    className={cn(
                      'flex flex-col items-start gap-1 p-3 cursor-pointer',
                      !notification.is_read && 'bg-primary/5'
                    )}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <span className="font-medium">{notification.title}</span>
                      {!notification.is_read && (
                        <span className="h-2 w-2 rounded-full bg-primary" />
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground line-clamp-2">
                      {notification.message}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(notification.created_at)}
                    </span>
                  </DropdownMenuItem>
                ))
              )}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="justify-center" asChild>
              <Link href="/admin/mitteilungen" className="text-sm text-primary w-full text-center">
                Alle anzeigen
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <span className="text-sm font-medium">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
                <Badge variant="secondary" className="w-fit mt-1">
                  {roleLabels[user.role] || user.role}
                </Badge>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/admin/profil">
                <User className="h-4 w-4 mr-2" />
                Profil
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/admin/einstellungen">
                <Settings className="h-4 w-4 mr-2" />
                Einstellungen
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/" target="_blank">
                <ExternalLink className="h-4 w-4 mr-2" />
                Website öffnen
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <form action="/api/auth/signout" method="POST">
              <DropdownMenuItem asChild>
                <button type="submit" className="w-full cursor-pointer">
                  <LogOut className="h-4 w-4 mr-2" />
                  Abmelden
                </button>
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
