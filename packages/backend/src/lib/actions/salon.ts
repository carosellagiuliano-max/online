'use server';

import { createServerClient } from '@/lib/db/client';
import { isMockMode } from '@/lib/mock/mock-auth';
import {
  MOCK_OPENING_HOURS,
  MOCK_SALON,
  MOCK_SERVICE_CATEGORIES,
  MOCK_SERVICES,
  MOCK_SOCIAL_LINKS,
} from '@/lib/mock/mock-data';
import { unstable_cache, revalidateTag, revalidatePath } from 'next/cache';

// ============================================
// SALON DATA SERVER ACTIONS
// ============================================

// Default salon ID for BeautifyPRO (from seed data)
const DEFAULT_SALON_ID = '550e8400-e29b-41d4-a716-446655440001';

export type Salon = {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  zipCode: string | null;
  city: string | null;
  country: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  timezone: string;
  currency: string;
  defaultVatRate: number;
  isActive: boolean;
  logoUrl: string | null;
  // Extended config (from migration 00044)
  tagline: string | null;
  footerDescription: string | null;
  companyName: string | null;
  ownerName: string | null;
  locale: string;
  instagramUrl: string | null;
  facebookUrl: string | null;
  // SEO fields
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string[] | null;
  ogImageUrl: string | null;
  // Homepage hero settings
  heroTagline: string | null;
  heroHeadline: string | null;
  heroHeadlineAccent: string | null;
  heroDescription: string | null;
  heroImageUrl: string | null;
  // About page hero settings
  aboutHeroTagline: string | null;
  aboutHeroHeadline: string | null;
  aboutHeroDescription: string | null;
  aboutHeroImageUrl: string | null;
  // Team page hero settings (Join Us section)
  teamHeroHeadline: string | null;
  teamHeroDescription: string | null;
  teamHeroBenefits: string[] | null;
  teamHeroImageUrl: string | null;
};

export type OpeningHour = {
  dayOfWeek: number;
  dayName: string;
  openTime: string | null;
  closeTime: string | null;
  isOpen: boolean;
  hasLunchBreak: boolean;
  lunchStart: string | null;
  lunchEnd: string | null;
};

export type ServiceCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  services: Service[];
};

export type Service = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number;
  priceFrom: boolean;
  hasLengthVariants: boolean;
  isBookableOnline: boolean;
  sortOrder: number;
  lengthVariants?: ServiceLengthVariant[];
};

export type ServiceLengthVariant = {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number;
  sortOrder: number;
};

export type AddonService = {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number;
  sortOrder: number;
};

// Day names in German (0 = Sunday, matching JavaScript Date convention)
const DAY_NAMES = [
  'Sonntag',
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
];

