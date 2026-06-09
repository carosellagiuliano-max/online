/**
 * BeautifyPRO - Mock Data for Development
 * Use NEXT_PUBLIC_MOCK_MODE=true in .env.local to enable
 */

// ============================================
// MOCK USER & AUTH
// ============================================

export const MOCK_ADMIN_USER = {
  id: 'mock-admin-uuid-001',
  email: 'admin@beautifypro.demo',
  password: 'beauty-admin-demo', // Only for mock mode!
  role: 'admin',
};

export const MOCK_STAFF_USER = {
  id: 'mock-staff-uuid-002',
  email: 'staff@beautifypro.demo',
  password: 'beauty-staff-demo',
  role: 'staff',
};

export const MOCK_CUSTOMER_USER = {
  id: 'mock-customer-uuid-003',
  email: 'kunde@beautifypro.demo',
  password: 'beauty-kunde-demo',
  role: 'kunde',
};

// ============================================
// MOCK SALON
// ============================================

export const MOCK_SALON = {
  id: 'mock-salon-uuid-001',
  name: 'BeautifyPRO Demo Salon',
  slug: 'beauty-demo',
  email: 'info@beautifypro.demo',
  phone: '+41 71 123 45 67',
  address: 'Rorschacherstrasse 152',
  city: 'St. Gallen',
  postal_code: '9000',
  country: 'CH',
  timezone: 'Europe/Zurich',
  currency: 'CHF',
  status: 'active',
  created_at: '2024-01-01T00:00:00Z',
};

// ============================================
// MOCK OPENING HOURS
// ============================================

export const MOCK_OPENING_HOURS = [
  { day_of_week: 0, is_closed: true, open_time: null, close_time: null }, // Sonntag
  { day_of_week: 1, is_closed: false, open_time: '09:00', close_time: '18:00' }, // Montag
  { day_of_week: 2, is_closed: false, open_time: '09:00', close_time: '18:00' }, // Dienstag
  { day_of_week: 3, is_closed: false, open_time: '09:00', close_time: '18:00' }, // Mittwoch
  { day_of_week: 4, is_closed: false, open_time: '09:00', close_time: '20:00' }, // Donnerstag
  { day_of_week: 5, is_closed: false, open_time: '09:00', close_time: '18:00' }, // Freitag
  { day_of_week: 6, is_closed: false, open_time: '09:00', close_time: '14:00' }, // Samstag
];

// ============================================
// MOCK STAFF
// ============================================

export const MOCK_STAFF = [
  {
    id: 'mock-staff-uuid-001',
    user_id: MOCK_ADMIN_USER.id,
    salon_id: MOCK_SALON.id,
    first_name: 'Alex',
    last_name: 'Berger',
    email: 'alex@beautifypro.demo',
    phone: '+41 79 123 45 67',
    role: 'admin',
    is_active: true,
    accepts_bookings: true,
    color: '#D4AF37',
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'mock-staff-uuid-002',
    user_id: MOCK_STAFF_USER.id,
    salon_id: MOCK_SALON.id,
    first_name: 'Sarah',
    last_name: 'Müller',
    email: 'sarah@beautifypro.demo',
    phone: '+41 79 234 56 78',
    role: 'staff',
    is_active: true,
    accepts_bookings: true,
    color: '#8B4513',
    created_at: '2024-02-01T00:00:00Z',
  },
];

// ============================================
// MOCK SERVICE CATEGORIES
// ============================================

export const MOCK_SERVICE_CATEGORIES = [
  { id: 'cat-001', salon_id: MOCK_SALON.id, name: 'Damen', sort_order: 1 },
  { id: 'cat-002', salon_id: MOCK_SALON.id, name: 'Herren', sort_order: 2 },
  { id: 'cat-003', salon_id: MOCK_SALON.id, name: 'Farbe', sort_order: 3 },
  { id: 'cat-004', salon_id: MOCK_SALON.id, name: 'Styling', sort_order: 4 },
];

// ============================================
// MOCK SERVICES
// ============================================

export const MOCK_SERVICES = [
  {
    id: 'svc-001',
    salon_id: MOCK_SALON.id,
    category_id: 'cat-001',
    name: 'Waschen, Schneiden, Föhnen',
    description: 'Klassischer Haarschnitt mit Waschen und Styling',
    duration_minutes: 60,
    price: 85,
    is_active: true,
  },
  {
    id: 'svc-002',
    salon_id: MOCK_SALON.id,
    category_id: 'cat-001',
    name: 'Schneiden & Föhnen',
    description: 'Haarschnitt mit Styling',
    duration_minutes: 45,
    price: 70,
    is_active: true,
  },
  {
    id: 'svc-003',
    salon_id: MOCK_SALON.id,
    category_id: 'cat-002',
    name: 'Herrenschnitt',
    description: 'Klassischer Herrenhaarschnitt',
    duration_minutes: 30,
    price: 45,
    is_active: true,
  },
  {
    id: 'svc-004',
    salon_id: MOCK_SALON.id,
    category_id: 'cat-003',
    name: 'Balayage',
    description: 'Natürliche Farbverläufe',
    duration_minutes: 180,
    price: 250,
    is_active: true,
  },
  {
    id: 'svc-005',
    salon_id: MOCK_SALON.id,
    category_id: 'cat-003',
    name: 'Ansatzfarbe',
    description: 'Nachfärben des Ansatzes',
    duration_minutes: 90,
    price: 95,
    is_active: true,
  },
];

// ============================================
// MOCK CUSTOMERS
// ============================================

