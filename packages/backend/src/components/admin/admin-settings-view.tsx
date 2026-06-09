'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { toast } from 'sonner';
import {
  Save,
  Building,
  Clock,
  CreditCard,
  Mail,
  Scissors,
  Plus,
  Edit,
  Trash2,
  CalendarClock,
  Percent,
  RotateCcw,
  Share2,
  Instagram,
  Facebook,
  Youtube,
  Globe,
  FolderOpen,
  Layers,
  ChevronUp,
  ChevronDown,
  CalendarOff,
  ImageIcon,
  Upload,
  Award,
  Heart,
  Sparkles,
  Star,
  Gem,
  Target,
  Users,
  Zap,
  Shield,
  Truck,
  Search,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react';
import { QRCodeDownload } from '@/components/admin/qr-code-download';
import { Button } from '@/components/ui/button';
import { TikTokIcon } from '@/components/ui/icons';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  createService,
  updateService,
  deleteService,
  restoreService,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
  getServiceVariants,
  createVariant,
  updateVariant,
  deleteVariant,
  type ServiceVariant,
} from '@/lib/actions/services';
import {
  updateOpeningHours,
  updateSalon,
  updateSocialLinks,
  saveBookingRules,
  createSalonClosure,
  updateSalonClosure,
  deleteSalonClosure,
  updateAboutPageSettings,
  createAboutValue,
  updateAboutValue,
  deleteAboutValue,
  createAboutMilestone,
  updateAboutMilestone,
  deleteAboutMilestone,
  type BookingRulesSettingsData,
  type AboutValue,
  type AboutMilestone,
} from '@/lib/actions';
import { features } from '@/lib/config/features';

// ============================================
// TYPES
// ============================================

interface Salon {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  website: string | null;
  description: string | null;
  opening_hours: Record<string, unknown> | null;
  is_active: boolean;
  logo_url: string | null;
  // Footer settings
  tagline: string | null;
  footer_description: string | null;
  // Homepage hero settings
  hero_tagline: string | null;
  hero_headline: string | null;
  hero_headline_accent: string | null;
  hero_description: string | null;
  hero_image_url: string | null;
  // About page hero settings
  about_hero_tagline: string | null;
  about_hero_headline: string | null;
  about_hero_description: string | null;
  about_hero_image_url: string | null;
  // About page section visibility
  show_values_section: boolean | null;
  show_milestones_section: boolean | null;
  // Team page hero settings
  team_hero_headline: string | null;
  team_hero_description: string | null;
  team_hero_benefits: string[] | null;
  team_hero_image_url: string | null;
}

interface ServiceForAdmin {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  categoryId: string | null;
  categoryName: string | null;
  durationMinutes: number;
  priceCents: number;
  priceFrom: boolean;
  hasLengthVariants: boolean;
  isBookableOnline: boolean;
  isActive: boolean;
  sortOrder: number;
  assignedStaffCount: number;
}

interface ServiceCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
}

interface OpeningHoursData {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isOpen: boolean;
  hasLunchBreak: boolean;
  lunchStart: string | null;
  lunchEnd: string | null;
}

interface SocialLinkData {
  id: string;
  platform: string;
  url: string;
  isEnabled: boolean;
  sortOrder: number;
}

interface SalonClosureData {
  id: string;
  startTime: string;
  endTime: string;
  reason: string | null;
  createdAt: string;
}

interface AdminSettingsViewProps {
  salon: Salon | null;
  services: ServiceForAdmin[];
  categories: ServiceCategory[];
  openingHours: OpeningHoursData[];
  socialLinks: SocialLinkData[];
  bookingRulesData?: BookingRulesSettingsData;
  salonClosures?: SalonClosureData[];
  aboutValues?: AboutValue[];
  aboutMilestones?: AboutMilestone[];
}

// ============================================
// CONSTANTS
// ============================================

// Icon mapping for about values
const valueIconMap: Record<string, LucideIcon> = {
  award: Award,
  heart: Heart,
  sparkles: Sparkles,
  star: Star,
  gem: Gem,
  target: Target,
  users: Users,
  zap: Zap,
  shield: Shield,
};

function getValueIcon(iconName: string): LucideIcon {
  return valueIconMap[iconName.toLowerCase()] || Sparkles;
}

// dayOfWeek: 0 = Sunday, 1 = Monday, ... 6 = Saturday (JavaScript standard)
const weekDays = [
  { dayOfWeek: 1, label: 'Montag' },
  { dayOfWeek: 2, label: 'Dienstag' },
  { dayOfWeek: 3, label: 'Mittwoch' },
  { dayOfWeek: 4, label: 'Donnerstag' },
  { dayOfWeek: 5, label: 'Freitag' },
  { dayOfWeek: 6, label: 'Samstag' },
  { dayOfWeek: 0, label: 'Sonntag' },
];

// ============================================
// HELPERS
// ============================================

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF',
  }).format(cents / 100);
}

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} Min.`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours} Std.`;
  }
  return `${hours} Std. ${mins} Min.`;
}

// ============================================
// DEFAULT SERVICE FORM VALUES
// ============================================

const defaultServiceForm = {
  name: '',
  description: '',
  categoryId: '',
  durationMinutes: 30,
  price: '', // Store as string for easier input
  priceFrom: false,
  isBookableOnline: true,
};

// ============================================
// ADMIN SETTINGS VIEW
// ============================================

