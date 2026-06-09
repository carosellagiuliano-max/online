'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Calendar,
  Users,
  ShoppingBag,
  Package,
  UserCog,
  Settings,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Scissors,
  LogOut,
  HelpCircle,
  Warehouse,
  BarChart3,
  Bell,
  Inbox,
  Receipt,
  Download,
  ImageIcon,
  MessageSquare,
  Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { features } from '@/lib/config/features';

// ============================================
// TYPES
// ============================================

interface AdminSidebarProps {
  user: {
    name: string;
    email: string;
    role: string;
  };
  salon?: {
    name: string;
    logoUrl: string | null;
  };
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
  /** Feature flag key - if set, item only shows when feature is enabled */
  feature?: keyof typeof features;
}

interface NavGroup {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  feature?: keyof typeof features;
  children: NavItem[];
}

type NavEntry = NavItem | NavGroup;

function isNavGroup(entry: NavEntry): entry is NavGroup {
  return 'children' in entry;
}

// ============================================
// NAVIGATION DATA
// ============================================

const mainNavItems: NavEntry[] = [
  {
    label: 'Dashboard',
    href: '/admin',
    icon: LayoutDashboard,
  },
  {
    label: 'Kalender',
    href: '/admin/kalender',
    icon: Calendar,
  },
  {
    label: 'Kunden',
    href: '/admin/kunden',
    icon: Users,
  },
  {
    label: 'Shop',
    icon: ShoppingBag,
    feature: 'shopEnabled',
    children: [
      { label: 'Bestellungen', href: '/admin/bestellungen', icon: ShoppingBag },
      { label: 'Produkte', href: '/admin/produkte', icon: Package },
      { label: 'Inventar', href: '/admin/inventar', icon: Warehouse, roles: ['admin', 'manager', 'hq'] },
    ],
  },
  {
    label: 'Team',
    href: '/admin/team',
    icon: UserCog,
    roles: ['admin', 'manager', 'hq'],
  },
  {
    label: 'Analytics',
    href: '/admin/analytics',
    icon: BarChart3,
    roles: ['admin', 'manager', 'hq'],
  },
  {
    label: 'Finanzen',
    href: '/admin/finanzen',
    icon: Receipt,
    roles: ['admin', 'hq'],
    feature: 'financeEnabled',
  },
  {
    label: 'Mitteilungen',
    href: '/admin/mitteilungen',
    icon: Inbox,
  },
  {
    label: 'Kontaktanfragen',
    href: '/admin/kontaktanfragen',
    icon: MessageSquare,
    roles: ['admin', 'manager', 'hq'],
  },
  {
    label: 'Bewertungen',
    href: '/admin/bewertungen',
    icon: Star,
    roles: ['admin', 'manager', 'hq'],
  },
  {
    label: 'Galerie',
    href: '/admin/galerie',
    icon: ImageIcon,
    feature: 'galleryEnabled',
  },
  {
    label: 'Benachrichtigungen',
    href: '/admin/benachrichtigungen',
    icon: Bell,
    roles: ['admin', 'hq'],
    feature: 'notificationTemplatesEnabled',
  },
  {
    label: 'Datenexport',
    href: '/admin/export',
    icon: Download,
    roles: ['admin', 'hq'],
  },
];

const bottomNavItems: NavItem[] = [
  {
    label: 'Einstellungen',
    href: '/admin/einstellungen',
    icon: Settings,
    roles: ['admin', 'hq'],
  },
  {
    label: 'Hilfe',
    href: '/admin/hilfe',
    icon: HelpCircle,
  },
];

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
// ADMIN SIDEBAR COMPONENT
// ============================================