function createSlug(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function toMockSalon(): Salon {
  return {
    id: MOCK_SALON.id,
    name: MOCK_SALON.name,
    slug: MOCK_SALON.slug,
    address: MOCK_SALON.address,
    zipCode: MOCK_SALON.postal_code,
    city: MOCK_SALON.city,
    country: MOCK_SALON.country,
    phone: MOCK_SALON.phone,
    email: MOCK_SALON.email,
    website: 'https://beautifypro.demo',
    timezone: MOCK_SALON.timezone,
    currency: MOCK_SALON.currency,
    defaultVatRate: 8.1,
    isActive: true,
    logoUrl: null,
    tagline: 'Demo-Salon fuer Beauty, Booking und Shop',
    footerDescription: 'BeautifyPRO Demo zeigt Terminbuchung, Kundenportal, Adminportal und Shop mit sicheren Mockdaten.',
    companyName: 'BeautifyPRO Demo GmbH',
    ownerName: 'Demo Team',
    locale: 'de-CH',
    instagramUrl: 'https://instagram.com/beautifypro.demo',
    facebookUrl: null,
    seoTitle: 'BeautifyPRO Demo Salon',
    seoDescription: 'Praesentationskopie fuer BeautifyPRO mit Buchung, Shop, Adminportal und Kundenportal.',
    seoKeywords: ['beauty', 'demo', 'booking', 'shop'],
    ogImageUrl: null,
    heroTagline: 'BeautifyPRO Demo',
    heroHeadline: 'Professionelle Beauty-Termine einfach buchen',
    heroHeadlineAccent: 'mit Demo-Daten',
    heroDescription: 'Eine vollstaendige Praesentationsumgebung fuer Salon, Admin, Kundenportal, Shop und Analytics.',
    heroImageUrl: null,
    aboutHeroTagline: 'Ueber die Demo',
    aboutHeroHeadline: 'Ein realistischer Salon-Flow zum Vorzeigen',
    aboutHeroDescription: 'Alle Bereiche sind mit Demo-Daten befuellt und ohne echte Zahlungen oder E-Mails nutzbar.',
    aboutHeroImageUrl: null,
    teamHeroHeadline: 'BeautifyPRO Team',
    teamHeroDescription: 'Demo-Mitarbeitende mit Leistungen, Arbeitszeiten und Buchbarkeit.',
    teamHeroBenefits: ['Terminbuchung', 'Shop', 'Adminportal', 'Kundenportal'],
    teamHeroImageUrl: null,
  };
}

function toMockOpeningHours(): OpeningHour[] {
  return MOCK_OPENING_HOURS
    .map((hours) => ({
      dayOfWeek: hours.day_of_week,
      dayName: DAY_NAMES[hours.day_of_week],
      openTime: hours.open_time,
      closeTime: hours.close_time,
      isOpen: !hours.is_closed,
      hasLunchBreak: false,
      lunchStart: null,
      lunchEnd: null,
    }))
    .sort((a, b) => {
      const orderA = a.dayOfWeek === 0 ? 7 : a.dayOfWeek;
      const orderB = b.dayOfWeek === 0 ? 7 : b.dayOfWeek;
      return orderA - orderB;
    });
}

function toMockServicesWithCategories(): ServiceCategory[] {
  return MOCK_SERVICE_CATEGORIES.map((category) => ({
    id: category.id,
    name: category.name,
    slug: createSlug(category.name),
    description: null,
    sortOrder: category.sort_order,
    services: MOCK_SERVICES
      .filter((service) => service.category_id === category.id && service.is_active)
      .map((service, index) => ({
        id: service.id,
        name: service.name,
        slug: createSlug(service.name),
        description: service.description,
        durationMinutes: service.duration_minutes,
        priceCents: Math.round(service.price * 100),
        priceFrom: service.name === 'Balayage',
        hasLengthVariants: false,
        isBookableOnline: true,
        sortOrder: index + 1,
        lengthVariants: [],
      })),
  })).filter((category) => category.services.length > 0);
}

// ============================================
// GET SALON
// ============================================

export const getSalon = unstable_cache(
  async (salonId: string = DEFAULT_SALON_ID): Promise<Salon | null> => {
    if (isMockMode()) {
      return toMockSalon();
    }

    const supabase = createServerClient() as any;

    // Return null during build if Supabase is not available
    if (!supabase) {
      return null;
    }

    const { data, error } = await supabase
      .from('salons')
      .select('*')
      .eq('id', salonId)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      console.error('Error fetching salon:', error);
      return null;
    }

    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      address: data.address,
      zipCode: data.zip_code,
      city: data.city,
      country: data.country,
      phone: data.phone,
      email: data.email,
      website: data.website,
      timezone: data.timezone,
      currency: data.currency,
      defaultVatRate: data.default_vat_rate,
      isActive: data.is_active,
      logoUrl: data.logo_url,
      // Extended config
      tagline: data.tagline,
      footerDescription: data.footer_description,
      companyName: data.company_name,
      ownerName: data.owner_name,
      locale: data.locale || 'de-CH',
      instagramUrl: data.instagram_url,
      facebookUrl: data.facebook_url,
      // SEO fields
      seoTitle: data.seo_title,
      seoDescription: data.seo_description,
      seoKeywords: data.seo_keywords,
      ogImageUrl: data.og_image_url,
      // Hero settings
      heroTagline: data.hero_tagline,
      heroHeadline: data.hero_headline,
      heroHeadlineAccent: data.hero_headline_accent,
      heroDescription: data.hero_description,
      heroImageUrl: data.hero_image_url,
      aboutHeroTagline: data.about_hero_tagline,
      aboutHeroHeadline: data.about_hero_headline,
      aboutHeroDescription: data.about_hero_description,
      aboutHeroImageUrl: data.about_hero_image_url,
      teamHeroHeadline: data.team_hero_headline,
      teamHeroDescription: data.team_hero_description,
      teamHeroBenefits: data.team_hero_benefits,
      teamHeroImageUrl: data.team_hero_image_url,
    };
  },
  ['salon'],
  { revalidate: 3600, tags: ['salon'] }
);

// ============================================
// GET OPENING HOURS
// ============================================