export const MOCK_CUSTOMERS = [
  {
    id: 'cust-001',
    salon_id: MOCK_SALON.id,
    profile_id: MOCK_CUSTOMER_USER.id,
    first_name: 'Mia',
    last_name: 'Keller',
    email: MOCK_CUSTOMER_USER.email,
    phone: '+41 79 111 22 33',
    loyalty_points: 250,
    loyalty_tier: 'gold',
    total_spent: 840,
    visit_count: 11,
    created_at: '2024-03-15T10:00:00Z',
  },
  {
    id: 'cust-002',
    salon_id: MOCK_SALON.id,
    first_name: 'Thomas',
    last_name: 'Weber',
    email: 'thomas.weber@example.ch',
    phone: '+41 79 222 33 44',
    loyalty_points: 120,
    loyalty_tier: 'bronze',
    total_spent: 270,
    visit_count: 6,
    created_at: '2024-04-20T14:30:00Z',
  },
  {
    id: 'cust-003',
    salon_id: MOCK_SALON.id,
    first_name: 'Lisa',
    last_name: 'Keller',
    email: 'lisa.keller@example.ch',
    phone: '+41 79 333 44 55',
    loyalty_points: 580,
    loyalty_tier: 'gold',
    total_spent: 1250,
    visit_count: 15,
    created_at: '2024-01-10T09:00:00Z',
  },
];

// ============================================
// MOCK APPOINTMENTS
// ============================================

const today = new Date();
const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1);

export const MOCK_APPOINTMENTS = [
  {
    id: 'apt-001',
    salon_id: MOCK_SALON.id,
    customer_id: 'cust-001',
    staff_id: 'mock-staff-uuid-001',
    service_id: 'svc-001',
    date: today.toISOString().split('T')[0],
    start_time: '10:00',
    end_time: '11:00',
    status: 'confirmed',
    price: 85,
    notes: null,
    customer: MOCK_CUSTOMERS[0],
    staff: MOCK_STAFF[0],
    service: MOCK_SERVICES[0],
  },
  {
    id: 'apt-002',
    salon_id: MOCK_SALON.id,
    customer_id: 'cust-002',
    staff_id: 'mock-staff-uuid-002',
    service_id: 'svc-003',
    date: today.toISOString().split('T')[0],
    start_time: '14:00',
    end_time: '14:30',
    status: 'confirmed',
    price: 45,
    notes: 'Stammkunde',
    customer: MOCK_CUSTOMERS[1],
    staff: MOCK_STAFF[1],
    service: MOCK_SERVICES[2],
  },
  {
    id: 'apt-003',
    salon_id: MOCK_SALON.id,
    customer_id: 'cust-003',
    staff_id: 'mock-staff-uuid-001',
    service_id: 'svc-004',
    date: tomorrow.toISOString().split('T')[0],
    start_time: '09:00',
    end_time: '12:00',
    status: 'confirmed',
    price: 250,
    notes: 'Balayage - wie beim letzten Mal',
    customer: MOCK_CUSTOMERS[2],
    staff: MOCK_STAFF[0],
    service: MOCK_SERVICES[3],
  },
];

// ============================================
// MOCK PRODUCTS
// ============================================

export const MOCK_PRODUCTS = [
  {
    id: 'prod-001',
    salon_id: MOCK_SALON.id,
    name: 'Olaplex No. 3',
    description: 'Hair Perfector Treatment',
    price: 32,
    stock_quantity: 15,
    is_active: true,
    image_url: null,
  },
  {
    id: 'prod-002',
    salon_id: MOCK_SALON.id,
    name: 'Kevin Murphy Hydrate-Me Wash',
    description: 'Feuchtigkeitsspendendes Shampoo',
    price: 38,
    stock_quantity: 8,
    is_active: true,
    image_url: null,
  },
  {
    id: 'prod-003',
    salon_id: MOCK_SALON.id,
    name: 'Dyson Airwrap',
    description: 'Multi-Styler Complete',
    price: 549,
    stock_quantity: 2,
    is_active: true,
    image_url: null,
  },
];

// ============================================
// MOCK ORDERS
// ============================================

export const MOCK_ORDERS = [
  {
    id: 'ord-001',
    salon_id: MOCK_SALON.id,
    customer_id: 'cust-001',
    status: 'completed',
    total: 70,
    created_at: '2024-11-20T15:30:00Z',
    customer: MOCK_CUSTOMERS[0],
    items: [
      { product_id: 'prod-001', quantity: 1, price: 32 },
      { product_id: 'prod-002', quantity: 1, price: 38 },
    ],
  },
  {
    id: 'ord-002',
    salon_id: MOCK_SALON.id,
    customer_id: 'cust-003',
    status: 'pending',
    total: 549,
    created_at: '2024-11-25T10:00:00Z',
    customer: MOCK_CUSTOMERS[2],
    items: [{ product_id: 'prod-003', quantity: 1, price: 549 }],
  },
];

// ============================================
// MOCK ANALYTICS
// ============================================

export const MOCK_ANALYTICS = {
  revenue: {
    today: 380,
    week: 2450,
    month: 12800,
    year: 145000,
  },
  appointments: {
    today: 5,
    week: 32,
    month: 128,
    pending: 3,
    completed: 125,
    cancelled: 4,
  },
  customers: {
    total: 156,
    new_this_month: 12,
    returning: 89,
  },
  products: {
    sold_this_month: 45,
    low_stock: 3,
  },
};

// ============================================
// HELPER: Check if mock mode is enabled
// ============================================

export function isMockMode(): boolean {
  return process.env.NEXT_PUBLIC_MOCK_MODE === 'true';
}
