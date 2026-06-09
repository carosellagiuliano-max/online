'use client';

import { useCallback } from 'react';
import { useQuery, useListQuery, useMutation } from './use-api';
import { AppointmentService } from '@/lib/api';
import type { AppointmentStatus } from '@/lib/db/types';

// ============================================
// APPOINTMENT HOOKS
// ============================================

/**
 * Hook to fetch a single appointment with relations
 */
export function useAppointment(appointmentId: string | null) {
  return useQuery(
    async () => {
      if (!appointmentId) {
        return { data: null, error: null };
      }
      return AppointmentService.findWithRelations(appointmentId);
    },
    { enabled: !!appointmentId }
  );
}

/**
 * Hook to fetch appointments for a salon
 */
export function useSalonAppointments(
  salonId: string | null,
  options?: {
    startDate?: Date;
    endDate?: Date;
    staffId?: string;
    status?: AppointmentStatus[];
  }
) {
  return useListQuery(
    async (page) => {
      if (!salonId) {
        return { data: [], count: null, error: null };
      }
      return AppointmentService.findBySalon(salonId, {
        ...options,
        page,
        pageSize: 50,
      });
    },
    { enabled: !!salonId }
  );
}

/**
 * Hook to fetch today's appointments
 */
export function useTodayAppointments(salonId: string | null, staffId?: string) {
  return useQuery(
    async () => {
      if (!salonId) {
        return { data: [], count: null, error: null };
      }
      return AppointmentService.findToday(salonId, staffId);
    },
    { enabled: !!salonId }
  );
}

/**
 * Hook to fetch customer's appointments
 */
export function useCustomerAppointments(
  customerId: string | null,
  options?: {
    upcoming?: boolean;
    status?: AppointmentStatus[];
  }
) {
  return useQuery(
    async () => {
      if (!customerId) {
        return { data: [], count: null, error: null };
      }
      return AppointmentService.findByCustomer(customerId, options);
    },
    { enabled: !!customerId }
  );
}

/**
 * Hook to get available time slots
 */
export function useAvailableSlots(
  salonId: string | null,
  date: Date | null,
  durationMinutes: number,
  staffId?: string
) {
  return useQuery(
    async () => {
      if (!salonId || !date) {
        return { data: [], error: null };
      }
      const slots = await AppointmentService.getAvailableSlots(
        salonId,
        date,
        durationMinutes,
        staffId
      );
      return { data: slots, error: null };
    },
    { enabled: !!salonId && !!date && durationMinutes > 0 }
  );
}

/**
 * Hook to create a reservation
 */
export function useCreateReservation() {
  return useMutation(
    async (params: {
      salonId: string;
      customerId: string;
      staffId: string;
      startTime: Date;
      services: Array<{ serviceId: string; variantId?: string }>;
      customerNotes?: string;
    }) => {
      return AppointmentService.createReservation(params);
    }
  );
}

/**
 * Hook to confirm an appointment
 */
export function useConfirmAppointment() {
  return useMutation(
    async (params: { appointmentId: string; confirmedBy?: string }) => {
      return AppointmentService.confirm(params.appointmentId, params.confirmedBy);
    }
  );
}

/**
 * Hook to cancel an appointment
 */
export function useCancelAppointment() {
  return useMutation(
    async (params: { appointmentId: string; cancelledBy: string; reason?: string }) => {
      return AppointmentService.cancel(
        params.appointmentId,
        params.cancelledBy,
        params.reason
      );
    }
  );
}

/**
 * Hook to complete an appointment
 */
export function useCompleteAppointment() {
  return useMutation(
    async (params: { appointmentId: string; completedBy: string }) => {
      return AppointmentService.complete(params.appointmentId, params.completedBy);
    }
  );
}

/**
 * Hook to mark appointment as no-show
 */
export function useMarkNoShow() {
  return useMutation(
    async (params: { appointmentId: string; markedBy: string }) => {
      return AppointmentService.markNoShow(params.appointmentId, params.markedBy);
    }
  );
}

/**
 * Hook to reschedule an appointment
 */
export function useRescheduleAppointment() {
  return useMutation(
    async (params: {
      appointmentId: string;
      newStartTime: Date;
      newStaffId?: string;
    }) => {
      return AppointmentService.reschedule(
        params.appointmentId,
        params.newStartTime,
        params.newStaffId
      );
    }
  );
}