export const getOpeningHours = unstable_cache(
  async (salonId: string = DEFAULT_SALON_ID): Promise<OpeningHour[]> => {
    if (isMockMode()) {
      return toMockOpeningHours();
    }

    const supabase = createServerClient() as any;

    // Return empty array during build if Supabase is not available
    if (!supabase) {
      return [];
    }

    const { data, error } = await supabase
      .from('opening_hours')
      .select('*')
      .eq('salon_id', salonId)
      .order('day_of_week', { ascending: true });

    if (error || !data) {
      console.error('Error fetching opening hours:', error);
      return [];
    }

    // Map and sort: Monday (1) first, Sunday (0) last (German convention)
    return data
      .map((row) => ({
        dayOfWeek: row.day_of_week,
        dayName: DAY_NAMES[row.day_of_week],
        openTime: row.open_time,
        closeTime: row.close_time,
        isOpen: row.is_open,
        hasLunchBreak: row.has_lunch_break || false,
        lunchStart: row.lunch_start,
        lunchEnd: row.lunch_end,
      }))
      .sort((a, b) => {
        // Treat Sunday (0) as 7 for sorting, so it comes last
        const orderA = a.dayOfWeek === 0 ? 7 : a.dayOfWeek;
        const orderB = b.dayOfWeek === 0 ? 7 : b.dayOfWeek;
        return orderA - orderB;
      });
  },
  ['opening-hours'],
  { revalidate: 3600, tags: ['opening-hours'] }
);

// ============================================
// GET SERVICES WITH CATEGORIES
// ============================================

export const getServicesWithCategories = unstable_cache(
  async (salonId: string = DEFAULT_SALON_ID): Promise<ServiceCategory[]> => {
    if (isMockMode()) {
      return toMockServicesWithCategories();
    }

    const supabase = createServerClient() as any;

    // Return empty array during build if Supabase is not available
    if (!supabase) {
      return [];
    }

    // Get categories
    const { data: categories, error: catError } = await supabase
      .from('service_categories')
      .select('id, name, slug, description, sort_order, is_active')
      .eq('salon_id', salonId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (catError || !categories) {
      console.error('Error fetching categories:', catError);
      return [];
    }

    // Get services with length variants
    const { data: services, error: svcError } = await supabase
      .from('services')
      .select(`
        id,
        name,
        slug,
        description,
        category_id,
        duration_minutes,
        price_cents,
        price_from,
        has_length_variants,
        is_bookable_online,
        sort_order,
        service_length_variants (
          id,
          name,
          description,
          duration_minutes,
          price_cents,
          sort_order
        )
      `)
      .eq('salon_id', salonId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (svcError || !services) {
      console.error('Error fetching services:', svcError);
      return [];
    }

    const buildService = (svc: any) => {
      const variants = [...(svc.service_length_variants || [])]
        .sort((a: { sort_order: number | null }, b: { sort_order: number | null }) =>
          (a.sort_order || 0) - (b.sort_order || 0)
        )
        .map((v: any) => ({
          id: v.id,
          name: v.name,
          description: v.description,
          durationMinutes: v.duration_minutes,
          priceCents: v.price_cents,
          sortOrder: v.sort_order || 0,
        }));

      return {
        id: svc.id,
        name: svc.name,
        slug: svc.slug,
        description: svc.description,
        durationMinutes: svc.duration_minutes,
        priceCents: svc.price_cents,
        priceFrom: svc.price_from || false,
        hasLengthVariants: svc.has_length_variants || variants.length > 0,
        isBookableOnline: svc.is_bookable_online !== false,
        sortOrder: svc.sort_order || 0,
        lengthVariants: variants,
      };
    };

    const groupedCategories = categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      sortOrder: cat.sort_order || 0,
      services: services
        .filter((svc) => svc.category_id === cat.id)
        .map(buildService),
    }));

    const uncategorizedServices = services
      .filter((svc) => !svc.category_id || !categories.some((cat) => cat.id === svc.category_id))
      .map(buildService);

    if (uncategorizedServices.length > 0) {
      groupedCategories.push({
        id: 'uncategorized',
        name: 'Weitere Leistungen',
        slug: 'weitere-leistungen',
        description: null,
        sortOrder: Number.MAX_SAFE_INTEGER,
        services: uncategorizedServices,
      });
    }

    return groupedCategories.filter((cat) => cat.services.length > 0);
  },
  ['services-with-categories'],
  { revalidate: 3600, tags: ['services'] }
);

// ============================================
// GET BOOKABLE SERVICES (for booking flow)
// ============================================

export const getBookableServices = unstable_cache(
  async (salonId: string = DEFAULT_SALON_ID): Promise<ServiceCategory[]> => {
    const allServices = await getServicesWithCategories(salonId);

    // Filter to only bookable online services
    return allServices
      .map((cat) => ({
        ...cat,
        services: cat.services.filter((svc) => svc.isBookableOnline),
      }))
      .filter((cat) => cat.services.length > 0);
  },
  ['bookable-services'],
  { revalidate: 3600, tags: ['services'] }
);

