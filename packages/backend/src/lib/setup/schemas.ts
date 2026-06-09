import { z } from 'zod';

// ============================================
// ADMIN USER SCHEMA
// ============================================

export const adminSchema = z.object({
  email: z.string().email('Ungültige E-Mail-Adresse'),
  password: z.string().min(8, 'Passwort muss mindestens 8 Zeichen lang sein'),
  confirmPassword: z.string(),
  firstName: z.string().min(2, 'Vorname muss mindestens 2 Zeichen lang sein'),
  lastName: z.string().min(2, 'Nachname muss mindestens 2 Zeichen lang sein'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwörter stimmen nicht überein',
  path: ['confirmPassword'],
});

export type AdminInput = z.infer<typeof adminSchema>;

// ============================================
// SALON SCHEMA
// ============================================

export const salonSchema = z.object({
  name: z.string().min(2, 'Salonname erforderlich'),
  companyName: z.string().optional().default(''),
  slug: z.string().optional().default(''),
  address: z.string().min(5, 'Adresse erforderlich'),
  zipCode: z.string().min(4, 'Postleitzahl erforderlich'),
  city: z.string().min(2, 'Stadt erforderlich'),
  country: z.string().default('Schweiz'),
  phone: z.string().min(10, 'Telefonnummer erforderlich'),
  email: z.string().email('Ungültige E-Mail-Adresse'),
  timezone: z.string().default('Europe/Zurich'),
  currency: z.string().default('CHF'),
  vatRate: z.number().min(0).max(100).default(8.1),
});

// Helper to generate slug from name
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export type SalonInput = z.infer<typeof salonSchema>;

// ============================================
// OPENING HOURS SCHEMA
// ============================================

export const openingHourSchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  isOpen: z.boolean(),
  openTime: z.string().regex(/^\d{2}:\d{2}$/, 'Ungültiges Zeitformat (HH:MM)'),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/, 'Ungültiges Zeitformat (HH:MM)'),
  hasLunchBreak: z.boolean().default(false),
  lunchStart: z.string().nullable().optional(),
  lunchEnd: z.string().nullable().optional(),
});

export const openingHoursSchema = z.array(openingHourSchema).length(7);

export type OpeningHourInput = z.infer<typeof openingHourSchema>;
export type OpeningHoursInput = z.infer<typeof openingHoursSchema>;

// ============================================
// SERVICE SCHEMA
// ============================================

export const serviceSchema = z.object({
  tempId: z.string().optional(),
  name: z.string().min(2, 'Servicename erforderlich'),
  durationMinutes: z.number().min(5, 'Mindestens 5 Minuten').max(480, 'Maximal 8 Stunden'),
  priceCents: z.number().min(0, 'Preis muss positiv sein'),
  description: z.string().optional(),
});

export type ServiceInput = z.infer<typeof serviceSchema>;

// ============================================
// CATEGORY SCHEMA
// ============================================

export const categorySchema = z.object({
  tempId: z.string().optional(),
  name: z.string().min(2, 'Kategoriename erforderlich'),
  services: z.array(serviceSchema).min(1, 'Mindestens ein Service erforderlich'),
});

export type CategoryInput = z.infer<typeof categorySchema>;

// ============================================
// SERVICES STEP SCHEMA
// ============================================

export const servicesStepSchema = z.object({
  categories: z.array(categorySchema).min(1, 'Mindestens eine Kategorie erforderlich'),
});

export type ServicesStepInput = z.infer<typeof servicesStepSchema>;

// ============================================
// DEFAULT VALUES
// ============================================

export const DEFAULT_OPENING_HOURS: OpeningHourInput[] = [
  { dayOfWeek: 0, isOpen: false, openTime: '09:00', closeTime: '18:00', hasLunchBreak: false, lunchStart: null, lunchEnd: null }, // Sunday
  { dayOfWeek: 1, isOpen: true, openTime: '09:00', closeTime: '18:00', hasLunchBreak: false, lunchStart: null, lunchEnd: null },  // Monday
  { dayOfWeek: 2, isOpen: true, openTime: '09:00', closeTime: '18:00', hasLunchBreak: false, lunchStart: null, lunchEnd: null },  // Tuesday
  { dayOfWeek: 3, isOpen: true, openTime: '09:00', closeTime: '18:00', hasLunchBreak: false, lunchStart: null, lunchEnd: null },  // Wednesday
  { dayOfWeek: 4, isOpen: true, openTime: '09:00', closeTime: '18:00', hasLunchBreak: false, lunchStart: null, lunchEnd: null },  // Thursday
  { dayOfWeek: 5, isOpen: true, openTime: '09:00', closeTime: '18:00', hasLunchBreak: false, lunchStart: null, lunchEnd: null },  // Friday
  { dayOfWeek: 6, isOpen: true, openTime: '09:00', closeTime: '14:00', hasLunchBreak: false, lunchStart: null, lunchEnd: null },  // Saturday
];

export const DAY_NAMES = [
  'Sonntag',
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
];
