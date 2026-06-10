/**
 * ============================================
 * BeautifyPRO - Mock Kalender (Demo-Modus)
 * Demo-Termine relativ zum heutigen Datum plus
 * die in diesem Browser erstellten Termine
 * (localStorage, siehe mock-store.ts).
 * ============================================
 */

import { MOCK_CUSTOMERS, MOCK_SERVICES, MOCK_STAFF } from './mock-data';
import {
  MOCK_STORE_KEYS,
  addToMockCollection,
  mockId,
  readMockCollection,
} from './mock-store';

/** Shape matching AdminCalendarAppointment / the calendar's Appointment type. */
export interface MockCalendarAppointment {
  id: string;
  staff_id: string | null;
  start_time: string;
  end_time: string;
  status: string;
  notes: string | null;
  booking_number: string | null;
  total_cents: number;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer: {
    id: string;
    first_name: string;
    last_name: string;
    email?: string | null;
    phone?: string | null;
  } | null;
  appointment_services: {
    service_id: string;
    service_name: string;
    duration_minutes: number;
    price_cents: number;
  }[];
  staff: {
    id: string;
    display_name: string;
    color: string | null;
  } | null;
  is_approved: boolean;
  approved_at: string | null;
  paid_amount_cents: number;
  paid_at: string | null;
  payment_method: string | null;
}

interface DemoSpec {
  dayOffset: number;
  startTime: string; // HH:mm, local time
  service: (typeof MOCK_SERVICES)[number];
  staff: (typeof MOCK_STAFF)[number];
  customer: (typeof MOCK_CUSTOMERS)[number];
  status: 'confirmed' | 'requested';
  notes: string | null;
  paid: boolean;
}

// 4 Demo-Termine, verteilt über die aktuelle Woche (relativ zu heute)
const DEMO_SPECS: DemoSpec[] = [
  {
    dayOffset: 0,
    startTime: '10:00',
    service: MOCK_SERVICES[0],
    staff: MOCK_STAFF[0],
    customer: MOCK_CUSTOMERS[0],
    status: 'confirmed',
    notes: null,
    paid: true,
  },
  {
    dayOffset: 0,
    startTime: '14:00',
    service: MOCK_SERVICES[2],
    staff: MOCK_STAFF[1],
    customer: MOCK_CUSTOMERS[1],
    status: 'confirmed',
    notes: 'Stammkunde',
    paid: false,
  },
  {
    dayOffset: 1,
    startTime: '09:30',
    service: MOCK_SERVICES[3],
    staff: MOCK_STAFF[0],
    customer: MOCK_CUSTOMERS[2],
    status: 'confirmed',
    notes: 'Balayage - wie beim letzten Mal',
    paid: false,
  },
  {
    dayOffset: 2,
    startTime: '11:00',
    service: MOCK_SERVICES[1],
    staff: MOCK_STAFF[1],
    customer: MOCK_CUSTOMERS[0],
    status: 'requested',
    notes: 'Online-Anfrage',
    paid: false,
  },
];

/** Demo appointments with dates relative to today (built on each call). */
function buildDemoAppointments(): MockCalendarAppointment[] {
  return DEMO_SPECS.map((spec, index) => {
    const start = new Date();
    start.setDate(start.getDate() + spec.dayOffset);
    const [hour, minute] = spec.startTime.split(':').map(Number);
    start.setHours(hour, minute, 0, 0);
    const end = new Date(start.getTime() + spec.service.duration_minutes * 60_000);
    const priceCents = spec.service.price * 100;

    return {
      id: `demo-appt-${index + 1}`,
      staff_id: spec.staff.id,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      status: spec.status,
      notes: spec.notes,
      booking_number: `DEMO-${1001 + index}`,
      total_cents: priceCents,
      customer_name: `${spec.customer.first_name} ${spec.customer.last_name}`,
      customer_email: spec.customer.email,
      customer_phone: spec.customer.phone,
      customer: {
        id: spec.customer.id,
        first_name: spec.customer.first_name,
        last_name: spec.customer.last_name,
        email: spec.customer.email,
        phone: spec.customer.phone,
      },
      appointment_services: [
        {
          service_id: spec.service.id,
          service_name: spec.service.name,
          duration_minutes: spec.service.duration_minutes,
          price_cents: priceCents,
        },
      ],
      staff: {
        id: spec.staff.id,
        display_name: `${spec.staff.first_name} ${spec.staff.last_name}`,
        color: spec.staff.color,
      },
      is_approved: spec.status === 'confirmed',
      approved_at: spec.status === 'confirmed' ? start.toISOString() : null,
      paid_amount_cents: spec.paid ? priceCents : 0,
      paid_at: spec.paid ? start.toISOString() : null,
      payment_method: spec.paid ? 'cash' : null,
    };
  });
}

/**
 * Demo appointments plus browser-created ones, filtered by the
 * requested range and staff selection (like the server action).
 */
export function getMockCalendarAppointments(
  startISO: string,
  endISO: string,
  staffIds: string[]
): MockCalendarAppointment[] {
  const rangeStart = new Date(startISO).getTime();
  const rangeEnd = new Date(endISO).getTime();
  const stored = readMockCollection<MockCalendarAppointment>(MOCK_STORE_KEYS.appointments);

  return [...buildDemoAppointments(), ...stored].filter((appointment) => {
    const start = new Date(appointment.start_time).getTime();
    const end = new Date(appointment.end_time).getTime();
    const inRange = start < rangeEnd && end > rangeStart;
    const matchesStaff =
      staffIds.length === 0 ||
      !appointment.staff ||
      staffIds.includes(appointment.staff.id);
    return inRange && matchesStaff;
  });
}

/** Build a calendar appointment from the create dialog and persist it per browser. */
export function addMockCalendarAppointment(input: {
  staff: { id: string; display_name: string; color: string | null };
  service: { id: string; name: string; duration_minutes: number; price_cents: number };
  startTime: string; // ISO
  endTime: string; // ISO
  notes?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
}): MockCalendarAppointment {
  const appointment: MockCalendarAppointment = {
    id: mockId('appt'),
    staff_id: input.staff.id,
    start_time: input.startTime,
    end_time: input.endTime,
    status: 'confirmed',
    notes: input.notes || null,
    booking_number: `DEMO-${Math.floor(1000 + Math.random() * 9000)}`,
    total_cents: input.service.price_cents,
    customer_name: input.customerName,
    customer_email: input.customerEmail || null,
    customer_phone: input.customerPhone || null,
    customer: null,
    appointment_services: [
      {
        service_id: input.service.id,
        service_name: input.service.name,
        duration_minutes: input.service.duration_minutes,
        price_cents: input.service.price_cents,
      },
    ],
    staff: input.staff,
    is_approved: true,
    approved_at: new Date().toISOString(),
    paid_amount_cents: 0,
    paid_at: null,
    payment_method: null,
  };

  addToMockCollection(MOCK_STORE_KEYS.appointments, appointment);
  return appointment;
}

/** Filter demo customers for the create-appointment search field. */
export function searchMockCustomers(query: string): {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  profiles: { email: string | null; phone: string | null } | null;
}[] {
  const lowered = query.trim().toLowerCase();
  return MOCK_CUSTOMERS.filter(
    (customer) =>
      `${customer.first_name} ${customer.last_name}`.toLowerCase().includes(lowered) ||
      (customer.email || '').toLowerCase().includes(lowered)
  ).map((customer) => ({
    id: customer.id,
    first_name: customer.first_name,
    last_name: customer.last_name,
    email: customer.email,
    phone: customer.phone,
    profiles: null,
  }));
}