// ============================================
// GET ADDON SERVICES
// ============================================

export const getAddonServices = unstable_cache(
  async (salonId: string = DEFAULT_SALON_ID): Promise<AddonService[]> => {
    if (isMockMode()) {
      return [];
    }

    const supabase = createServerClient() as any;

    // Return empty array during build if Supabase is not available
    if (!supabase) {
      return [];
    }

    const { data, error } = await supabase
      .from('addon_services')
      .select('*')
      .eq('salon_id', salonId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error || !data) {
      console.error('Error fetching addon services:', error);
      return [];
    }

    return data.map((addon) => ({
      id: addon.id,
      name: addon.name,
      description: addon.description,
      durationMinutes: addon.duration_minutes,
      priceCents: addon.price_cents,
      sortOrder: addon.sort_order,
    }));
  },
  ['addon-services'],
  { revalidate: 3600, tags: ['services'] }
);

// ============================================
// GET ALL PUBLIC SALON DATA (combined)
// ============================================

export async function getPublicSalonData(salonId: string = DEFAULT_SALON_ID) {
  const [salon, openingHours, services, addons] = await Promise.all([
    getSalon(salonId),
    getOpeningHours(salonId),
    getServicesWithCategories(salonId),
    getAddonServices(salonId),
  ]);

  return {
    salon,
    openingHours,
    services,
    addons,
  };
}

// ============================================
// UPDATE OPENING HOURS
// ============================================

export type UpdateOpeningHoursInput = {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isOpen: boolean;
  hasLunchBreak?: boolean;
  lunchStart?: string | null;
  lunchEnd?: string | null;
}[];

export type UpdateOpeningHoursResult = {
  success: boolean;
  error?: string;
};

export async function updateOpeningHours(
  openingHours: UpdateOpeningHoursInput,
  salonId: string = DEFAULT_SALON_ID
): Promise<UpdateOpeningHoursResult> {
  const supabase = createServerClient() as any;

  if (!supabase) {
    return { success: false, error: 'Database connection not available' };
  }

  try {
    // Update each day's opening hours using upsert
    for (const hours of openingHours) {
      const { error } = await supabase
        .from('opening_hours')
        .upsert(
          {
            salon_id: salonId,
            day_of_week: hours.dayOfWeek,
            open_time: hours.openTime,
            close_time: hours.closeTime,
            is_open: hours.isOpen,
            has_lunch_break: hours.hasLunchBreak || false,
            lunch_start: hours.hasLunchBreak ? hours.lunchStart : null,
            lunch_end: hours.hasLunchBreak ? hours.lunchEnd : null,
          },
          {
            onConflict: 'salon_id,day_of_week',
          }
        );

      if (error) {
        console.error('Error updating opening hours:', error);
        return {
          success: false,
          error: `Fehler beim Speichern: ${error.message}`,
        };
      }
    }

    // Revalidate caches
    revalidateTag('opening-hours', 'max');
    revalidateTag('booking', 'max');

    // Revalidate all pages that display opening hours
    revalidatePath('/', 'layout');

    return { success: true };
  } catch (error) {
    console.error('Error updating opening hours:', error);
    return {
      success: false,
      error: 'Ein unerwarteter Fehler ist aufgetreten.',
    };
  }
}

// ============================================
// UPDATE SALON INFO
// ============================================

export type UpdateSalonInput = {
  name?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  zipCode?: string;
  city?: string;
  description?: string;
  logoUrl?: string | null;
  // Footer settings
  tagline?: string | null;
  footerDescription?: string | null;
  // Homepage hero settings
  heroTagline?: string | null;
  heroHeadline?: string | null;
  heroHeadlineAccent?: string | null;
  heroDescription?: string | null;
  heroImageUrl?: string | null;
  // About page hero settings
  aboutHeroTagline?: string | null;
  aboutHeroHeadline?: string | null;
  aboutHeroDescription?: string | null;
  aboutHeroImageUrl?: string | null;
  // Team page hero settings
  teamHeroHeadline?: string | null;
  teamHeroDescription?: string | null;
  teamHeroBenefits?: string[] | null;
  teamHeroImageUrl?: string | null;
};

export type UpdateSalonResult = {
  success: boolean;
  error?: string;
};