export function AdminSidebar({ user, salon }: AdminSidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const salonName = salon?.name || process.env.NEXT_PUBLIC_BUSINESS_NAME || 'Salon';
  const logoUrl = salon?.logoUrl;

  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  const isActive = (href: string) => {
    if (href === '/admin') {
      return pathname === '/admin';
    }
    return pathname.startsWith(href);
  };

  // Auto-open groups whose children match the current pathname
  useEffect(() => {
    for (const entry of mainNavItems) {
      if (isNavGroup(entry)) {
        const hasActiveChild = entry.children.some((child) => {
          if (child.href === '/admin') return pathname === '/admin';
          return pathname.startsWith(child.href);
        });
        if (hasActiveChild) {
          setOpenGroups((prev) => {
            if (prev.has(entry.label)) return prev;
            const next = new Set(prev);
            next.add(entry.label);
            return next;
          });
        }
      }
    }
  }, [pathname]);

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  };

  const isItemAllowed = (item: NavItem) => {
    if (item.feature && !features[item.feature]) return false;
    if (!item.roles) return true;
    return item.roles.includes(user.role);
  };

  const isEntryAllowed = (entry: NavEntry): boolean => {
    if (isNavGroup(entry)) {
      if (entry.feature && !features[entry.feature]) return false;
      return entry.children.some(isItemAllowed);
    }
    return isItemAllowed(entry);
  };

  const isGroupActive = (group: NavGroup) => {
    return group.children.some((child) => isActive(child.href));
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'flex flex-col h-full border-r bg-card transition-all duration-300',
          isCollapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Logo / Brand */}
        <div className="flex h-16 items-center justify-between border-b px-4">
          {!isCollapsed && (
            <Link href="/admin" className="flex items-center gap-2">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={salonName}
                  className="h-8 w-8 object-contain"
                />
              ) : (
                <Scissors className="h-6 w-6 text-primary" />
              )}
              <span className="font-bold text-lg">Control Panel</span>
            </Link>
          )}
          {isCollapsed && (
            <Link href="/admin" className="mx-auto">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={salonName}
                  className="h-6 w-6 object-contain"
                />
              ) : (
                <Scissors className="h-6 w-6 text-primary" />
              )}
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={cn('h-8 w-8', isCollapsed && 'mx-auto')}
            aria-label={isCollapsed ? 'Sidebar erweitern' : 'Sidebar einklappen'}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 space-y-1 p-2 overflow-y-auto">
          {mainNavItems.filter(isEntryAllowed).map((entry) => {
            if (isNavGroup(entry)) {
              const Icon = entry.icon;
              const groupOpen = openGroups.has(entry.label);
              const groupActive = isGroupActive(entry);
              const allowedChildren = entry.children.filter(isItemAllowed);

              if (isCollapsed) {
                return (
                  <Popover key={entry.label}>
                    <PopoverTrigger asChild>
                      <button
                        className={cn(
                          'flex items-center justify-center h-10 w-10 mx-auto rounded-md transition-colors',
                          groupActive
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent side="right" align="start" className="w-48 p-1">
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        {entry.label}
                      </div>
                      {allowedChildren.map((child) => {
                        const ChildIcon = child.icon;
                        const active = isActive(child.href);
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={cn(
                              'flex items-center gap-2 px-3 py-2 rounded-md transition-colors text-sm',
                              active
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                            )}
                          >
                            <ChildIcon className="h-4 w-4" />
                            {child.label}
                          </Link>
                        );
                      })}
                    </PopoverContent>
                  </Popover>
                );
              }

              return (
                <div key={entry.label}>
                  <button
                    onClick={() => toggleGroup(entry.label)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-md transition-colors w-full',
                      groupActive
                        ? 'text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-sm font-medium flex-1 text-left">{entry.label}</span>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 transition-transform duration-200',
                        groupOpen && 'rotate-180'
                      )}
                    />
                  </button>
                  {groupOpen && (
                    <div className="mt-1 space-y-1">
                      {allowedChildren.map((child) => {
                        const ChildIcon = child.icon;
                        const active = isActive(child.href);
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={cn(
                              'flex items-center gap-3 pl-10 pr-3 py-2 rounded-md transition-colors',
                              active
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                            )}
                          >
                            <ChildIcon className="h-4 w-4" />
                            <span className="text-sm">{child.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            // Regular NavItem
            const item = entry;
            const Icon = item.icon;
            const active = isActive(item.href);

            if (isCollapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center justify-center h-10 w-10 mx-auto rounded-md transition-colors',
                        active
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={10}>
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
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
        </nav>

        {/* Bottom Navigation */}
        <div className="border-t p-2 space-y-1">
          {bottomNavItems.filter(isItemAllowed).map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            if (isCollapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center justify-center h-10 w-10 mx-auto rounded-md transition-colors',
                        active
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={10}>
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
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

        {/* User Info & Logout */}
        <div className="border-t p-3">
          {!isCollapsed ? (
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                <span className="text-sm font-medium">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.name}</p>
                <p className="text-xs text-muted-foreground">
                  {roleLabels[user.role] || user.role}
                </p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <form action="/api/auth/signout" method="POST">
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    >
                      <LogOut className="h-4 w-4" />
                    </Button>
                  </form>
                </TooltipTrigger>
                <TooltipContent side="right">Abmelden</TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <form action="/api/auth/signout" method="POST">
                  <Button
                    type="submit"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 mx-auto flex text-muted-foreground hover:text-foreground"
                  >
                    <LogOut className="h-5 w-5" />
                  </Button>
                </form>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                Abmelden ({user.name})
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