export function AdminSettingsView({ salon, services, categories, openingHours: initialOpeningHours, socialLinks: initialSocialLinks, bookingRulesData, salonClosures: initialSalonClosures = [], aboutValues: initialAboutValues = [], aboutMilestones: initialAboutMilestones = [] }: AdminSettingsViewProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  // Opening hours state
  const [openingHours, setOpeningHours] = useState<OpeningHoursData[]>(initialOpeningHours);

  // Services state (local copy for UI updates)
  const [servicesList, setServicesList] = useState<ServiceForAdmin[]>(services);

  // Service dialog state
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceForAdmin | null>(null);
  const [serviceForm, setServiceForm] = useState(defaultServiceForm);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<ServiceForAdmin | null>(null);

  // Show inactive services
  const [showInactive, setShowInactive] = useState(false);
  const [serviceSearch, setServiceSearch] = useState('');
  const [serviceStatusFilter, setServiceStatusFilter] = useState<'all' | 'online' | 'internal' | 'issues'>('all');

  // Category management state
  const [categoriesList, setCategoriesList] = useState<ServiceCategory[]>(categories);
  const [categoriesManageOpen, setCategoriesManageOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ServiceCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });
  const [deleteCategoryDialogOpen, setDeleteCategoryDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<ServiceCategory | null>(null);

  // Variant management state
  const [variantsManageOpen, setVariantsManageOpen] = useState(false);
  const [variantServiceId, setVariantServiceId] = useState<string | null>(null);
  const [variantServiceName, setVariantServiceName] = useState<string>('');
  const [variants, setVariants] = useState<ServiceVariant[]>([]);
  const [variantDialogOpen, setVariantDialogOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ServiceVariant | null>(null);
  const [variantForm, setVariantForm] = useState({ name: '', description: '', price: '', durationMinutes: '' });
  const [isLoadingVariants, setIsLoadingVariants] = useState(false);

  // Booking rules state
  const [bookingRules, setBookingRules] = useState({
    minNoticeHours: bookingRulesData?.minNoticeHours ?? 24,
    maxAdvanceDays: bookingRulesData?.maxAdvanceDays ?? 90,
    bufferMinutes: bookingRulesData?.bufferMinutes ?? 15,
    allowSameDayBooking: bookingRulesData?.allowSameDayBooking ?? false,
    requirePhoneForBooking: bookingRulesData?.requirePhoneForBooking ?? true,
    requireAppointmentApproval: bookingRulesData?.requireAppointmentApproval ?? false,
    allowCustomerCancellation: bookingRulesData?.allowCustomerCancellation ?? true,
    cancellationDeadlineHours: bookingRulesData?.cancellationDeadlineHours ?? 24,
  });

  // VAT settings state
  const [vatSettings, setVatSettings] = useState({
    vatRate: 8.1,
    showVatOnInvoice: true,
    vatNumber: '',
  });

  // Shipping settings state
  const [shippingSettings, setShippingSettings] = useState({
    standardShippingCents: 900, // CHF 9.00
    freeShippingThresholdCents: 5000, // CHF 50.00
    enableFreeShipping: true,
    expressEnabled: true,
    expressShippingCents: 1490, // CHF 14.90
    expressEstimatedDays: '1-2',
    standardEstimatedDays: '3-5',
    pickupEnabled: true,
  });
  const [isSavingShipping, setIsSavingShipping] = useState(false);

  // Load shipping settings from API on mount
  useEffect(() => {
    async function loadShippingSettings() {
      try {
        const response = await fetch('/api/admin/settings/shipping');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            setShippingSettings(data.data);
          }
        }
      } catch (error) {
        console.error('Error loading shipping settings:', error);
      }
    }
    loadShippingSettings();
  }, []);

  // Save shipping settings function
  const handleSaveShippingSettings = async () => {
    setIsSavingShipping(true);
    try {
      const response = await fetch('/api/admin/settings/shipping', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shippingSettings),
      });

      if (response.ok) {
        toast.success('Versandeinstellungen wurden gespeichert');
      } else {
        const error = await response.json();
        toast.error('Fehler beim Speichern', {
          description: error.error || 'Bitte versuchen Sie es erneut.',
        });
      }
    } catch (error) {
      toast.error('Fehler beim Speichern', {
        description: 'Ein unerwarteter Fehler ist aufgetreten.',
      });
    } finally {
      setIsSavingShipping(false);
    }
  };

  // Salon info form state
  const [salonForm, setSalonForm] = useState({
    name: salon?.name || '',
    email: salon?.email || '',
    phone: salon?.phone || '',
    website: salon?.website || '',
    address: salon?.address || '',
    zipCode: salon?.postal_code || '',
    city: salon?.city || '',
    description: salon?.description || '',
  });

  // Logo upload state
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(salon?.logo_url || null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  // Footer settings state
  const [footerForm, setFooterForm] = useState({
    tagline: salon?.tagline || '',
    footerDescription: salon?.footer_description || '',
  });
  const [isSavingFooter, setIsSavingFooter] = useState(false);

  // Homepage hero settings state
  const [homepageForm, setHomepageForm] = useState({
    heroTagline: salon?.hero_tagline || '',
    heroHeadline: salon?.hero_headline || '',
    heroHeadlineAccent: salon?.hero_headline_accent || '',
    heroDescription: salon?.hero_description || '',
  });
  const [heroImageFile, setHeroImageFile] = useState<File | null>(null);
  const [heroImagePreview, setHeroImagePreview] = useState<string | null>(salon?.hero_image_url || null);
  const [isSavingHomepage, setIsSavingHomepage] = useState(false);
  const [isUploadingHeroImage, setIsUploadingHeroImage] = useState(false);

  // About page hero settings state
  const [aboutForm, setAboutForm] = useState({
    aboutHeroTagline: salon?.about_hero_tagline || '',
    aboutHeroHeadline: salon?.about_hero_headline || '',
    aboutHeroDescription: salon?.about_hero_description || '',
  });
  const [aboutImageFile, setAboutImageFile] = useState<File | null>(null);
  const [aboutImagePreview, setAboutImagePreview] = useState<string | null>(salon?.about_hero_image_url || null);
  const [isSavingAbout, setIsSavingAbout] = useState(false);
  const [isUploadingAboutImage, setIsUploadingAboutImage] = useState(false);

  // About page section visibility toggles
  const [showValuesSection, setShowValuesSection] = useState(salon?.show_values_section ?? true);
  const [showMilestonesSection, setShowMilestonesSection] = useState(salon?.show_milestones_section ?? true);

  // Team page hero settings state
  const [teamForm, setTeamForm] = useState({
    teamHeroHeadline: salon?.team_hero_headline || '',
    teamHeroDescription: salon?.team_hero_description || '',
    teamHeroBenefits: salon?.team_hero_benefits || ['Attraktive Arbeitszeiten', 'Weiterbildungsmöglichkeiten', 'Modernes Arbeitsumfeld', 'Familiäres Team'],
  });
  const [teamImageFile, setTeamImageFile] = useState<File | null>(null);
  const [teamImagePreview, setTeamImagePreview] = useState<string | null>(salon?.team_hero_image_url || null);
  const [isSavingTeam, setIsSavingTeam] = useState(false);
  const [isUploadingTeamImage, setIsUploadingTeamImage] = useState(false);

  // About page values state
  const [valuesList, setValuesList] = useState<AboutValue[]>(initialAboutValues);
  const [valueDialogOpen, setValueDialogOpen] = useState(false);
  const [editingValue, setEditingValue] = useState<AboutValue | null>(null);
  const [valueForm, setValueForm] = useState({ title: '', description: '', icon: 'sparkles' });
  const [isSavingValue, setIsSavingValue] = useState(false);
  const [deletingValueId, setDeletingValueId] = useState<string | null>(null);

  // About page milestones state
  const [milestonesList, setMilestonesList] = useState<AboutMilestone[]>(initialAboutMilestones);
  const [milestoneDialogOpen, setMilestoneDialogOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<AboutMilestone | null>(null);
  const [milestoneForm, setMilestoneForm] = useState({ year: '', title: '', description: '' });
  const [isSavingMilestone, setIsSavingMilestone] = useState(false);
  const [deletingMilestoneId, setDeletingMilestoneId] = useState<string | null>(null);

  // Social links state - initialize with defaults if empty
  const defaultSocialLinks: SocialLinkData[] = [
    { id: '', platform: 'instagram', url: '', isEnabled: true, sortOrder: 1 },
    { id: '', platform: 'facebook', url: '', isEnabled: true, sortOrder: 2 },
    { id: '', platform: 'tiktok', url: '', isEnabled: false, sortOrder: 3 },
    { id: '', platform: 'youtube', url: '', isEnabled: false, sortOrder: 4 },
  ];

  const [socialLinksForm, setSocialLinksForm] = useState<SocialLinkData[]>(() => {
    if (initialSocialLinks.length === 0) {
      return defaultSocialLinks;
    }
    // Merge existing links with defaults for missing platforms
    const platforms = ['instagram', 'facebook', 'tiktok', 'youtube'];
    const result: SocialLinkData[] = [];
    platforms.forEach((platform, index) => {
      const existing = initialSocialLinks.find(l => l.platform === platform);
      if (existing) {
        result.push(existing);
      } else {
        result.push({ id: '', platform, url: '', isEnabled: false, sortOrder: index + 1 });
      }
    });
    return result;
  });

  // Salon closures (Betriebsferien) state
  const [salonClosuresList, setSalonClosuresList] = useState<SalonClosureData[]>(initialSalonClosures);
  const [closureDialogOpen, setClosureDialogOpen] = useState(false);
  const [editingClosure, setEditingClosure] = useState<SalonClosureData | null>(null);
  const [closureForm, setClosureForm] = useState({
    startDate: '',
    endDate: '',
    reason: '',
  });
  const [deleteClosureDialogOpen, setDeleteClosureDialogOpen] = useState(false);
  const [closureToDelete, setClosureToDelete] = useState<SalonClosureData | null>(null);

  // Filter services based on visibility/search/status
  const serviceStats = useMemo(() => {
    const active = servicesList.filter((service) => service.isActive);
    const online = active.filter((service) => service.isBookableOnline);
    const issues = online.filter((service) => service.assignedStaffCount === 0);

    return {
      active: active.length,
      online: online.length,
      internal: active.filter((service) => !service.isBookableOnline).length,
      inactive: servicesList.filter((service) => !service.isActive).length,
      issues: issues.length,
    };
  }, [servicesList]);

  const filteredServices = useMemo(() => {
    const query = serviceSearch.trim().toLowerCase();

    return servicesList
      .filter((service) => showInactive || service.isActive)
      .filter((service) => {
        if (serviceStatusFilter === 'online') {
          return service.isActive && service.isBookableOnline;
        }
        if (serviceStatusFilter === 'internal') {
          return service.isActive && !service.isBookableOnline;
        }
        if (serviceStatusFilter === 'issues') {
          return service.isActive && service.isBookableOnline && service.assignedStaffCount === 0;
        }
        return true;
      })
      .filter((service) => {
        if (!query) return true;
        return [
          service.name,
          service.description || '',
          service.categoryName || '',
        ].some((value) => value.toLowerCase().includes(query));
      });
  }, [serviceSearch, serviceStatusFilter, servicesList, showInactive]);

  const mergeServiceForState = (
    service: Omit<ServiceForAdmin, 'assignedStaffCount'> | ServiceForAdmin,
    previous?: ServiceForAdmin
  ): ServiceForAdmin => ({
    ...service,
    assignedStaffCount: 'assignedStaffCount' in service
      ? service.assignedStaffCount
      : previous?.assignedStaffCount || 0,
  });

  const bookingRuleWarnings = useMemo(() => {
    const warnings: string[] = [];

    if (bookingRules.allowSameDayBooking && bookingRules.minNoticeHours >= 24) {
      warnings.push('Same-Day Buchungen sind aktiviert, werden durch mindestens 24 Stunden Vorlauf aber praktisch blockiert.');
    }

    if (bookingRules.allowCustomerCancellation && bookingRules.cancellationDeadlineHours === 0) {
      warnings.push('Kunden können bis zum Terminbeginn selbst stornieren. Prüfen Sie, ob das fachlich gewünscht ist.');
    }

    if (bookingRules.bufferMinutes >= 60) {
      warnings.push('Eine Pufferzeit ab 60 Minuten reduziert die verfügbaren Termine stark.');
    }

    return warnings;
  }, [bookingRules]);

  // ============================================
  // SERVICE HANDLERS
  // ============================================

  const openAddServiceDialog = () => {
    setEditingService(null);
    setServiceForm(defaultServiceForm);
    setServiceDialogOpen(true);
  };

  const openEditServiceDialog = (service: ServiceForAdmin) => {
    setEditingService(service);
    setServiceForm({
      name: service.name,
      description: service.description || '',
      categoryId: service.categoryId || '',
      durationMinutes: service.durationMinutes,
      price: (service.priceCents / 100).toString(),
      priceFrom: service.priceFrom,
      isBookableOnline: service.isBookableOnline,
    });
    setServiceDialogOpen(true);
  };

  const openDeleteDialog = (service: ServiceForAdmin) => {
    setServiceToDelete(service);
    setDeleteDialogOpen(true);
  };

  const handleSaveService = async () => {
    if (!serviceForm.name.trim()) {
      toast.error('Bitte geben Sie einen Namen ein');
      return;
    }
    if (serviceForm.durationMinutes < 5) {
      toast.error('Mindestdauer ist 5 Minuten');
      return;
    }
    if (serviceForm.durationMinutes > 480) {
      toast.error('Maximaldauer ist 480 Minuten');
      return;
    }

    const priceCents = Math.round(parseFloat(serviceForm.price || '0') * 100);
    if (!Number.isFinite(priceCents) || priceCents < 0) {
      toast.error('Bitte geben Sie einen gültigen Preis ein');
      return;
    }

    setIsSaving(true);

    try {
      if (editingService) {
        // Update existing service
        const result = await updateService({
          id: editingService.id,
          name: serviceForm.name,
          description: serviceForm.description || undefined,
          categoryId: serviceForm.categoryId || null,
          durationMinutes: serviceForm.durationMinutes,
          priceCents: priceCents,
          priceFrom: serviceForm.priceFrom,
          isBookableOnline: serviceForm.isBookableOnline,
        });

        if (result.success) {
          toast.success('Leistung aktualisiert');
          if (result.data) {
            setServicesList((prev) => prev.map((service) =>
              service.id === editingService.id
                ? mergeServiceForState(result.data!, service)
                : service
            ));
          }
          setServiceDialogOpen(false);
          router.refresh();
        } else {
          toast.error(result.error || 'Fehler beim Aktualisieren');
        }
      } else {
        // Create new service
        const result = await createService({
          name: serviceForm.name,
          description: serviceForm.description || undefined,
          categoryId: serviceForm.categoryId || undefined,
          durationMinutes: serviceForm.durationMinutes,
          priceCents: priceCents,
          priceFrom: serviceForm.priceFrom,
          isBookableOnline: serviceForm.isBookableOnline,
        });

        if (result.success) {
          toast.success('Leistung erstellt');
          if (result.data) {
            setServicesList((prev) => [...prev, mergeServiceForState(result.data!)]);
          }
          setServiceDialogOpen(false);
          router.refresh();
        } else {
          toast.error(result.error || 'Fehler beim Erstellen');
        }
      }
    } catch (error) {
      console.error('Error saving service:', error);
      toast.error('Ein Fehler ist aufgetreten');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteService = async () => {
    if (!serviceToDelete) return;

    setIsSaving(true);

    try {
      const result = await deleteService(serviceToDelete.id);

      if (result.success) {
        toast.success('Leistung deaktiviert');
        setServicesList((prev) => prev.map((service) =>
          service.id === serviceToDelete.id ? { ...service, isActive: false } : service
        ));
        setDeleteDialogOpen(false);
        setServiceToDelete(null);
        router.refresh();
      } else {
        toast.error(result.error || 'Fehler beim Deaktivieren');
      }
    } catch (error) {
      console.error('Error deleting service:', error);
      toast.error('Ein Fehler ist aufgetreten');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRestoreService = async (service: ServiceForAdmin) => {
    setIsSaving(true);

    try {
      const result = await restoreService(service.id);

      if (result.success) {
        toast.success('Leistung reaktiviert');
        setServicesList((prev) => prev.map((item) =>
          item.id === service.id ? { ...item, isActive: true } : item
        ));
        router.refresh();
      } else {
        toast.error(result.error || 'Fehler beim Reaktivieren');
      }
    } catch (error) {
      console.error('Error restoring service:', error);
      toast.error('Ein Fehler ist aufgetreten');
    } finally {
      setIsSaving(false);
    }
  };

  // ============================================
  // CATEGORY HANDLERS
  // ============================================

  const openAddCategoryDialog = () => {
    setEditingCategory(null);
    setCategoryForm({ name: '', description: '' });
    setCategoryDialogOpen(true);
  };

  const openEditCategoryDialog = (category: ServiceCategory) => {
    setEditingCategory(category);
    setCategoryForm({
      name: category.name,
      description: category.description || '',
    });
    setCategoryDialogOpen(true);
  };

  const openDeleteCategoryDialog = (category: ServiceCategory) => {
    setCategoryToDelete(category);
    setDeleteCategoryDialogOpen(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim()) {
      toast.error('Bitte geben Sie einen Namen ein');
      return;
    }

    setIsSaving(true);

    try {
      if (editingCategory) {
        const result = await updateCategory(editingCategory.id, {
          name: categoryForm.name,
          description: categoryForm.description || undefined,
        });

        if (result.success && result.data) {
          toast.success('Kategorie aktualisiert');
          setCategoriesList(prev => prev.map(c => c.id === editingCategory.id ? result.data! : c));
          setCategoryDialogOpen(false);
          router.refresh();
        } else {
          toast.error(result.error || 'Fehler beim Aktualisieren');
        }
      } else {
        const result = await createCategory({
          name: categoryForm.name,
          description: categoryForm.description || undefined,
        });

        if (result.success && result.data) {
          toast.success('Kategorie erstellt');
          setCategoriesList(prev => [...prev, result.data!]);
          setCategoryDialogOpen(false);
          router.refresh();
        } else {
          toast.error(result.error || 'Fehler beim Erstellen');
        }
      }
    } catch (error) {
      console.error('Error saving category:', error);
      toast.error('Ein Fehler ist aufgetreten');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!categoryToDelete) return;

    setIsSaving(true);

    try {
      const result = await deleteCategory(categoryToDelete.id);

      if (result.success) {
        toast.success('Kategorie gelöscht');
        setCategoriesList(prev => prev.filter(c => c.id !== categoryToDelete.id));
        setDeleteCategoryDialogOpen(false);
        setCategoryToDelete(null);
        router.refresh();
      } else {
        toast.error(result.error || 'Fehler beim Löschen');
      }
    } catch (error) {
      console.error('Error deleting category:', error);
      toast.error('Ein Fehler ist aufgetreten');
    } finally {
      setIsSaving(false);
    }
  };

  const handleMoveCategory = async (categoryId: string, direction: 'up' | 'down') => {
    const currentIndex = categoriesList.findIndex(c => c.id === categoryId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= categoriesList.length) return;

    // Create new array with swapped positions
    const newList = [...categoriesList];
    [newList[currentIndex], newList[newIndex]] = [newList[newIndex], newList[currentIndex]];

    // Update local state immediately for responsive UI
    setCategoriesList(newList);

    // Save to database
    try {
      const result = await reorderCategories(newList.map(c => c.id));
      if (!result.success) {
        // Revert on error
        setCategoriesList(categoriesList);
        toast.error(result.error || 'Fehler beim Speichern der Reihenfolge');
      } else {
        router.refresh();
      }
    } catch (error) {
      console.error('Error reordering categories:', error);
      setCategoriesList(categoriesList);
      toast.error('Fehler beim Speichern der Reihenfolge');
    }
  };

  // ============================================
  // VARIANT HANDLERS
  // ============================================

  const openVariantsDialog = async (serviceId: string, serviceName: string) => {
    setVariantServiceId(serviceId);
    setVariantServiceName(serviceName);
    setVariantsManageOpen(true);
    setIsLoadingVariants(true);

    try {
      const variantsList = await getServiceVariants(serviceId);
      setVariants(variantsList);
    } catch (error) {
      console.error('Error loading variants:', error);
      toast.error('Fehler beim Laden der Varianten');
    } finally {
      setIsLoadingVariants(false);
    }
  };

  const openAddVariantDialog = () => {
    setEditingVariant(null);
    setVariantForm({ name: '', description: '', price: '', durationMinutes: '' });
    setVariantDialogOpen(true);
  };

  const openEditVariantDialog = (variant: ServiceVariant) => {
    setEditingVariant(variant);
    setVariantForm({
      name: variant.name,
      description: variant.description || '',
      price: (variant.priceCents / 100).toString(),
      durationMinutes: variant.durationMinutes?.toString() || '',
    });
    setVariantDialogOpen(true);
  };

  const handleSaveVariant = async () => {
    if (!variantForm.name.trim()) {
      toast.error('Bitte geben Sie einen Namen ein');
      return;
    }
    const priceCents = Math.round(parseFloat(variantForm.price || '0') * 100);
    if (!Number.isFinite(priceCents) || priceCents < 0) {
      toast.error('Bitte geben Sie einen gültigen Preis ein');
      return;
    }
    const variantDuration = variantForm.durationMinutes ? parseInt(variantForm.durationMinutes, 10) : null;
    if (variantDuration !== null && (!Number.isFinite(variantDuration) || variantDuration < 5 || variantDuration > 480)) {
      toast.error('Die Variantendauer muss zwischen 5 und 480 Minuten liegen');
      return;
    }
    if (!variantServiceId) return;

    setIsSaving(true);

    try {
      if (editingVariant) {
        const result = await updateVariant(editingVariant.id, {
          name: variantForm.name,
          description: variantForm.description || undefined,
          priceCents: priceCents,
          durationMinutes: variantDuration,
        });

        if (result.success && result.data) {
          toast.success('Variante aktualisiert');
          const updatedVariants = variants.map(v => v.id === editingVariant.id ? result.data! : v);
          setVariants(updatedVariants);
          setVariantDialogOpen(false);
          // Update local service list with minimum variant price
          const minPrice = Math.min(...updatedVariants.map(v => v.priceCents));
          setServicesList(prev => prev.map(s =>
            s.id === variantServiceId ? { ...s, priceCents: minPrice } : s
          ));
        } else {
          toast.error(result.error || 'Fehler beim Aktualisieren');
        }
      } else {
        const result = await createVariant({
          serviceId: variantServiceId,
          name: variantForm.name,
          description: variantForm.description || undefined,
          priceCents: priceCents,
          durationMinutes: variantDuration ?? undefined,
        });

        if (result.success && result.data) {
          toast.success('Variante erstellt');
          const newVariants = [...variants, result.data!];
          setVariants(newVariants);
          setVariantDialogOpen(false);
          // Update local service list with minimum variant price
          const minPrice = Math.min(...newVariants.map(v => v.priceCents));
          setServicesList(prev => prev.map(s =>
            s.id === variantServiceId ? { ...s, hasLengthVariants: true, priceFrom: true, priceCents: minPrice } : s
          ));
        } else {
          toast.error(result.error || 'Fehler beim Erstellen');
        }
      }
    } catch (error) {
      console.error('Error saving variant:', error);
      toast.error('Ein Fehler ist aufgetreten');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteVariant = async (variant: ServiceVariant) => {
    if (!variantServiceId) return;

    setIsSaving(true);

    try {
      const result = await deleteVariant(variant.id, variantServiceId);

      if (result.success) {
        toast.success('Variante gelöscht');
        const newVariants = variants.filter(v => v.id !== variant.id);
        setVariants(newVariants);
        // Update local service list
        if (newVariants.length === 0) {
          // No variants left - reset flags
          setServicesList(prev => prev.map(s =>
            s.id === variantServiceId ? { ...s, hasLengthVariants: false, priceFrom: false } : s
          ));
        } else {
          // Update price to new minimum
          const minPrice = Math.min(...newVariants.map(v => v.priceCents));
          setServicesList(prev => prev.map(s =>
            s.id === variantServiceId ? { ...s, priceCents: minPrice } : s
          ));
        }
      } else {
        toast.error(result.error || 'Fehler beim Löschen');
      }
    } catch (error) {
      console.error('Error deleting variant:', error);
      toast.error('Ein Fehler ist aufgetreten');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSalonInfo = async () => {
    setIsSaving(true);
    try {
      const result = await updateSalon({
        name: salonForm.name,
        email: salonForm.email || undefined,
        phone: salonForm.phone || undefined,
        website: salonForm.website || undefined,
        address: salonForm.address || undefined,
        zipCode: salonForm.zipCode || undefined,
        city: salonForm.city || undefined,
        description: salonForm.description || undefined,
      });
      if (result.success) {
        toast.success('Salon-Informationen wurden gespeichert', {
          description: 'Die Änderungen sind jetzt auf der Website sichtbar.',
        });
        router.refresh();
      } else {
        toast.error('Fehler beim Speichern', {
          description: result.error || 'Bitte versuchen Sie es erneut.',
        });
      }
    } catch (error) {
      toast.error('Fehler beim Speichern', {
        description: 'Ein unerwarteter Fehler ist aufgetreten.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle logo file selection
  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Ungültiger Dateityp', {
        description: 'Erlaubt: JPG, PNG, WebP, GIF, SVG',
      });
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Datei zu gross', {
        description: 'Maximale Grösse: 5MB',
      });
      return;
    }

    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  // Handle logo upload
  const handleLogoUpload = async () => {
    if (!logoFile || !salon?.id) return;

    setIsUploadingLogo(true);

    try {
      // Generate unique file name
      const ext = logoFile.name.split('.').pop()?.toLowerCase() || 'png';
      const timestamp = Date.now();
      const storagePath = `${salon.id}/logo-${timestamp}.${ext}`;

      // Upload to storage
      const formData = new FormData();
      formData.append('file', logoFile);
      formData.append('bucket', 'salon-logos');
      formData.append('path', storagePath);

      const uploadResponse = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.error || 'Upload fehlgeschlagen');
      }

      const { url } = await uploadResponse.json();

      // Update salon with new logo URL
      const result = await updateSalon({ logoUrl: url });

      if (result.success) {
        toast.success('Logo hochgeladen', {
          description: 'Das Logo ist jetzt auf der Website sichtbar.',
        });
        setLogoFile(null);
        router.refresh();
      } else {
        throw new Error(result.error || 'Fehler beim Speichern');
      }
    } catch (error: any) {
      console.error('Logo upload error:', error);
      toast.error('Upload fehlgeschlagen', {
        description: error.message || 'Bitte versuchen Sie es erneut.',
      });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  // Handle logo delete
  const handleLogoDelete = async () => {
    if (!salon?.id) return;

    setIsUploadingLogo(true);

    try {
      const result = await updateSalon({ logoUrl: null });

      if (result.success) {
        toast.success('Logo entfernt');
        setLogoPreview(null);
        setLogoFile(null);
        router.refresh();
      } else {
        throw new Error(result.error || 'Fehler beim Entfernen');
      }
    } catch (error: any) {
      console.error('Logo delete error:', error);
      toast.error('Entfernen fehlgeschlagen', {
        description: error.message || 'Bitte versuchen Sie es erneut.',
      });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleSave = async () => {
    if (!salon?.id) {
      toast.error('Fehler beim Speichern', {
        description: 'Salon-ID nicht gefunden.',
      });
      return;
    }

    if (
      bookingRules.minNoticeHours < 0 ||
      bookingRules.maxAdvanceDays < 1 ||
      bookingRules.bufferMinutes < 0 ||
      bookingRules.cancellationDeadlineHours < 0
    ) {
      toast.error('Bitte prüfen Sie die Buchungsregeln', {
        description: 'Zeitwerte dürfen nicht negativ sein; der Buchungshorizont muss mindestens 1 Tag betragen.',
      });
      return;
    }

    if (bookingRules.minNoticeHours > 720 || bookingRules.maxAdvanceDays > 365) {
      toast.error('Bitte prüfen Sie die Buchungsregeln', {
        description: 'Mindestvorlauf maximal 720 Stunden, Buchungshorizont maximal 365 Tage.',
      });
      return;
    }

    if (bookingRules.bufferMinutes > 240 || bookingRules.cancellationDeadlineHours > 720) {
      toast.error('Bitte prüfen Sie die Buchungsregeln', {
        description: 'Pufferzeit maximal 240 Minuten, Stornofrist maximal 720 Stunden.',
      });
      return;
    }

    setIsSaving(true);
    try {
      const result = await saveBookingRules({
        salonId: salon.id,
        requireAppointmentApproval: bookingRules.requireAppointmentApproval,
        minNoticeHours: bookingRules.minNoticeHours,
        maxAdvanceDays: bookingRules.maxAdvanceDays,
        bufferMinutes: bookingRules.bufferMinutes,
        allowSameDayBooking: bookingRules.allowSameDayBooking,
        requirePhoneForBooking: bookingRules.requirePhoneForBooking,
        allowCustomerCancellation: bookingRules.allowCustomerCancellation,
        cancellationDeadlineHours: bookingRules.cancellationDeadlineHours,
      });

      if (result.success) {
        toast.success('Buchungsregeln wurden gespeichert', {
          description: 'Die Änderungen werden bei der nächsten Buchung berücksichtigt.',
        });
        router.refresh();
      } else {
        toast.error('Fehler beim Speichern', {
          description: result.error || 'Bitte versuchen Sie es erneut.',
        });
      }
    } catch (error) {
      toast.error('Fehler beim Speichern', {
        description: 'Ein unerwarteter Fehler ist aufgetreten.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveOpeningHours = async () => {
    setIsSaving(true);
    try {
      const result = await updateOpeningHours(openingHours);
      if (result.success) {
        toast.success('Öffnungszeiten wurden gespeichert', {
          description: 'Die Änderungen werden bei der nächsten Buchung berücksichtigt.',
        });
        router.refresh();
      } else {
        toast.error('Fehler beim Speichern', {
          description: result.error || 'Bitte versuchen Sie es erneut.',
        });
      }
    } catch (error) {
      toast.error('Fehler beim Speichern', {
        description: 'Ein unerwarteter Fehler ist aufgetreten.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSocialLinks = async () => {
    setIsSaving(true);
    try {
      const result = await updateSocialLinks(
        socialLinksForm.map((link) => ({
          id: link.id || undefined,
          platform: link.platform,
          url: link.url,
          isEnabled: link.isEnabled,
          sortOrder: link.sortOrder,
        }))
      );
      if (result.success) {
        toast.success('Social Media Links wurden gespeichert', {
          description: 'Die Änderungen sind jetzt auf der Website sichtbar.',
        });
        router.refresh();
      } else {
        toast.error('Fehler beim Speichern', {
          description: result.error || 'Bitte versuchen Sie es erneut.',
        });
      }
    } catch (error) {
      toast.error('Fehler beim Speichern', {
        description: 'Ein unerwarteter Fehler ist aufgetreten.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle footer settings save
  const handleSaveFooter = async () => {
    setIsSavingFooter(true);
    try {
      const result = await updateSalon({
        tagline: footerForm.tagline || null,
        footerDescription: footerForm.footerDescription || null,
      });

      if (result.success) {
        toast.success('Footer-Einstellungen gespeichert', {
          description: 'Die Änderungen sind jetzt im Footer sichtbar.',
        });
        router.refresh();
      } else {
        toast.error('Fehler beim Speichern', {
          description: result.error || 'Bitte versuchen Sie es erneut.',
        });
      }
    } catch (error) {
      toast.error('Fehler beim Speichern', {
        description: 'Ein unerwarteter Fehler ist aufgetreten.',
      });
    } finally {
      setIsSavingFooter(false);
    }
  };

  // Handle homepage settings save
  const handleSaveHomepage = async () => {
    setIsSavingHomepage(true);
    try {
      const result = await updateSalon({
        heroTagline: homepageForm.heroTagline || null,
        heroHeadline: homepageForm.heroHeadline || null,
        heroHeadlineAccent: homepageForm.heroHeadlineAccent || null,
        heroDescription: homepageForm.heroDescription || null,
      });

      if (result.success) {
        toast.success('Homepage-Einstellungen gespeichert', {
          description: 'Die Änderungen sind jetzt auf der Startseite sichtbar.',
        });
        router.refresh();
      } else {
        toast.error('Fehler beim Speichern', {
          description: result.error || 'Bitte versuchen Sie es erneut.',
        });
      }
    } catch (error) {
      toast.error('Fehler beim Speichern', {
        description: 'Ein unerwarteter Fehler ist aufgetreten.',
      });
    } finally {
      setIsSavingHomepage(false);
    }
  };

  // Handle hero image file selection
  const handleHeroImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setHeroImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setHeroImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle hero image upload
  const handleUploadHeroImage = async () => {
    if (!heroImageFile) return;

    setIsUploadingHeroImage(true);
    try {
      const timestamp = Date.now();
      const ext = heroImageFile.name.split('.').pop() || 'jpg';
      const filename = `hero-homepage-${timestamp}.${ext}`;

      const formData = new FormData();
      formData.append('file', heroImageFile);
      formData.append('bucket', 'hero-images');
      formData.append('path', filename);

      const response = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success && result.url) {
        const saveResult = await updateSalon({
          heroImageUrl: result.url,
        });

        if (saveResult.success) {
          setHeroImagePreview(result.url);
          setHeroImageFile(null);
          toast.success('Bild hochgeladen', {
            description: 'Das Hero-Bild wurde erfolgreich gespeichert.',
          });
          router.refresh();
        } else {
          toast.error('Fehler beim Speichern', {
            description: saveResult.error || 'Bitte versuchen Sie es erneut.',
          });
        }
      } else {
        toast.error('Upload fehlgeschlagen', {
          description: result.error || 'Bitte versuchen Sie es erneut.',
        });
      }
    } catch (error) {
      toast.error('Upload fehlgeschlagen', {
        description: 'Ein unerwarteter Fehler ist aufgetreten.',
      });
    } finally {
      setIsUploadingHeroImage(false);
    }
  };

  // Handle about image file selection
  const handleAboutImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAboutImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAboutImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle about image upload
  const handleUploadAboutImage = async () => {
    if (!aboutImageFile) return;

    setIsUploadingAboutImage(true);
    try {
      // Generate unique filename
      const timestamp = Date.now();
      const ext = aboutImageFile.name.split('.').pop() || 'jpg';
      const filename = `hero-${timestamp}.${ext}`;

      const formData = new FormData();
      formData.append('file', aboutImageFile);
      formData.append('bucket', 'about-images');
      formData.append('path', filename);

      const response = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success && result.url) {
        // Save the URL to the database
        const saveResult = await updateSalon({
          aboutHeroImageUrl: result.url,
        });

        if (saveResult.success) {
          setAboutImagePreview(result.url);
          setAboutImageFile(null);
          toast.success('Bild hochgeladen', {
            description: 'Das Über-uns-Bild wurde erfolgreich gespeichert.',
          });
          router.refresh();
        } else {
          toast.error('Fehler beim Speichern', {
            description: saveResult.error || 'Bitte versuchen Sie es erneut.',
          });
        }
      } else {
        toast.error('Upload fehlgeschlagen', {
          description: result.error || 'Bitte versuchen Sie es erneut.',
        });
      }
    } catch (error) {
      toast.error('Upload fehlgeschlagen', {
        description: 'Ein unerwarteter Fehler ist aufgetreten.',
      });
    } finally {
      setIsUploadingAboutImage(false);
    }
  };

  // Handle about page settings save
  const handleSaveAbout = async () => {
    setIsSavingAbout(true);
    try {
      const result = await updateSalon({
        aboutHeroTagline: aboutForm.aboutHeroTagline || null,
        aboutHeroHeadline: aboutForm.aboutHeroHeadline || null,
        aboutHeroDescription: aboutForm.aboutHeroDescription || null,
      });

      if (result.success) {
        toast.success('Über-uns-Einstellungen gespeichert', {
          description: 'Die Änderungen sind jetzt auf der Über-uns-Seite sichtbar.',
        });
        router.refresh();
      } else {
        toast.error('Fehler beim Speichern', {
          description: result.error || 'Bitte versuchen Sie es erneut.',
        });
      }
    } catch (error) {
      toast.error('Fehler beim Speichern', {
        description: 'Ein unerwarteter Fehler ist aufgetreten.',
      });
    } finally {
      setIsSavingAbout(false);
    }
  };

  // ============================================
  // TEAM PAGE HERO HANDLERS
  // ============================================

  // Handle team image file selection
  const handleTeamImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setTeamImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setTeamImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle team image upload
  const handleUploadTeamImage = async () => {
    if (!teamImageFile) return;

    setIsUploadingTeamImage(true);
    try {
      const timestamp = Date.now();
      const ext = teamImageFile.name.split('.').pop() || 'jpg';
      const filename = `hero-${timestamp}.${ext}`;

      const formData = new FormData();
      formData.append('file', teamImageFile);
      formData.append('bucket', 'team-images');
      formData.append('path', filename);

      const response = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success && result.url) {
        const saveResult = await updateSalon({
          teamHeroImageUrl: result.url,
        });

        if (saveResult.success) {
          setTeamImagePreview(result.url);
          setTeamImageFile(null);
          toast.success('Bild hochgeladen', {
            description: 'Das Team-Bild wurde erfolgreich gespeichert.',
          });
          router.refresh();
        } else {
          toast.error('Fehler beim Speichern', {
            description: saveResult.error || 'Bitte versuchen Sie es erneut.',
          });
        }
      } else {
        toast.error('Upload fehlgeschlagen', {
          description: result.error || 'Bitte versuchen Sie es erneut.',
        });
      }
    } catch (error) {
      toast.error('Upload fehlgeschlagen', {
        description: 'Ein unerwarteter Fehler ist aufgetreten.',
      });
    } finally {
      setIsUploadingTeamImage(false);
    }
  };

  // Handle team page settings save
  const handleSaveTeam = async () => {
    setIsSavingTeam(true);
    try {
      const result = await updateSalon({
        teamHeroHeadline: teamForm.teamHeroHeadline || null,
        teamHeroDescription: teamForm.teamHeroDescription || null,
        teamHeroBenefits: teamForm.teamHeroBenefits.filter(b => b.trim() !== ''),
      });

      if (result.success) {
        toast.success('Team-Einstellungen gespeichert', {
          description: 'Die Änderungen sind jetzt auf der Team-Seite sichtbar.',
        });
        router.refresh();
      } else {
        toast.error('Fehler beim Speichern', {
          description: result.error || 'Bitte versuchen Sie es erneut.',
        });
      }
    } catch (error) {
      toast.error('Fehler beim Speichern', {
        description: 'Ein unerwarteter Fehler ist aufgetreten.',
      });
    } finally {
      setIsSavingTeam(false);
    }
  };

  // Handle adding a new benefit
  const handleAddBenefit = () => {
    setTeamForm(prev => ({
      ...prev,
      teamHeroBenefits: [...prev.teamHeroBenefits, ''],
    }));
  };

  // Handle updating a benefit
  const handleUpdateBenefit = (index: number, value: string) => {
    setTeamForm(prev => ({
      ...prev,
      teamHeroBenefits: prev.teamHeroBenefits.map((b, i) => i === index ? value : b),
    }));
  };

  // Handle removing a benefit
  const handleRemoveBenefit = (index: number) => {
    setTeamForm(prev => ({
      ...prev,
      teamHeroBenefits: prev.teamHeroBenefits.filter((_, i) => i !== index),
    }));
  };

  // ============================================
  // ABOUT VALUES HANDLERS
  // ============================================

  const handleOpenValueDialog = (value?: AboutValue) => {
    if (value) {
      setEditingValue(value);
      setValueForm({ title: value.title, description: value.description, icon: value.icon });
    } else {
      setEditingValue(null);
      setValueForm({ title: '', description: '', icon: 'sparkles' });
    }
    setValueDialogOpen(true);
  };

  const handleSaveValue = async () => {
    if (!valueForm.title.trim() || !valueForm.description.trim()) {
      toast.error('Bitte füllen Sie alle Felder aus');
      return;
    }

    setIsSavingValue(true);
    try {
      if (editingValue) {
        const result = await updateAboutValue({
          id: editingValue.id,
          title: valueForm.title,
          description: valueForm.description,
          icon: valueForm.icon,
        });
        if (result.success && result.value) {
          setValuesList(prev => prev.map(v => v.id === editingValue.id ? result.value! : v));
          toast.success('Wert aktualisiert');
        } else {
          toast.error(result.error || 'Fehler beim Aktualisieren');
        }
      } else {
        const result = await createAboutValue({
          title: valueForm.title,
          description: valueForm.description,
          icon: valueForm.icon,
        });
        if (result.success && result.value) {
          setValuesList(prev => [...prev, result.value!]);
          toast.success('Wert hinzugefügt');
        } else {
          toast.error(result.error || 'Fehler beim Erstellen');
        }
      }
      setValueDialogOpen(false);
      router.refresh();
    } catch {
      toast.error('Ein unerwarteter Fehler ist aufgetreten');
    } finally {
      setIsSavingValue(false);
    }
  };

  const handleDeleteValue = async (id: string) => {
    setDeletingValueId(id);
    try {
      const result = await deleteAboutValue(id);
      if (result.success) {
        setValuesList(prev => prev.filter(v => v.id !== id));
        toast.success('Wert gelöscht');
        router.refresh();
      } else {
        toast.error(result.error || 'Fehler beim Löschen');
      }
    } catch {
      toast.error('Ein unerwarteter Fehler ist aufgetreten');
    } finally {
      setDeletingValueId(null);
    }
  };

  // ============================================
  // ABOUT MILESTONES HANDLERS
  // ============================================

  const handleOpenMilestoneDialog = (milestone?: AboutMilestone) => {
    if (milestone) {
      setEditingMilestone(milestone);
      setMilestoneForm({ year: milestone.year, title: milestone.title, description: milestone.description });
    } else {
      setEditingMilestone(null);
      setMilestoneForm({ year: '', title: '', description: '' });
    }
    setMilestoneDialogOpen(true);
  };

  const handleSaveMilestone = async () => {
    if (!milestoneForm.year.trim() || !milestoneForm.title.trim() || !milestoneForm.description.trim()) {
      toast.error('Bitte füllen Sie alle Felder aus');
      return;
    }

    setIsSavingMilestone(true);
    try {
      if (editingMilestone) {
        const result = await updateAboutMilestone({
          id: editingMilestone.id,
          year: milestoneForm.year,
          title: milestoneForm.title,
          description: milestoneForm.description,
        });
        if (result.success && result.milestone) {
          setMilestonesList(prev => prev.map(m => m.id === editingMilestone.id ? result.milestone! : m));
          toast.success('Meilenstein aktualisiert');
        } else {
          toast.error(result.error || 'Fehler beim Aktualisieren');
        }
      } else {
        const result = await createAboutMilestone({
          year: milestoneForm.year,
          title: milestoneForm.title,
          description: milestoneForm.description,
        });
        if (result.success && result.milestone) {
          setMilestonesList(prev => [...prev, result.milestone!]);
          toast.success('Meilenstein hinzugefügt');
        } else {
          toast.error(result.error || 'Fehler beim Erstellen');
        }
      }
      setMilestoneDialogOpen(false);
      router.refresh();
    } catch {
      toast.error('Ein unerwarteter Fehler ist aufgetreten');
    } finally {
      setIsSavingMilestone(false);
    }
  };

  const handleDeleteMilestone = async (id: string) => {
    setDeletingMilestoneId(id);
    try {
      const result = await deleteAboutMilestone(id);
      if (result.success) {
        setMilestonesList(prev => prev.filter(m => m.id !== id));
        toast.success('Meilenstein gelöscht');
        router.refresh();
      } else {
        toast.error(result.error || 'Fehler beim Löschen');
      }
    } catch {
      toast.error('Ein unerwarteter Fehler ist aufgetreten');
    } finally {
      setDeletingMilestoneId(null);
    }
  };

  // ============================================
  // SALON CLOSURE (BETRIEBSFERIEN) HANDLERS
  // ============================================

  const openAddClosureDialog = () => {
    setEditingClosure(null);
    setClosureForm({ startDate: '', endDate: '', reason: '' });
    setClosureDialogOpen(true);
  };

  const openEditClosureDialog = (closure: SalonClosureData) => {
    setEditingClosure(closure);
    // Convert ISO datetime to date string for input
    setClosureForm({
      startDate: closure.startTime.split('T')[0],
      endDate: closure.endTime.split('T')[0],
      reason: closure.reason || '',
    });
    setClosureDialogOpen(true);
  };

  const handleSaveClosure = async () => {
    if (!closureForm.startDate || !closureForm.endDate) {
      toast.error('Bitte wählen Sie Start- und Enddatum aus');
      return;
    }

    if (!salon?.id) {
      toast.error('Salon ID nicht gefunden');
      return;
    }

    setIsSaving(true);
    try {
      // Convert date strings to ISO timestamps (start of day for start, end of day for end)
      const startTime = new Date(closureForm.startDate);
      startTime.setHours(0, 0, 0, 0);
      const endTime = new Date(closureForm.endDate);
      endTime.setHours(23, 59, 59, 999);

      if (editingClosure) {
        // Update existing closure
        const result = await updateSalonClosure({
          id: editingClosure.id,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          reason: closureForm.reason || undefined,
        });

        if (result.success) {
          // Update local state
          setSalonClosuresList(prev =>
            prev.map(c => c.id === editingClosure.id ? {
              ...c,
              startTime: startTime.toISOString(),
              endTime: endTime.toISOString(),
              reason: closureForm.reason || null,
            } : c)
          );
          toast.success('Betriebsferien wurden aktualisiert');
          setClosureDialogOpen(false);
          router.refresh();
        } else {
          toast.error('Fehler beim Aktualisieren', {
            description: result.error || 'Bitte versuchen Sie es erneut.',
          });
        }
      } else {
        // Create new closure
        const result = await createSalonClosure({
          salonId: salon.id,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          reason: closureForm.reason || undefined,
        });

        if (result.success && result.id) {
          // Add to local state
          setSalonClosuresList(prev => [...prev, {
            id: result.id!,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            reason: closureForm.reason || null,
            createdAt: new Date().toISOString(),
          }]);
          toast.success('Betriebsferien wurden hinzugefügt');
          setClosureDialogOpen(false);
          router.refresh();
        } else {
          toast.error('Fehler beim Erstellen', {
            description: result.error || 'Bitte versuchen Sie es erneut.',
          });
        }
      }
    } catch (error) {
      toast.error('Fehler beim Speichern', {
        description: 'Ein unerwarteter Fehler ist aufgetreten.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClosure = async () => {
    if (!closureToDelete) return;

    setIsSaving(true);
    try {
      const result = await deleteSalonClosure(closureToDelete.id);

      if (result.success) {
        setSalonClosuresList(prev => prev.filter(c => c.id !== closureToDelete.id));
        toast.success('Betriebsferien wurden gelöscht');
        setDeleteClosureDialogOpen(false);
        setClosureToDelete(null);
        router.refresh();
      } else {
        toast.error('Fehler beim Löschen', {
          description: result.error || 'Bitte versuchen Sie es erneut.',
        });
      }
    } catch (error) {
      toast.error('Fehler beim Löschen', {
        description: 'Ein unerwarteter Fehler ist aufgetreten.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const formatDateRange = (startTime: string, endTime: string) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' };
    return `${start.toLocaleDateString('de-DE', options)} - ${end.toLocaleDateString('de-DE', options)}`;
  };

  const updateSocialLink = (platform: string, field: keyof SocialLinkData, value: string | boolean | number) => {
    setSocialLinksForm((prev) =>
      prev.map((link) =>
        link.platform === platform ? { ...link, [field]: value } : link
      )
    );
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'instagram':
        return <Instagram className="h-5 w-5" />;
      case 'facebook':
        return <Facebook className="h-5 w-5" />;
      case 'youtube':
        return <Youtube className="h-5 w-5" />;
      case 'tiktok':
        return <TikTokIcon className="h-5 w-5" />;
      default:
        return <Globe className="h-5 w-5" />;
    }
  };

  const getPlatformLabel = (platform: string) => {
    switch (platform) {
      case 'instagram':
        return 'Instagram';
      case 'facebook':
        return 'Facebook';
      case 'youtube':
        return 'YouTube';
      case 'tiktok':
        return 'TikTok';
      default:
        return platform;
    }
  };

  const getPlatformPlaceholder = (platform: string) => {
    switch (platform) {
      case 'instagram':
        return 'https://instagram.com/ihr-salon';
      case 'facebook':
        return 'https://facebook.com/ihr-salon';
      case 'youtube':
        return 'https://youtube.com/@ihr-salon';
      case 'tiktok':
        return 'https://tiktok.com/@ihr-salon';
      default:
        return 'https://...';
    }
  };

  return (
    <>
      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="general">
            <Building className="h-4 w-4 mr-2" />
            Allgemein
          </TabsTrigger>
          <TabsTrigger value="homepage">
            <Globe className="h-4 w-4 mr-2" />
            Webseite
          </TabsTrigger>
          <TabsTrigger value="hours">
            <Clock className="h-4 w-4 mr-2" />
            Öffnungszeiten
          </TabsTrigger>
          <TabsTrigger value="booking">
            <CalendarClock className="h-4 w-4 mr-2" />
            Buchungsregeln
          </TabsTrigger>
          <TabsTrigger value="services">
            <Scissors className="h-4 w-4 mr-2" />
            Leistungen
          </TabsTrigger>
          {features.shopEnabled && (
            <TabsTrigger value="payments">
              <CreditCard className="h-4 w-4 mr-2" />
              Zahlungen
            </TabsTrigger>
          )}
          <TabsTrigger value="notifications">
            <Mail className="h-4 w-4 mr-2" />
            Benachrichtigungen
          </TabsTrigger>
          <TabsTrigger value="social">
            <Share2 className="h-4 w-4 mr-2" />
            Social Media
          </TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>Salon-Informationen</CardTitle>
              <CardDescription>
                Grundlegende Informationen über Ihren Salon
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Salon Name</Label>
                  <Input
                    id="name"
                    value={salonForm.name}
                    onChange={(e) => setSalonForm({ ...salonForm, name: e.target.value })}
                    placeholder="BeautifyPRO"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-Mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={salonForm.email}
                    onChange={(e) => setSalonForm({ ...salonForm, email: e.target.value })}
                    placeholder="kontakt@salon.ch"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefon</Label>
                  <Input
                    id="phone"
                    value={salonForm.phone}
                    onChange={(e) => setSalonForm({ ...salonForm, phone: e.target.value })}
                    placeholder="+41 71 123 45 67"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={salonForm.website}
                    disabled
                    className="bg-muted"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Adresse</Label>
                <Input
                  id="address"
                  value={salonForm.address}
                  onChange={(e) => setSalonForm({ ...salonForm, address: e.target.value })}
                  placeholder="Musterstrasse 1"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="postal_code">PLZ</Label>
                  <Input
                    id="postal_code"
                    value={salonForm.zipCode}
                    onChange={(e) => setSalonForm({ ...salonForm, zipCode: e.target.value })}
                    placeholder="9000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">Stadt</Label>
                  <Input
                    id="city"
                    value={salonForm.city}
                    onChange={(e) => setSalonForm({ ...salonForm, city: e.target.value })}
                    placeholder="St. Gallen"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Beschreibung</Label>
                <Textarea
                  id="description"
                  value={salonForm.description}
                  onChange={(e) => setSalonForm({ ...salonForm, description: e.target.value })}
                  placeholder="Kurze Beschreibung des Salons..."
                  rows={4}
                />
              </div>

              {/* Logo Upload Section */}
              <div className="space-y-2 pt-4 border-t">
                <Label>Salon Logo</Label>
                <p className="text-sm text-muted-foreground mb-3">
                  Das Logo wird in der Navigation und im Admin-Bereich angezeigt.
                </p>
                <div className="flex items-start gap-4">
                  {/* Logo Preview */}
                  <div className="w-24 h-24 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center bg-muted/50 overflow-hidden">
                    {logoPreview ? (
                      <img
                        src={logoPreview}
                        alt="Salon Logo"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <Input
                      id="logo"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                      onChange={handleLogoSelect}
                      className="cursor-pointer"
                    />
                    <p className="text-xs text-muted-foreground">
                      Erlaubt: JPG, PNG, WebP, GIF, SVG. Max. 5MB
                    </p>
                    <div className="flex gap-2">
                      {logoFile && (
                        <Button
                          size="sm"
                          onClick={handleLogoUpload}
                          disabled={isUploadingLogo}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          {isUploadingLogo ? 'Hochladen...' : 'Hochladen'}
                        </Button>
                      )}
                      {logoPreview && !logoFile && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleLogoDelete}
                          disabled={isUploadingLogo}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Entfernen
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveSalonInfo} disabled={isSaving}>
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? 'Speichern...' : 'Speichern'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Homepage Settings */}
        <TabsContent value="homepage">
          <Card>
            <CardHeader>
              <CardTitle>Homepage Hero-Bereich</CardTitle>
              <CardDescription>
                Passen Sie den Hero-Bereich auf der Startseite an. Diese Texte werden prominent auf der Startseite angezeigt.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Hero Image */}
              <div className="space-y-4">
                <Label>Hero-Bild</Label>
                <div className="flex items-start gap-6">
                  {/* Image Preview */}
                  <div className="relative w-48 h-36 bg-muted rounded-lg overflow-hidden border">
                    {heroImagePreview ? (
                      <img
                        src={heroImagePreview}
                        alt="Homepage Hero"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>

                  {/* Upload Controls */}
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleHeroImageChange}
                        className="max-w-xs"
                      />
                    </div>
                    {heroImageFile && (
                      <Button
                        onClick={handleUploadHeroImage}
                        disabled={isUploadingHeroImage}
                        size="sm"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {isUploadingHeroImage ? 'Hochladen...' : 'Bild hochladen'}
                      </Button>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Empfohlen: 1920x1080px, max. 10MB. JPG, PNG, WebP oder GIF.
                    </p>
                  </div>
                </div>
              </div>

              {/* Tagline */}
              <div className="space-y-2">
                <Label htmlFor="heroTagline">Tagline</Label>
                <Input
                  id="heroTagline"
                  value={homepageForm.heroTagline}
                  onChange={(e) => setHomepageForm(prev => ({ ...prev, heroTagline: e.target.value }))}
                  placeholder="z.B. Premium Friseursalon St. Gallen"
                />
                <p className="text-xs text-muted-foreground">
                  Kleine Überschrift über dem Haupttitel (optional)
                </p>
              </div>

              {/* Headline */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="heroHeadline">Haupttitel</Label>
                  <Input
                    id="heroHeadline"
                    value={homepageForm.heroHeadline}
                    onChange={(e) => setHomepageForm(prev => ({ ...prev, heroHeadline: e.target.value }))}
                    placeholder="z.B. Your Style."
                  />
                  <p className="text-xs text-muted-foreground">
                    Erster Teil des Titels (normal)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="heroHeadlineAccent">Akzent-Text</Label>
                  <Input
                    id="heroHeadlineAccent"
                    value={homepageForm.heroHeadlineAccent}
                    onChange={(e) => setHomepageForm(prev => ({ ...prev, heroHeadlineAccent: e.target.value }))}
                    placeholder="z.B. Your Statement."
                  />
                  <p className="text-xs text-muted-foreground">
                    Hervorgehobener Teil des Titels (gold)
                  </p>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="heroDescription">Beschreibung</Label>
                <Textarea
                  id="heroDescription"
                  value={homepageForm.heroDescription}
                  onChange={(e) => setHomepageForm(prev => ({ ...prev, heroDescription: e.target.value }))}
                  placeholder="z.B. Willkommen bei BeautifyPRO – wo Stil auf Handwerk trifft..."
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Kurze Beschreibung unter dem Titel
                </p>
              </div>

              {/* Preview */}
              <div className="rounded-lg border bg-charcoal p-6 text-center">
                <p className="text-xs text-muted-foreground mb-4">Vorschau</p>
                <p className="text-gold text-sm font-medium uppercase tracking-widest mb-2">
                  {homepageForm.heroTagline || 'Premium Friseursalon'}
                </p>
                <h2 className="text-2xl font-bold text-white mb-2">
                  {homepageForm.heroHeadline || 'Your Style.'}{' '}
                  <span className="text-gradient-gold">{homepageForm.heroHeadlineAccent || 'Your Statement.'}</span>
                </h2>
                <p className="text-sm text-white/80">
                  {homepageForm.heroDescription || 'Willkommen bei BeautifyPRO – wo Stil auf Handwerk trifft.'}
                </p>
              </div>

              {/* Save Button */}
              <div className="flex justify-end">
                <Button onClick={handleSaveHomepage} disabled={isSavingHomepage}>
                  <Save className="h-4 w-4 mr-2" />
                  {isSavingHomepage ? 'Speichern...' : 'Speichern'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Footer Settings */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Footer-Bereich</CardTitle>
              <CardDescription>
                Passen Sie die Texte im Footer-Bereich der Webseite an.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Tagline */}
              <div className="space-y-2">
                <Label htmlFor="footerTagline">Tagline / Slogan</Label>
                <Input
                  id="footerTagline"
                  value={footerForm.tagline}
                  onChange={(e) => setFooterForm(prev => ({ ...prev, tagline: e.target.value }))}
                  placeholder="z.B. Your Style. Your Statement."
                />
                <p className="text-xs text-muted-foreground">
                  Kurzer Slogan, der unter dem Salon-Namen im Footer angezeigt wird
                </p>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="footerDescription">Beschreibung</Label>
                <Textarea
                  id="footerDescription"
                  value={footerForm.footerDescription}
                  onChange={(e) => setFooterForm(prev => ({ ...prev, footerDescription: e.target.value }))}
                  placeholder="z.B. Ihr Premium-Friseursalon in St. Gallen. Wir kreieren individuelle Looks mit Leidenschaft und Expertise."
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Kurze Beschreibung des Salons im Footer
                </p>
              </div>

              {/* Preview */}
              <div className="rounded-lg border bg-charcoal p-6">
                <p className="text-xs text-muted-foreground mb-4">Vorschau</p>
                <h3 className="text-xl font-bold text-gradient-gold mb-2">{salonForm.name || 'Salon Name'}</h3>
                <p className="text-sm text-white/80 italic mb-2">
                  {footerForm.tagline || 'Your Style. Your Statement.'}
                </p>
                <p className="text-sm text-white/60">
                  {footerForm.footerDescription || 'Ihr Premium-Friseursalon. Wir kreieren individuelle Looks mit Leidenschaft und Expertise.'}
                </p>
              </div>

              {/* Save Button */}
              <div className="flex justify-end">
                <Button onClick={handleSaveFooter} disabled={isSavingFooter}>
                  <Save className="h-4 w-4 mr-2" />
                  {isSavingFooter ? 'Speichern...' : 'Speichern'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* About Page Hero Settings */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Über-uns Hero-Bereich</CardTitle>
              <CardDescription>
                Passen Sie den Hero-Bereich auf der Über-uns-Seite an.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* About Hero Image */}
              <div className="space-y-4">
                <Label>Hero-Bild</Label>
                <div className="flex items-start gap-6">
                  {/* Image Preview */}
                  <div className="relative w-48 h-36 bg-muted rounded-lg overflow-hidden border">
                    {aboutImagePreview ? (
                      <img
                        src={aboutImagePreview}
                        alt="Über uns Hero"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>

                  {/* Upload Controls */}
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleAboutImageChange}
                        className="max-w-xs"
                      />
                    </div>
                    {aboutImageFile && (
                      <Button
                        onClick={handleUploadAboutImage}
                        disabled={isUploadingAboutImage}
                        size="sm"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {isUploadingAboutImage ? 'Hochladen...' : 'Bild hochladen'}
                      </Button>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Empfohlen: 800x600px, max. 10MB. JPG, PNG, WebP oder GIF.
                    </p>
                  </div>
                </div>
              </div>

              {/* About Tagline */}
              <div className="space-y-2">
                <Label htmlFor="aboutHeroTagline">Tagline</Label>
                <Input
                  id="aboutHeroTagline"
                  value={aboutForm.aboutHeroTagline}
                  onChange={(e) => setAboutForm(prev => ({ ...prev, aboutHeroTagline: e.target.value }))}
                  placeholder="z.B. Unsere Geschichte"
                />
                <p className="text-xs text-muted-foreground">
                  Kleine Überschrift über dem Haupttitel (optional)
                </p>
              </div>

              {/* About Headline */}
              <div className="space-y-2">
                <Label htmlFor="aboutHeroHeadline">Haupttitel</Label>
                <Input
                  id="aboutHeroHeadline"
                  value={aboutForm.aboutHeroHeadline}
                  onChange={(e) => setAboutForm(prev => ({ ...prev, aboutHeroHeadline: e.target.value }))}
                  placeholder="z.B. Über BeautifyPRO"
                />
              </div>

              {/* About Description */}
              <div className="space-y-2">
                <Label htmlFor="aboutHeroDescription">Beschreibung</Label>
                <Textarea
                  id="aboutHeroDescription"
                  value={aboutForm.aboutHeroDescription}
                  onChange={(e) => setAboutForm(prev => ({ ...prev, aboutHeroDescription: e.target.value }))}
                  placeholder="z.B. Was 2018 als Vision begann, ist heute einer der führenden Friseursalons..."
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  Haupttext im Hero-Bereich der Über-uns-Seite
                </p>
              </div>

              {/* Save Button */}
              <div className="flex justify-end">
                <Button onClick={handleSaveAbout} disabled={isSavingAbout}>
                  <Save className="h-4 w-4 mr-2" />
                  {isSavingAbout ? 'Speichern...' : 'Speichern'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Unsere Werte Section */}
          <Card className="mt-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Unsere Werte</CardTitle>
                  <CardDescription>
                    Werte und Prinzipien, die auf der Über-uns-Seite angezeigt werden.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Aktiv</span>
                    <Switch
                      checked={showValuesSection}
                      onCheckedChange={async (checked) => {
                        setShowValuesSection(checked);
                        const result = await updateAboutPageSettings({ showValuesSection: checked });
                        if (!result.success) {
                          setShowValuesSection(!checked);
                          toast.error('Fehler beim Speichern');
                        }
                      }}
                    />
                  </div>
                  <Button size="sm" onClick={() => handleOpenValueDialog()}>
                    <Plus className="h-4 w-4 mr-1" />
                    Wert hinzufügen
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {valuesList.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Noch keine Werte vorhanden. Fügen Sie den ersten Wert hinzu.
                </p>
              ) : (
                <div className="space-y-3">
                  {valuesList.map((value) => {
                    const IconComponent = getValueIcon(value.icon);
                    return (
                      <div key={value.id} className="flex items-center justify-between py-3 px-4 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                            <IconComponent className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{value.title}</p>
                            <p className="text-sm text-muted-foreground line-clamp-1">{value.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleOpenValueDialog(value)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteValue(value.id)}
                            disabled={deletingValueId === value.id}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Meilensteine Section */}
          <Card className="mt-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Meilensteine</CardTitle>
                  <CardDescription>
                    Wichtige Ereignisse in der Geschichte Ihres Salons.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Aktiv</span>
                    <Switch
                      checked={showMilestonesSection}
                      onCheckedChange={async (checked) => {
                        setShowMilestonesSection(checked);
                        const result = await updateAboutPageSettings({ showMilestonesSection: checked });
                        if (!result.success) {
                          setShowMilestonesSection(!checked);
                          toast.error('Fehler beim Speichern');
                        }
                      }}
                    />
                  </div>
                  <Button size="sm" onClick={() => handleOpenMilestoneDialog()}>
                    <Plus className="h-4 w-4 mr-1" />
                    Meilenstein hinzufügen
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {milestonesList.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Noch keine Meilensteine vorhanden. Fügen Sie den ersten Meilenstein hinzu.
                </p>
              ) : (
                <div className="space-y-3">
                  {[...milestonesList].sort((a, b) => a.year.localeCompare(b.year)).map((milestone) => (
                    <div key={milestone.id} className="flex items-center justify-between py-3 px-4 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
                          {milestone.year}
                        </div>
                        <div>
                          <p className="font-medium">{milestone.title}</p>
                          <p className="text-sm text-muted-foreground line-clamp-1">{milestone.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenMilestoneDialog(milestone)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteMilestone(milestone.id)}
                          disabled={deletingMilestoneId === milestone.id}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Team Page Hero Settings */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Team-Seite Hero-Bereich</CardTitle>
              <CardDescription>
                Passen Sie den &quot;Werde Teil unseres Teams&quot; Bereich auf der Team-Seite an.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Team Hero Image */}
              <div className="space-y-2">
                <Label>Bild</Label>
                <div className="flex items-start gap-6">
                  <div className="relative h-32 w-48 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                    {teamImagePreview ? (
                      <Image
                        src={teamImagePreview}
                        alt="Team Hero"
                        fill
                        className="object-cover"
                        unoptimized={teamImagePreview.includes('localhost') || teamImagePreview.startsWith('data:')}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleTeamImageChange}
                        className="max-w-xs"
                      />
                    </div>
                    {teamImageFile && (
                      <Button
                        onClick={handleUploadTeamImage}
                        disabled={isUploadingTeamImage}
                        size="sm"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {isUploadingTeamImage ? 'Hochladen...' : 'Bild hochladen'}
                      </Button>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Empfohlen: 800x450px, max. 10MB. JPG, PNG, WebP oder GIF.
                    </p>
                  </div>
                </div>
              </div>

              {/* Team Hero Headline */}
              <div className="space-y-2">
                <Label htmlFor="teamHeroHeadline">Haupttitel</Label>
                <Input
                  id="teamHeroHeadline"
                  value={teamForm.teamHeroHeadline}
                  onChange={(e) => setTeamForm(prev => ({ ...prev, teamHeroHeadline: e.target.value }))}
                  placeholder="z.B. Werde Teil unseres Teams"
                />
              </div>

              {/* Team Hero Description */}
              <div className="space-y-2">
                <Label htmlFor="teamHeroDescription">Beschreibung</Label>
                <Textarea
                  id="teamHeroDescription"
                  value={teamForm.teamHeroDescription}
                  onChange={(e) => setTeamForm(prev => ({ ...prev, teamHeroDescription: e.target.value }))}
                  placeholder="z.B. Du bist leidenschaftlicher Friseur und suchst eine neue Herausforderung?"
                  rows={3}
                />
              </div>

              {/* Team Hero Benefits */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Vorteile</Label>
                  <Button variant="outline" size="sm" onClick={handleAddBenefit}>
                    <Plus className="h-4 w-4 mr-1" />
                    Vorteil hinzufügen
                  </Button>
                </div>
                <div className="space-y-2">
                  {teamForm.teamHeroBenefits.map((benefit, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        value={benefit}
                        onChange={(e) => handleUpdateBenefit(index, e.target.value)}
                        placeholder="z.B. Attraktive Arbeitszeiten"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveBenefit(index)}
                        disabled={teamForm.teamHeroBenefits.length <= 1}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Diese Vorteile werden als Liste angezeigt.
                </p>
              </div>

              {/* Save Button */}
              <div className="flex justify-end">
                <Button onClick={handleSaveTeam} disabled={isSavingTeam}>
                  <Save className="h-4 w-4 mr-2" />
                  {isSavingTeam ? 'Speichern...' : 'Speichern'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Value Dialog */}
        <Dialog open={valueDialogOpen} onOpenChange={setValueDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingValue ? 'Wert bearbeiten' : 'Neuer Wert'}</DialogTitle>
              <DialogDescription>
                Fügen Sie einen Wert hinzu, der auf der Über-uns-Seite angezeigt wird.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="valueTitle">Titel</Label>
                <Input
                  id="valueTitle"
                  value={valueForm.title}
                  onChange={(e) => setValueForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="z.B. Qualität"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="valueDescription">Beschreibung</Label>
                <Textarea
                  id="valueDescription"
                  value={valueForm.description}
                  onChange={(e) => setValueForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="z.B. Wir verwenden ausschliesslich hochwertige Produkte..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="valueIcon">Icon</Label>
                <Select value={valueForm.icon} onValueChange={(value) => setValueForm(prev => ({ ...prev, icon: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Icon wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="award">Award (Auszeichnung)</SelectItem>
                    <SelectItem value="heart">Heart (Herz)</SelectItem>
                    <SelectItem value="sparkles">Sparkles (Funken)</SelectItem>
                    <SelectItem value="star">Star (Stern)</SelectItem>
                    <SelectItem value="gem">Gem (Edelstein)</SelectItem>
                    <SelectItem value="target">Target (Ziel)</SelectItem>
                    <SelectItem value="users">Users (Menschen)</SelectItem>
                    <SelectItem value="zap">Zap (Blitz)</SelectItem>
                    <SelectItem value="shield">Shield (Schild)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setValueDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleSaveValue} disabled={isSavingValue}>
                {isSavingValue ? 'Speichern...' : 'Speichern'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Milestone Dialog */}
        <Dialog open={milestoneDialogOpen} onOpenChange={setMilestoneDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingMilestone ? 'Meilenstein bearbeiten' : 'Neuer Meilenstein'}</DialogTitle>
              <DialogDescription>
                Fügen Sie einen Meilenstein zur Timeline auf der Über-uns-Seite hinzu.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="milestoneYear">Jahr</Label>
                <Input
                  id="milestoneYear"
                  value={milestoneForm.year}
                  onChange={(e) => setMilestoneForm(prev => ({ ...prev, year: e.target.value }))}
                  placeholder="z.B. 2018"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="milestoneTitle">Titel</Label>
                <Input
                  id="milestoneTitle"
                  value={milestoneForm.title}
                  onChange={(e) => setMilestoneForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="z.B. Gründung"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="milestoneDescription">Beschreibung</Label>
                <Textarea
                  id="milestoneDescription"
                  value={milestoneForm.description}
                  onChange={(e) => setMilestoneForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="z.B. BeautifyPRO öffnet seine Türen in St. Gallen"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMilestoneDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleSaveMilestone} disabled={isSavingMilestone}>
                {isSavingMilestone ? 'Speichern...' : 'Speichern'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Opening Hours */}
        <TabsContent value="hours">
          <Card>
            <CardHeader>
              <CardTitle>Öffnungszeiten</CardTitle>
              <CardDescription>
                Legen Sie die Öffnungszeiten Ihres Salons fest. Geschlossene Tage werden bei der Online-Buchung nicht angezeigt.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {weekDays.map((day) => {
                  const hours = openingHours.find(h => h.dayOfWeek === day.dayOfWeek);
                  return (
                    <div
                      key={day.dayOfWeek}
                      className={`py-3 px-4 rounded-lg border transition-all ${
                        hours?.isOpen
                          ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
                          : 'bg-muted/30 border-muted'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Switch
                            id={`day-${day.dayOfWeek}-open`}
                            checked={hours?.isOpen ?? false}
                            onCheckedChange={(checked) => {
                              setOpeningHours(prev => prev.map(h =>
                                h.dayOfWeek === day.dayOfWeek
                                  ? { ...h, isOpen: checked }
                                  : h
                              ));
                            }}
                          />
                          <Label htmlFor={`day-${day.dayOfWeek}-open`} className="w-24 font-medium">
                            {day.label}
                          </Label>
                          {!hours?.isOpen && (
                            <Badge variant="secondary" className="text-xs">Geschlossen</Badge>
                          )}
                        </div>
                        <div className={`flex items-center gap-2 transition-opacity ${hours?.isOpen ? 'opacity-100' : 'opacity-50'}`}>
                          <Input
                            type="time"
                            value={hours?.openTime || '09:00'}
                            onChange={(e) => {
                              setOpeningHours(prev => prev.map(h =>
                                h.dayOfWeek === day.dayOfWeek
                                  ? { ...h, openTime: e.target.value }
                                  : h
                              ));
                            }}
                            disabled={!hours?.isOpen}
                            className="w-28"
                          />
                          <span className="text-muted-foreground">bis</span>
                          <Input
                            type="time"
                            value={hours?.closeTime || '18:00'}
                            onChange={(e) => {
                              setOpeningHours(prev => prev.map(h =>
                                h.dayOfWeek === day.dayOfWeek
                                  ? { ...h, closeTime: e.target.value }
                                  : h
                              ));
                            }}
                            disabled={!hours?.isOpen}
                            className="w-28"
                          />
                        </div>
                      </div>
                      {/* Lunch Break Section */}
                      {hours?.isOpen && (
                        <div className="mt-3 pt-3 border-t border-emerald-200 dark:border-emerald-800">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Switch
                                id={`day-${day.dayOfWeek}-lunch`}
                                checked={hours?.hasLunchBreak ?? false}
                                onCheckedChange={(checked) => {
                                  setOpeningHours(prev => prev.map(h =>
                                    h.dayOfWeek === day.dayOfWeek
                                      ? {
                                          ...h,
                                          hasLunchBreak: checked,
                                          lunchStart: checked ? (h.lunchStart || '12:00') : null,
                                          lunchEnd: checked ? (h.lunchEnd || '13:00') : null,
                                        }
                                      : h
                                  ));
                                }}
                              />
                              <Label htmlFor={`day-${day.dayOfWeek}-lunch`} className="text-sm text-muted-foreground">
                                Mittagspause
                              </Label>
                            </div>
                            {hours?.hasLunchBreak && (
                              <div className="flex items-center gap-2">
                                <Input
                                  type="time"
                                  value={hours?.lunchStart || '12:00'}
                                  onChange={(e) => {
                                    setOpeningHours(prev => prev.map(h =>
                                      h.dayOfWeek === day.dayOfWeek
                                        ? { ...h, lunchStart: e.target.value }
                                        : h
                                    ));
                                  }}
                                  className="w-28"
                                />
                                <span className="text-muted-foreground">bis</span>
                                <Input
                                  type="time"
                                  value={hours?.lunchEnd || '13:00'}
                                  onChange={(e) => {
                                    setOpeningHours(prev => prev.map(h =>
                                      h.dayOfWeek === day.dayOfWeek
                                        ? { ...h, lunchEnd: e.target.value }
                                        : h
                                    ));
                                  }}
                                  className="w-28"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-end mt-6">
                <Button onClick={handleSaveOpeningHours} disabled={isSaving}>
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? 'Speichern...' : 'Öffnungszeiten speichern'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Betriebsferien (Salon Closures) */}
          <Card className="mt-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarOff className="h-5 w-5" />
                    Betriebsferien
                  </CardTitle>
                  <CardDescription>
                    Zeiträume, in denen keine Buchungen möglich sind (z.B. Ferien, Renovierung).
                  </CardDescription>
                </div>
                <Button onClick={openAddClosureDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Hinzufügen
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {salonClosuresList.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <p>Keine Betriebsferien eingetragen.</p>
                  <p className="text-sm mt-1">
                    Fügen Sie Zeiträume hinzu, in denen keine Online-Buchungen möglich sein sollen.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Zeitraum</TableHead>
                      <TableHead>Grund</TableHead>
                      <TableHead className="w-[100px]">Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salonClosuresList.map((closure) => (
                      <TableRow key={closure.id}>
                        <TableCell className="font-medium">
                          {formatDateRange(closure.startTime, closure.endTime)}
                        </TableCell>
                        <TableCell>{closure.reason || '-'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditClosureDialog(closure)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setClosureToDelete(closure);
                                setDeleteClosureDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Booking Rules */}
        <TabsContent value="booking">
          <div className="space-y-6">
            {/* Booking Time Rules */}
            <Card>
              <CardHeader>
                <CardTitle>Zeitliche Regeln</CardTitle>
                <CardDescription>
                  Legen Sie fest, wann Kunden Termine buchen können
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {bookingRuleWarnings.length > 0 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Regelkombination prüfen</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc space-y-1 pl-4">
                        {bookingRuleWarnings.map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="minNotice">Mindestvorlaufzeit (Stunden)</Label>
                    <Input
                      id="minNotice"
                      type="number"
                      min="0"
                      max="720"
                      value={bookingRules.minNoticeHours.toString()}
                      onChange={(e) => {
                        const val = e.target.value;
                        setBookingRules({
                          ...bookingRules,
                          minNoticeHours: val === '' ? 0 : parseInt(val, 10),
                        });
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Wie viele Stunden im Voraus muss gebucht werden?
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxAdvance">Max. Vorausbuchung (Tage)</Label>
                    <Input
                      id="maxAdvance"
                      type="number"
                      min="1"
                      max="365"
                      value={bookingRules.maxAdvanceDays.toString()}
                      onChange={(e) => {
                        const val = e.target.value;
                        setBookingRules({
                          ...bookingRules,
                          maxAdvanceDays: val === '' ? 1 : parseInt(val, 10),
                        });
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Wie weit im Voraus können Termine gebucht werden?
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="buffer">Pufferzeit zwischen Terminen (Min.)</Label>
                    <Input
                      id="buffer"
                      type="number"
                      min="0"
                      max="240"
                      step="5"
                      value={bookingRules.bufferMinutes.toString()}
                      onChange={(e) => {
                        const val = e.target.value;
                        setBookingRules({
                          ...bookingRules,
                          bufferMinutes: val === '' ? 0 : parseInt(val, 10),
                        });
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Puffer vor und nach bestehenden Terminen. Er wird nicht doppelt zwischen mehreren Leistungen gezählt.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cancellationDeadline">Kunden-Stornofrist (Stunden)</Label>
                    <Input
                      id="cancellationDeadline"
                      type="number"
                      min="0"
                      max="720"
                      value={bookingRules.cancellationDeadlineHours.toString()}
                      onChange={(e) => {
                        const val = e.target.value;
                        setBookingRules({
                          ...bookingRules,
                          cancellationDeadlineHours: val === '' ? 0 : parseInt(val, 10),
                        });
                      }}
                      disabled={!bookingRules.allowCustomerCancellation}
                    />
                    <p className="text-xs text-muted-foreground">
                      Bis wie viele Stunden vor Terminbeginn Kunden selbst stornieren dürfen.
                    </p>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">Same-Day Buchungen</p>
                      <p className="text-sm text-muted-foreground">
                        Termine am selben Tag erlauben
                      </p>
                    </div>
                    <Switch
                      checked={bookingRules.allowSameDayBooking}
                      onCheckedChange={(checked) =>
                        setBookingRules({ ...bookingRules, allowSameDayBooking: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">Telefonnummer erforderlich</p>
                      <p className="text-sm text-muted-foreground">
                        Kunden müssen eine Telefonnummer angeben
                      </p>
                    </div>
                    <Switch
                      checked={bookingRules.requirePhoneForBooking}
                      onCheckedChange={(checked) =>
                        setBookingRules({ ...bookingRules, requirePhoneForBooking: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">Termine genehmigen</p>
                      <p className="text-sm text-muted-foreground">
                        Neue Termine müssen manuell genehmigt werden
                      </p>
                    </div>
                    <Switch
                      checked={bookingRules.requireAppointmentApproval}
                      onCheckedChange={(checked) =>
                        setBookingRules({ ...bookingRules, requireAppointmentApproval: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">Kunden-Stornierung erlauben</p>
                      <p className="text-sm text-muted-foreground">
                        Kunden können Termine selbst über ihr Konto stornieren
                      </p>
                    </div>
                    <Switch
                      checked={bookingRules.allowCustomerCancellation}
                      onCheckedChange={(checked) =>
                        setBookingRules({ ...bookingRules, allowCustomerCancellation: checked })
                      }
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSave} disabled={isSaving}>
                    <Save className="h-4 w-4 mr-2" />
                    {isSaving ? 'Speichern...' : 'Speichern'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Deposit Settings - only show when shop is enabled */}
            {features.shopEnabled && (
              <Card>
                <CardHeader>
                  <CardTitle>Anzahlungen</CardTitle>
                  <CardDescription>
                    Online-Anzahlungen für Terminbuchungen
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Anzahlungen sind für Termine noch nicht aktivierbar</AlertTitle>
                    <AlertDescription>
                      Der Shop-Zahlungsfluss ist vorhanden, die Terminbuchung blockiert Onlinezahlungen aktuell aber
                      serverseitig. Deshalb bleibt diese Einstellung deaktiviert, bis Stripe/TWINT für Termine,
                      Webhooks, Payment-Status und Refund-Regeln vollständig verbunden sind.
                    </AlertDescription>
                  </Alert>

                  <div className="flex items-center justify-between rounded-lg border p-3 opacity-70">
                    <div>
                      <p className="font-medium">Anzahlung aktivieren</p>
                      <p className="text-sm text-muted-foreground">
                        Wird freigeschaltet, sobald der Termin-Payment-Flow produktionsbereit ist.
                      </p>
                    </div>
                    <Switch checked={false} disabled />
                  </div>

                  <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                    Bereits vorhandene servicebezogene Deposit-Felder werden nicht im öffentlichen Buchungsflow
                    verwendet. Termine werden weiterhin mit Zahlung vor Ort gebucht.
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Services */}
        <TabsContent value="services">
          <div className="space-y-4">
            {serviceStats.issues > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Online buchbare Leistungen ohne Mitarbeiter</AlertTitle>
                <AlertDescription>
                  {serviceStats.issues} aktive Leistung{serviceStats.issues === 1 ? '' : 'en'} ist online buchbar,
                  aber keinem buchbaren Mitarbeiter zugeordnet. Diese Leistungen werden im öffentlichen Buchungsfluss
                  nicht angeboten, bis die Zuordnung unter Team gepflegt ist.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-3 md:grid-cols-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Aktiv</p>
                  <p className="text-2xl font-semibold">{serviceStats.active}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Online buchbar</p>
                  <p className="text-2xl font-semibold">{serviceStats.online}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Nur intern</p>
                  <p className="text-2xl font-semibold">{serviceStats.internal}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Inaktiv</p>
                  <p className="text-2xl font-semibold">{serviceStats.inactive}</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <CardTitle>Leistungen</CardTitle>
                    <CardDescription>
                      Verwalten Sie Preise, Dauer, Buchbarkeit, Kategorien und Varianten.
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" onClick={() => setCategoriesManageOpen(true)}>
                      <FolderOpen className="h-4 w-4 mr-2" />
                      Kategorien
                    </Button>
                    <Button onClick={openAddServiceDialog}>
                      <Plus className="h-4 w-4 mr-2" />
                      Neue Leistung
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={serviceSearch}
                      onChange={(event) => setServiceSearch(event.target.value)}
                      placeholder="Leistungen, Kategorien oder Beschreibung suchen"
                      className="pl-9"
                    />
                  </div>
                  <Select
                    value={serviceStatusFilter}
                    onValueChange={(value) =>
                      setServiceStatusFilter(value as 'all' | 'online' | 'internal' | 'issues')
                    }
                  >
                    <SelectTrigger className="w-full lg:w-[220px]">
                      <SelectValue placeholder="Status filtern" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle sichtbaren</SelectItem>
                      <SelectItem value="online">Online buchbar</SelectItem>
                      <SelectItem value="internal">Nur intern</SelectItem>
                      <SelectItem value="issues">Ohne Mitarbeiter</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex min-h-10 items-center gap-2 rounded-md border px-3">
                    <Switch
                      id="showInactive"
                      checked={showInactive}
                      onCheckedChange={setShowInactive}
                    />
                    <Label htmlFor="showInactive" className="text-sm">
                      Inaktive zeigen
                    </Label>
                  </div>
                </div>
              </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Kategorie</TableHead>
                    <TableHead className="text-center">Dauer</TableHead>
                    <TableHead className="text-right">Preis</TableHead>
                    <TableHead>Mitarbeiter</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredServices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <p className="text-muted-foreground">
                          Keine passenden Leistungen gefunden
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredServices.map((service) => (
                      <TableRow key={service.id} className={!service.isActive ? 'opacity-50' : ''}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{service.name}</p>
                            {service.description && (
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {service.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {service.categoryName && (
                            <Badge variant="secondary">{service.categoryName}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {formatDuration(service.durationMinutes)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {service.priceFrom && 'ab '}
                          {formatCurrency(service.priceCents)}
                        </TableCell>
                        <TableCell>
                          {service.assignedStaffCount > 0 ? (
                            <Badge variant="outline">
                              {service.assignedStaffCount} zugeordnet
                            </Badge>
                          ) : service.isActive && service.isBookableOnline ? (
                            <Badge variant="destructive">
                              Kein Mitarbeiter
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              Keine Zuordnung
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant={service.isActive ? 'default' : 'outline'}>
                              {service.isActive ? 'Aktiv' : 'Inaktiv'}
                            </Badge>
                            {service.isBookableOnline && service.isActive && (
                              <Badge variant="secondary" className="text-xs">
                                Online buchbar
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openVariantsDialog(service.id, service.name)}
                              title="Varianten verwalten"
                              className={service.hasLengthVariants ? 'text-primary' : ''}
                            >
                              <Layers className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditServiceDialog(service)}
                              title="Bearbeiten"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {service.isActive ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openDeleteDialog(service)}
                                title="Deaktivieren"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRestoreService(service)}
                                title="Reaktivieren"
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          </div>

        </TabsContent>

        {/* Payments - only show if shop is enabled */}
        {features.shopEnabled && (
          <TabsContent value="payments">
            <div className="space-y-6">
              {/* Stripe Settings */}
              <Card>
              <CardHeader>
                <CardTitle>Zahlungseinstellungen</CardTitle>
                <CardDescription>
                  Konfigurieren Sie die Zahlungsmethoden
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <CreditCard className="h-8 w-8 text-primary" />
                    <div>
                      <h4 className="font-medium">Stripe</h4>
                      <p className="text-sm text-muted-foreground">
                        Kreditkarten und TWINT akzeptieren
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="default">Verbunden</Badge>
                    <Button variant="outline" size="sm">
                      Konfigurieren
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium">Akzeptierte Zahlungsmethoden</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <span>Kreditkarten (Visa, Mastercard, Amex)</span>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <span>TWINT</span>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <span>Bezahlung vor Ort</span>
                      <Switch defaultChecked />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSave} disabled={isSaving}>
                    <Save className="h-4 w-4 mr-2" />
                    {isSaving ? 'Speichern...' : 'Speichern'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* VAT Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Percent className="h-5 w-5" />
                  Mehrwertsteuer (MwSt)
                </CardTitle>
                <CardDescription>
                  Konfigurieren Sie die MwSt-Einstellungen für Rechnungen
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="vatRate">MwSt-Satz (%)</Label>
                    <Input
                      id="vatRate"
                      type="number"
                      min="0"
                      max="25"
                      step="0.1"
                      value={vatSettings.vatRate}
                      onChange={(e) =>
                        setVatSettings({
                          ...vatSettings,
                          vatRate: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Schweizer Normalsatz: 8.1%
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vatNumber">MwSt-Nummer (UID)</Label>
                    <Input
                      id="vatNumber"
                      placeholder="CHE-123.456.789 MWST"
                      value={vatSettings.vatNumber}
                      onChange={(e) =>
                        setVatSettings({ ...vatSettings, vatNumber: e.target.value })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Ihre Unternehmens-Identifikationsnummer
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">MwSt auf Rechnungen anzeigen</p>
                    <p className="text-sm text-muted-foreground">
                      MwSt-Betrag separat auf Rechnungen ausweisen
                    </p>
                  </div>
                  <Switch
                    checked={vatSettings.showVatOnInvoice}
                    onCheckedChange={(checked) =>
                      setVatSettings({ ...vatSettings, showVatOnInvoice: checked })
                    }
                  />
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSave} disabled={isSaving}>
                    <Save className="h-4 w-4 mr-2" />
                    {isSaving ? 'Speichern...' : 'Speichern'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Shipping Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Versandoptionen
                </CardTitle>
                <CardDescription>
                  Konfigurieren Sie die Versandoptionen für Shop-Bestellungen
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Standard Shipping */}
                <div className="p-4 border rounded-lg space-y-4">
                  <h4 className="font-medium">Standardversand</h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="shippingCost">Preis (CHF)</Label>
                      <Input
                        id="shippingCost"
                        type="number"
                        min="0"
                        step="0.5"
                        value={(shippingSettings.standardShippingCents / 100).toFixed(2)}
                        onChange={(e) =>
                          setShippingSettings({
                            ...shippingSettings,
                            standardShippingCents: Math.round(parseFloat(e.target.value || '0') * 100),
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="standardDays">Lieferzeit</Label>
                      <Input
                        id="standardDays"
                        type="text"
                        placeholder="3-5"
                        value={shippingSettings.standardEstimatedDays || '3-5'}
                        onChange={(e) =>
                          setShippingSettings({
                            ...shippingSettings,
                            standardEstimatedDays: e.target.value,
                          })
                        }
                      />
                      <p className="text-xs text-muted-foreground">z.B. &quot;3-5&quot; Werktage</p>
                    </div>
                  </div>
                </div>

                {/* Express Shipping */}
                <div className="p-4 border rounded-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Expressversand</h4>
                    <Switch
                      checked={shippingSettings.expressEnabled}
                      onCheckedChange={(checked) =>
                        setShippingSettings({ ...shippingSettings, expressEnabled: checked })
                      }
                    />
                  </div>
                  {shippingSettings.expressEnabled && (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="expressCost">Preis (CHF)</Label>
                        <Input
                          id="expressCost"
                          type="number"
                          min="0"
                          step="0.5"
                          value={(shippingSettings.expressShippingCents / 100).toFixed(2)}
                          onChange={(e) =>
                            setShippingSettings({
                              ...shippingSettings,
                              expressShippingCents: Math.round(parseFloat(e.target.value || '0') * 100),
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="expressDays">Lieferzeit</Label>
                        <Input
                          id="expressDays"
                          type="text"
                          placeholder="1-2"
                          value={shippingSettings.expressEstimatedDays || '1-2'}
                          onChange={(e) =>
                            setShippingSettings({
                              ...shippingSettings,
                              expressEstimatedDays: e.target.value,
                            })
                          }
                        />
                        <p className="text-xs text-muted-foreground">z.B. &quot;1-2&quot; Werktage</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Pickup */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Abholung im Salon</p>
                    <p className="text-sm text-muted-foreground">
                      Kunden können Bestellungen kostenlos im Salon abholen
                    </p>
                  </div>
                  <Switch
                    checked={shippingSettings.pickupEnabled !== false}
                    onCheckedChange={(checked) =>
                      setShippingSettings({ ...shippingSettings, pickupEnabled: checked })
                    }
                  />
                </div>

                {/* Free Shipping Threshold */}
                <div className="p-4 border rounded-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Kostenloser Versand</p>
                      <p className="text-sm text-muted-foreground">
                        Versandkostenfrei ab einem bestimmten Bestellwert
                      </p>
                    </div>
                    <Switch
                      checked={shippingSettings.enableFreeShipping}
                      onCheckedChange={(checked) =>
                        setShippingSettings({ ...shippingSettings, enableFreeShipping: checked })
                      }
                    />
                  </div>
                  {shippingSettings.enableFreeShipping && (
                    <div className="space-y-2">
                      <Label htmlFor="freeShippingThreshold">Ab Bestellwert (CHF)</Label>
                      <Input
                        id="freeShippingThreshold"
                        type="number"
                        min="0"
                        step="5"
                        value={(shippingSettings.freeShippingThresholdCents / 100).toFixed(0)}
                        onChange={(e) =>
                          setShippingSettings({
                            ...shippingSettings,
                            freeShippingThresholdCents: Math.round(parseFloat(e.target.value || '0') * 100),
                          })
                        }
                      />
                    </div>
                  )}
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSaveShippingSettings} disabled={isSavingShipping}>
                    <Save className="h-4 w-4 mr-2" />
                    {isSavingShipping ? 'Speichern...' : 'Speichern'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        )}

        {/* Notifications */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>E-Mail-Benachrichtigungen</CardTitle>
              <CardDescription>
                Konfigurieren Sie automatische Benachrichtigungen
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">Terminbestätigung</p>
                    <p className="text-sm text-muted-foreground">
                      E-Mail an Kunden nach Buchung
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">Terminerinnerung</p>
                    <p className="text-sm text-muted-foreground">
                      24 Stunden vor dem Termin
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                {features.shopEnabled && (
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">Bestellbestätigung</p>
                      <p className="text-sm text-muted-foreground">
                        E-Mail nach erfolgreicher Bestellung
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                )}
                {features.shopEnabled && (
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">Versandbestätigung</p>
                      <p className="text-sm text-muted-foreground">
                        E-Mail bei Versand der Bestellung
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={isSaving}>
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? 'Speichern...' : 'Speichern'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Social Media */}
        <TabsContent value="social">
          <Card>
            <CardHeader>
              <CardTitle>Social Media Links</CardTitle>
              <CardDescription>
                Verwalten Sie Ihre Social Media Profile. Aktivierte Links werden auf der Website angezeigt.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {socialLinksForm.map((link) => (
                <div
                  key={link.platform}
                  className="flex items-center gap-4 p-4 border rounded-lg"
                >
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted">
                    {getPlatformIcon(link.platform)}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`social-${link.platform}`} className="font-medium">
                        {getPlatformLabel(link.platform)}
                      </Label>
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`enabled-${link.platform}`} className="text-sm text-muted-foreground">
                          {link.isEnabled ? 'Aktiv' : 'Inaktiv'}
                        </Label>
                        <Switch
                          id={`enabled-${link.platform}`}
                          checked={link.isEnabled}
                          onCheckedChange={(checked) => updateSocialLink(link.platform, 'isEnabled', checked)}
                        />
                      </div>
                    </div>
                    <Input
                      id={`social-${link.platform}`}
                      placeholder={getPlatformPlaceholder(link.platform)}
                      value={link.url}
                      onChange={(e) => updateSocialLink(link.platform, 'url', e.target.value)}
                      className={!link.isEnabled ? 'opacity-50' : ''}
                    />
                  </div>
                </div>
              ))}

              <div className="flex justify-end pt-4">
                <Button onClick={handleSaveSocialLinks} disabled={isSaving}>
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? 'Speichern...' : 'Speichern'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* QR Code Section */}
          <div className="mt-6">
            <QRCodeDownload
              websiteUrl={salonForm.website}
              logoUrl={salon?.logo_url || null}
              salonName={salonForm.name}
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* Service Add/Edit Dialog */}
      <Dialog open={serviceDialogOpen} onOpenChange={setServiceDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingService ? 'Leistung bearbeiten' : 'Neue Leistung'}
            </DialogTitle>
            <DialogDescription>
              {editingService
                ? 'Bearbeiten Sie die Details der Leistung'
                : 'Erstellen Sie eine neue Dienstleistung'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="serviceName">Name *</Label>
              <Input
                id="serviceName"
                value={serviceForm.name}
                onChange={(e) =>
                  setServiceForm({ ...serviceForm, name: e.target.value })
                }
                placeholder="z.B. Herrenschnitt"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="serviceCategory">Kategorie</Label>
              <Select
                value={serviceForm.categoryId || 'none'}
                onValueChange={(value) =>
                  setServiceForm({ ...serviceForm, categoryId: value === 'none' ? '' : value })
                }
              >
                <SelectTrigger id="serviceCategory">
                  <SelectValue placeholder="Kategorie auswählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Keine Kategorie</SelectItem>
                  {categoriesList.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="serviceDuration">Dauer (Minuten) *</Label>
                <Input
                  id="serviceDuration"
                  type="number"
                  min="5"
                  step="5"
                  value={serviceForm.durationMinutes}
                  onChange={(e) =>
                    setServiceForm({
                      ...serviceForm,
                      durationMinutes: parseInt(e.target.value) || 30,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="servicePrice">Preis (CHF) *</Label>
                <Input
                  id="servicePrice"
                  type="text"
                  inputMode="decimal"
                  value={serviceForm.price}
                  onChange={(e) =>
                    setServiceForm({
                      ...serviceForm,
                      price: e.target.value,
                    })
                  }
                  placeholder="0.00"
                  disabled={editingService?.hasLengthVariants}
                  className={editingService?.hasLengthVariants ? 'bg-muted' : ''}
                />
                {editingService?.hasLengthVariants && (
                  <p className="text-xs text-muted-foreground">
                    Der Preis wird automatisch vom günstigsten Variantenpreis übernommen
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="serviceDescription">Beschreibung</Label>
              <Textarea
                id="serviceDescription"
                value={serviceForm.description}
                onChange={(e) =>
                  setServiceForm({ ...serviceForm, description: e.target.value })
                }
                placeholder="Kurze Beschreibung der Leistung..."
                rows={3}
              />
            </div>

            <div className="space-y-4 pt-4 border-t">
              {!editingService?.hasLengthVariants && (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Preis ab</p>
                    <p className="text-xs text-muted-foreground">
                      Zeigt &quot;ab CHF X&quot; statt fester Preis
                    </p>
                  </div>
                  <Switch
                    checked={serviceForm.priceFrom}
                    onCheckedChange={(checked) =>
                      setServiceForm({ ...serviceForm, priceFrom: checked })
                    }
                  />
                </div>
              )}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Online buchbar</p>
                  <p className="text-xs text-muted-foreground">
                    Leistung im Buchungsportal anzeigen
                  </p>
                </div>
                <Switch
                  checked={serviceForm.isBookableOnline}
                  onCheckedChange={(checked) =>
                    setServiceForm({ ...serviceForm, isBookableOnline: checked })
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setServiceDialogOpen(false)}
              disabled={isSaving}
            >
              Abbrechen
            </Button>
            <Button onClick={handleSaveService} disabled={isSaving}>
              {isSaving ? 'Speichern...' : editingService ? 'Aktualisieren' : 'Erstellen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leistung deaktivieren?</AlertDialogTitle>
            <AlertDialogDescription>
              Die Leistung &quot;{serviceToDelete?.name}&quot; wird deaktiviert und nicht
              mehr auf der Website oder im Buchungsportal angezeigt. Sie können
              sie jederzeit wieder aktivieren.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteService}
              disabled={isSaving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSaving ? 'Deaktivieren...' : 'Deaktivieren'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Category Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Kategorie bearbeiten' : 'Neue Kategorie'}
            </DialogTitle>
            <DialogDescription>
              {editingCategory
                ? 'Bearbeiten Sie die Kategorie-Details.'
                : 'Erstellen Sie eine neue Kategorie für Ihre Leistungen.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="categoryName">Name *</Label>
              <Input
                id="categoryName"
                value={categoryForm.name}
                onChange={(e) =>
                  setCategoryForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="z.B. Damen Haarschnitt"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="categoryDescription">Beschreibung</Label>
              <Textarea
                id="categoryDescription"
                value={categoryForm.description}
                onChange={(e) =>
                  setCategoryForm((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Optionale Beschreibung..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCategoryDialogOpen(false)}
              disabled={isSaving}
            >
              Abbrechen
            </Button>
            <Button onClick={handleSaveCategory} disabled={isSaving}>
              {isSaving ? 'Speichern...' : 'Speichern'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Category Confirmation Dialog */}
      <AlertDialog open={deleteCategoryDialogOpen} onOpenChange={setDeleteCategoryDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kategorie löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Die Kategorie &quot;{categoryToDelete?.name}&quot; wird gelöscht.
              Leistungen in dieser Kategorie werden keiner Kategorie mehr zugeordnet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCategory}
              disabled={isSaving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSaving ? 'Löschen...' : 'Löschen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Categories Management Dialog */}
      <Dialog open={categoriesManageOpen} onOpenChange={setCategoriesManageOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Kategorien verwalten</DialogTitle>
            <DialogDescription>
              Erstellen und verwalten Sie Kategorien für Ihre Leistungen.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Add new category button */}
            <Button
              variant="outline"
              className="w-full"
              onClick={openAddCategoryDialog}
            >
              <Plus className="h-4 w-4 mr-2" />
              Neue Kategorie hinzufügen
            </Button>

            {/* Categories list */}
            {categoriesList.length === 0 ? (
              <p className="text-center text-muted-foreground py-6">
                Keine Kategorien vorhanden
              </p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {categoriesList.map((category, index) => (
                  <div
                    key={category.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {/* Order controls */}
                      <div className="flex flex-col">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleMoveCategory(category.id, 'up')}
                          disabled={index === 0}
                          title="Nach oben"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleMoveCategory(category.id, 'down')}
                          disabled={index === categoriesList.length - 1}
                          title="Nach unten"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </div>
                      <div>
                        <p className="font-medium">{category.name}</p>
                        {category.description && (
                          <p className="text-sm text-muted-foreground">
                            {category.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditCategoryDialog(category)}
                        title="Bearbeiten"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteCategoryDialog(category)}
                        title="Löschen"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoriesManageOpen(false)}>
              Schliessen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Variants Management Dialog */}
      <Dialog open={variantsManageOpen} onOpenChange={setVariantsManageOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Varianten für &quot;{variantServiceName}&quot;</DialogTitle>
            <DialogDescription>
              Preisvarianten z.B. nach Haarlänge (kurz, mittel, lang)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Add new variant button */}
            <Button
              variant="outline"
              className="w-full"
              onClick={openAddVariantDialog}
            >
              <Plus className="h-4 w-4 mr-2" />
              Neue Variante hinzufügen
            </Button>

            {/* Variants list */}
            {isLoadingVariants ? (
              <p className="text-center text-muted-foreground py-6">
                Laden...
              </p>
            ) : variants.length === 0 ? (
              <p className="text-center text-muted-foreground py-6">
                Keine Varianten vorhanden. Fügen Sie Varianten hinzu um unterschiedliche Preise anzubieten.
              </p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {variants.map((variant) => (
                  <div
                    key={variant.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{variant.name}</p>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {formatCurrency(variant.priceCents)}
                        </span>
                        {variant.durationMinutes && (
                          <span>{formatDuration(variant.durationMinutes)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditVariantDialog(variant)}
                        title="Bearbeiten"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteVariant(variant)}
                        title="Löschen"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setVariantsManageOpen(false)}>
              Schliessen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Variant Edit/Create Dialog */}
      <Dialog open={variantDialogOpen} onOpenChange={setVariantDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingVariant ? 'Variante bearbeiten' : 'Neue Variante'}
            </DialogTitle>
            <DialogDescription>
              {editingVariant
                ? 'Bearbeiten Sie die Variante.'
                : 'Erstellen Sie eine neue Preisvariante (z.B. kurz, mittel, lang).'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="variantName">Name *</Label>
              <Input
                id="variantName"
                value={variantForm.name}
                onChange={(e) =>
                  setVariantForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="z.B. Kurz, Mittel, Lang"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="variantPrice">Preis (CHF) *</Label>
              <Input
                id="variantPrice"
                type="text"
                inputMode="decimal"
                value={variantForm.price}
                onChange={(e) =>
                  setVariantForm((prev) => ({
                    ...prev,
                    price: e.target.value,
                  }))
                }
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="variantDuration">Dauer (Minuten, optional)</Label>
              <Input
                id="variantDuration"
                type="number"
                min="0"
                value={variantForm.durationMinutes}
                onChange={(e) =>
                  setVariantForm((prev) => ({ ...prev, durationMinutes: e.target.value }))
                }
                placeholder="Standard-Dauer der Leistung verwenden"
              />
              <p className="text-xs text-muted-foreground">
                Leer lassen um die Standard-Dauer der Leistung zu verwenden
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="variantDescription">Beschreibung (optional)</Label>
              <Textarea
                id="variantDescription"
                value={variantForm.description}
                onChange={(e) =>
                  setVariantForm((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Optionale Beschreibung..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setVariantDialogOpen(false)}
              disabled={isSaving}
            >
              Abbrechen
            </Button>
            <Button onClick={handleSaveVariant} disabled={isSaving}>
              {isSaving ? 'Speichern...' : 'Speichern'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Salon Closure Add/Edit Dialog */}
      <Dialog open={closureDialogOpen} onOpenChange={setClosureDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingClosure ? 'Betriebsferien bearbeiten' : 'Betriebsferien hinzufügen'}
            </DialogTitle>
            <DialogDescription>
              Wählen Sie den Zeitraum, in dem keine Buchungen möglich sein sollen.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="closureStartDate">Von *</Label>
                <Input
                  id="closureStartDate"
                  type="date"
                  value={closureForm.startDate}
                  onChange={(e) =>
                    setClosureForm({ ...closureForm, startDate: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="closureEndDate">Bis *</Label>
                <Input
                  id="closureEndDate"
                  type="date"
                  value={closureForm.endDate}
                  onChange={(e) =>
                    setClosureForm({ ...closureForm, endDate: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="closureReason">Grund (optional)</Label>
              <Input
                id="closureReason"
                value={closureForm.reason}
                onChange={(e) =>
                  setClosureForm({ ...closureForm, reason: e.target.value })
                }
                placeholder="z.B. Sommerferien, Renovierung..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setClosureDialogOpen(false)}
              disabled={isSaving}
            >
              Abbrechen
            </Button>
            <Button onClick={handleSaveClosure} disabled={isSaving}>
              {isSaving ? 'Speichern...' : 'Speichern'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Closure Confirmation Dialog */}
      <AlertDialog open={deleteClosureDialogOpen} onOpenChange={setDeleteClosureDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Betriebsferien löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              {closureToDelete && (
                <>
                  Der Zeitraum {formatDateRange(closureToDelete.startTime, closureToDelete.endTime)}
                  {closureToDelete.reason && ` (${closureToDelete.reason})`} wird gelöscht.
                  Buchungen für diesen Zeitraum werden dann wieder möglich sein.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteClosure}
              disabled={isSaving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSaving ? 'Löschen...' : 'Löschen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