export async function updateSalon(
  input: UpdateSalonInput,
  salonId: string = DEFAULT_SALON_ID
): Promise<UpdateSalonResult> {
  const supabase = createServerClient() as any;

  if (!supabase) {
    return { success: false, error: 'Database connection not available' };
  }

  try {
    // Build update object with only provided fields (exclude undefined)
    const updateData: Record<string, any> = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.email !== undefined) updateData.email = input.email;
    if (input.phone !== undefined) updateData.phone = input.phone;
    if (input.website !== undefined) updateData.website = input.website;
    if (input.address !== undefined) updateData.address = input.address;
    if (input.zipCode !== undefined) updateData.zip_code = input.zipCode;
    if (input.city !== undefined) updateData.city = input.city;
    if (input.logoUrl !== undefined) updateData.logo_url = input.logoUrl;
    // Footer settings
    if (input.tagline !== undefined) updateData.tagline = input.tagline;
    if (input.footerDescription !== undefined) updateData.footer_description = input.footerDescription;
    // Homepage hero settings
    if (input.heroTagline !== undefined) updateData.hero_tagline = input.heroTagline;
    if (input.heroHeadline !== undefined) updateData.hero_headline = input.heroHeadline;
    if (input.heroHeadlineAccent !== undefined) updateData.hero_headline_accent = input.heroHeadlineAccent;
    if (input.heroDescription !== undefined) updateData.hero_description = input.heroDescription;
    if (input.heroImageUrl !== undefined) updateData.hero_image_url = input.heroImageUrl;
    // About page hero settings
    if (input.aboutHeroTagline !== undefined) updateData.about_hero_tagline = input.aboutHeroTagline;
    if (input.aboutHeroHeadline !== undefined) updateData.about_hero_headline = input.aboutHeroHeadline;
    if (input.aboutHeroDescription !== undefined) updateData.about_hero_description = input.aboutHeroDescription;
    if (input.aboutHeroImageUrl !== undefined) updateData.about_hero_image_url = input.aboutHeroImageUrl;
    // Team page hero settings
    if (input.teamHeroHeadline !== undefined) updateData.team_hero_headline = input.teamHeroHeadline;
    if (input.teamHeroDescription !== undefined) updateData.team_hero_description = input.teamHeroDescription;
    if (input.teamHeroBenefits !== undefined) updateData.team_hero_benefits = input.teamHeroBenefits;
    if (input.teamHeroImageUrl !== undefined) updateData.team_hero_image_url = input.teamHeroImageUrl;

    const { error } = await supabase
      .from('salons')
      .update(updateData as any)
      .eq('id', salonId);

    if (error) {
      console.error('Error updating salon:', error);
      return {
        success: false,
        error: `Fehler beim Speichern: ${error.message}`,
      };
    }

    // Revalidate salon cache
    revalidateTag('salon', 'max');

    // Revalidate all pages that display salon info
    revalidatePath('/', 'layout');

    return { success: true };
  } catch (error) {
    console.error('Error updating salon:', error);
    return {
      success: false,
      error: 'Ein unerwarteter Fehler ist aufgetreten.',
    };
  }
}

// ============================================
// SOCIAL LINKS
// ============================================

export type SocialLink = {
  id: string;
  platform: string;
  url: string;
  isEnabled: boolean;
  sortOrder: number;
};

function toMockSocialLinks(enabledOnly = false): SocialLink[] {
  return MOCK_SOCIAL_LINKS
    .filter((link) => !enabledOnly || link.is_enabled)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((link) => ({
      id: link.id,
      platform: link.platform,
      url: link.url,
      isEnabled: link.is_enabled,
      sortOrder: link.sort_order,
    }));
}

export const getSocialLinks = unstable_cache(
  async (salonId: string = DEFAULT_SALON_ID): Promise<SocialLink[]> => {
    if (isMockMode()) {
      return toMockSocialLinks();
    }

    const supabase = createServerClient() as any;

    if (!supabase) {
      return [];
    }

    const { data, error } = await supabase
      .from('social_links')
      .select('*')
      .eq('salon_id', salonId)
      .order('sort_order', { ascending: true });

    if (error || !data) {
      console.error('Error fetching social links:', error);
      return [];
    }

    return data.map((link) => ({
      id: link.id,
      platform: link.platform,
      url: link.url,
      isEnabled: link.is_enabled,
      sortOrder: link.sort_order,
    }));
  },
  ['social-links'],
  { revalidate: 3600, tags: ['social-links'] }
);

// Get only enabled social links (for public pages)
export const getEnabledSocialLinks = unstable_cache(
  async (salonId: string = DEFAULT_SALON_ID): Promise<SocialLink[]> => {
    if (isMockMode()) {
      return toMockSocialLinks(true);
    }

    const supabase = createServerClient() as any;

    if (!supabase) {
      return [];
    }

    const { data, error } = await supabase
      .from('social_links')
      .select('*')
      .eq('salon_id', salonId)
      .eq('is_enabled', true)
      .order('sort_order', { ascending: true });

    if (error || !data) {
      console.error('Error fetching enabled social links:', error);
      return [];
    }

    return data.map((link) => ({
      id: link.id,
      platform: link.platform,
      url: link.url,
      isEnabled: link.is_enabled,
      sortOrder: link.sort_order,
    }));
  },
  ['enabled-social-links'],
  { revalidate: 3600, tags: ['social-links'] }
);

// ============================================
// UPDATE SOCIAL LINKS
// ============================================

export type UpdateSocialLinkInput = {
  id?: string;
  platform: string;
  url: string;
  isEnabled: boolean;
  sortOrder: number;
};

export type UpdateSocialLinksResult = {
  success: boolean;
  error?: string;
};

export async function updateSocialLinks(
  links: UpdateSocialLinkInput[],
  salonId: string = DEFAULT_SALON_ID
): Promise<UpdateSocialLinksResult> {
  if (isMockMode()) {
    return { success: true };
  }

  const supabase = createServerClient() as any;

  if (!supabase) {
    return { success: false, error: 'Database connection not available' };
  }

  try {
    for (const link of links) {
      if (link.id) {
        // Update existing link
        const { error } = await supabase
          .from('social_links')
          .update({
            url: link.url,
            is_enabled: link.isEnabled,
            sort_order: link.sortOrder,
          })
          .eq('id', link.id);

        if (error) {
          console.error('Error updating social link:', error);
          return {
            success: false,
            error: `Fehler beim Speichern: ${error.message}`,
          };
        }
      } else {
        // Insert new link
        const { error } = await supabase
          .from('social_links')
          .upsert(
            {
              salon_id: salonId,
              platform: link.platform,
              url: link.url,
              is_enabled: link.isEnabled,
              sort_order: link.sortOrder,
            },
            {
              onConflict: 'salon_id,platform',
            }
          );

        if (error) {
          console.error('Error inserting social link:', error);
          return {
            success: false,
            error: `Fehler beim Speichern: ${error.message}`,
          };
        }
      }
    }

    // Revalidate caches
    revalidateTag('social-links', 'max');
    revalidatePath('/', 'layout');
    revalidatePath('/kontakt');

    return { success: true };
  } catch (error) {
    console.error('Error updating social links:', error);
    return {
      success: false,
      error: 'Ein unerwarteter Fehler ist aufgetreten.',
    };
  }
}

// ============================================
// ABOUT PAGE VALUES
// ============================================

export type AboutValue = {
  id: string;
  title: string;
  description: string;
  icon: string;
  sortOrder: number;
  isActive: boolean;
};

export const getAboutValues = unstable_cache(
  async (salonId: string = DEFAULT_SALON_ID): Promise<AboutValue[]> => {
    const supabase = createServerClient() as any;

    if (!supabase) {
      return [];
    }

    const { data, error } = await supabase
      .from('about_values')
      .select('*')
      .eq('salon_id', salonId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error || !data) {
      console.error('Error fetching about values:', error);
      return [];
    }

    return data.map((value) => ({
      id: value.id,
      title: value.title,
      description: value.description,
      icon: value.icon,
      sortOrder: value.sort_order,
      isActive: value.is_active,
    }));
  },
  ['about-values'],
  { revalidate: 3600, tags: ['about-values'] }
);

// Get all values including inactive (for admin)
export const getAllAboutValues = unstable_cache(
  async (salonId: string = DEFAULT_SALON_ID): Promise<AboutValue[]> => {
    const supabase = createServerClient() as any;

    if (!supabase) {
      return [];
    }

    const { data, error } = await supabase
      .from('about_values')
      .select('*')
      .eq('salon_id', salonId)
      .order('sort_order', { ascending: true });

    if (error || !data) {
      console.error('Error fetching about values:', error);
      return [];
    }

    return data.map((value) => ({
      id: value.id,
      title: value.title,
      description: value.description,
      icon: value.icon,
      sortOrder: value.sort_order,
      isActive: value.is_active,
    }));
  },
  ['about-values-all'],
  { revalidate: 60, tags: ['about-values'] }
);

export type CreateAboutValueInput = {
  title: string;
  description: string;
  icon: string;
  sortOrder?: number;
};

export async function createAboutValue(
  input: CreateAboutValueInput,
  salonId: string = DEFAULT_SALON_ID
): Promise<{ success: boolean; error?: string; value?: AboutValue }> {
  const supabase = await createServerClient() as any;

  if (!supabase) {
    return { success: false, error: 'Database connection not available' };
  }

  try {
    const { data, error } = await supabase
      .from('about_values')
      .insert({
        salon_id: salonId,
        title: input.title,
        description: input.description,
        icon: input.icon,
        sort_order: input.sortOrder || 0,
      })
      .select('*')
      .single();

    if (error) {
      console.error('Error creating about value:', error);
      return { success: false, error: error.message };
    }

    revalidateTag('about-values', 'max');
    revalidatePath('/ueber-uns');

    return {
      success: true,
      value: {
        id: data.id,
        title: data.title,
        description: data.description,
        icon: data.icon,
        sortOrder: data.sort_order,
        isActive: data.is_active,
      },
    };
  } catch (error) {
    console.error('Unexpected error creating about value:', error);
    return { success: false, error: 'Ein unerwarteter Fehler ist aufgetreten.' };
  }
}

export type UpdateAboutValueInput = {
  id: string;
  title?: string;
  description?: string;
  icon?: string;
  sortOrder?: number;
  isActive?: boolean;
};

export async function updateAboutValue(
  input: UpdateAboutValueInput
): Promise<{ success: boolean; error?: string; value?: AboutValue }> {
  const supabase = await createServerClient() as any;

  if (!supabase) {
    return { success: false, error: 'Database connection not available' };
  }

  try {
    const updateData: Record<string, any> = {};
    if (input.title !== undefined) updateData.title = input.title;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.icon !== undefined) updateData.icon = input.icon;
    if (input.sortOrder !== undefined) updateData.sort_order = input.sortOrder;
    if (input.isActive !== undefined) updateData.is_active = input.isActive;

    const { data, error } = await supabase
      .from('about_values')
      .update(updateData)
      .eq('id', input.id)
      .select('*')
      .single();

    if (error) {
      console.error('Error updating about value:', error);
      return { success: false, error: error.message };
    }

    revalidateTag('about-values', 'max');
    revalidatePath('/ueber-uns');

    return {
      success: true,
      value: {
        id: data.id,
        title: data.title,
        description: data.description,
        icon: data.icon,
        sortOrder: data.sort_order,
        isActive: data.is_active,
      },
    };
  } catch (error) {
    console.error('Unexpected error updating about value:', error);
    return { success: false, error: 'Ein unerwarteter Fehler ist aufgetreten.' };
  }
}

export async function deleteAboutValue(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerClient() as any;

  if (!supabase) {
    return { success: false, error: 'Database connection not available' };
  }

  try {
    const { error } = await supabase
      .from('about_values')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting about value:', error);
      return { success: false, error: error.message };
    }

    revalidateTag('about-values', 'max');
    revalidatePath('/ueber-uns');

    return { success: true };
  } catch (error) {
    console.error('Unexpected error deleting about value:', error);
    return { success: false, error: 'Ein unerwarteter Fehler ist aufgetreten.' };
  }
}

// ============================================
// ABOUT PAGE MILESTONES
// ============================================

export type AboutMilestone = {
  id: string;
  year: string;
  title: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
};

export const getAboutMilestones = unstable_cache(
  async (salonId: string = DEFAULT_SALON_ID): Promise<AboutMilestone[]> => {
    const supabase = createServerClient() as any;

    if (!supabase) {
      return [];
    }

    const { data, error } = await supabase
      .from('about_milestones')
      .select('*')
      .eq('salon_id', salonId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error || !data) {
      console.error('Error fetching about milestones:', error);
      return [];
    }

    return data.map((milestone) => ({
      id: milestone.id,
      year: milestone.year,
      title: milestone.title,
      description: milestone.description,
      sortOrder: milestone.sort_order,
      isActive: milestone.is_active,
    }));
  },
  ['about-milestones'],
  { revalidate: 3600, tags: ['about-milestones'] }
);

// Get all milestones including inactive (for admin)
export const getAllAboutMilestones = unstable_cache(
  async (salonId: string = DEFAULT_SALON_ID): Promise<AboutMilestone[]> => {
    const supabase = createServerClient() as any;

    if (!supabase) {
      return [];
    }

    const { data, error } = await supabase
      .from('about_milestones')
      .select('*')
      .eq('salon_id', salonId)
      .order('sort_order', { ascending: true });

    if (error || !data) {
      console.error('Error fetching about milestones:', error);
      return [];
    }

    return data.map((milestone) => ({
      id: milestone.id,
      year: milestone.year,
      title: milestone.title,
      description: milestone.description,
      sortOrder: milestone.sort_order,
      isActive: milestone.is_active,
    }));
  },
  ['about-milestones-all'],
  { revalidate: 60, tags: ['about-milestones'] }
);

export type CreateAboutMilestoneInput = {
  year: string;
  title: string;
  description: string;
  sortOrder?: number;
};

export async function createAboutMilestone(
  input: CreateAboutMilestoneInput,
  salonId: string = DEFAULT_SALON_ID
): Promise<{ success: boolean; error?: string; milestone?: AboutMilestone }> {
  const supabase = createServerClient() as any;

  if (!supabase) {
    return { success: false, error: 'Database connection not available' };
  }

  try {
    const { data, error } = await supabase
      .from('about_milestones')
      .insert({
        salon_id: salonId,
        year: input.year,
        title: input.title,
        description: input.description,
        sort_order: input.sortOrder || 0,
      })
      .select('*')
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidateTag('about-milestones', 'max');
    revalidatePath('/ueber-uns');

    return {
      success: true,
      milestone: {
        id: data.id,
        year: data.year,
        title: data.title,
        description: data.description,
        sortOrder: data.sort_order,
        isActive: data.is_active,
      },
    };
  } catch (error) {
    return { success: false, error: 'Ein unerwarteter Fehler ist aufgetreten.' };
  }
}

export type UpdateAboutMilestoneInput = {
  id: string;
  year?: string;
  title?: string;
  description?: string;
  sortOrder?: number;
  isActive?: boolean;
};

export async function updateAboutMilestone(
  input: UpdateAboutMilestoneInput
): Promise<{ success: boolean; error?: string; milestone?: AboutMilestone }> {
  const supabase = createServerClient() as any;

  if (!supabase) {
    return { success: false, error: 'Database connection not available' };
  }

  try {
    const updateData: Record<string, any> = {};
    if (input.year !== undefined) updateData.year = input.year;
    if (input.title !== undefined) updateData.title = input.title;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.sortOrder !== undefined) updateData.sort_order = input.sortOrder;
    if (input.isActive !== undefined) updateData.is_active = input.isActive;

    const { data, error } = await supabase
      .from('about_milestones')
      .update(updateData)
      .eq('id', input.id)
      .select('*')
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidateTag('about-milestones', 'max');
    revalidatePath('/ueber-uns');

    return {
      success: true,
      milestone: {
        id: data.id,
        year: data.year,
        title: data.title,
        description: data.description,
        sortOrder: data.sort_order,
        isActive: data.is_active,
      },
    };
  } catch (error) {
    return { success: false, error: 'Ein unerwarteter Fehler ist aufgetreten.' };
  }
}

export async function deleteAboutMilestone(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServerClient() as any;

  if (!supabase) {
    return { success: false, error: 'Database connection not available' };
  }

  try {
    const { error } = await supabase
      .from('about_milestones')
      .delete()
      .eq('id', id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidateTag('about-milestones', 'max');
    revalidatePath('/ueber-uns');

    return { success: true };
  } catch (error) {
    return { success: false, error: 'Ein unerwarteter Fehler ist aufgetreten.' };
  }
}

// ============================================
// ABOUT PAGE SECTION VISIBILITY
// ============================================

export type AboutPageSettings = {
  showValuesSection: boolean;
  showMilestonesSection: boolean;
};

export const getAboutPageSettings = unstable_cache(
  async (salonId: string = DEFAULT_SALON_ID): Promise<AboutPageSettings> => {
    const supabase = createServerClient() as any;

    if (!supabase) {
      return { showValuesSection: true, showMilestonesSection: true };
    }

    const { data, error } = await supabase
      .from('salons')
      .select('show_values_section, show_milestones_section')
      .eq('id', salonId)
      .single();

    if (error || !data) {
      return { showValuesSection: true, showMilestonesSection: true };
    }

    return {
      showValuesSection: data.show_values_section ?? true,
      showMilestonesSection: data.show_milestones_section ?? true,
    };
  },
  ['about-page-settings'],
  { revalidate: 3600, tags: ['salon', 'about-page-settings'] }
);

export async function updateAboutPageSettings(
  settings: Partial<AboutPageSettings>,
  salonId: string = DEFAULT_SALON_ID
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServerClient() as any;

  if (!supabase) {
    return { success: false, error: 'Database connection not available' };
  }

  try {
    const updateData: Record<string, any> = {};
    if (settings.showValuesSection !== undefined) {
      updateData.show_values_section = settings.showValuesSection;
    }
    if (settings.showMilestonesSection !== undefined) {
      updateData.show_milestones_section = settings.showMilestonesSection;
    }

    const { error } = await supabase
      .from('salons')
      .update(updateData)
      .eq('id', salonId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidateTag('salon', 'max');
    revalidateTag('about-page-settings', 'max');
    revalidatePath('/ueber-uns');

    return { success: true };
  } catch (error) {
    return { success: false, error: 'Ein unerwarteter Fehler ist aufgetreten.' };
  }
}
