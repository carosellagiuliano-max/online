// ============================================
// BeautifyPRO HOOKS
// ============================================

// API Query/Mutation Hooks
export { useQuery, useListQuery, useMutation, useOptimisticMutation } from './use-api';

// Appointment Hooks
export {
  useAppointment,
  useSalonAppointments,
  useTodayAppointments,
  useCustomerAppointments,
  useAvailableSlots,
  useCreateReservation,
  useConfirmAppointment,
  useCancelAppointment,
  useCompleteAppointment,
  useMarkNoShow,
  useRescheduleAppointment,
} from './use-appointments';

// Service Hooks
export {
  useServiceCategories,
  useSalonServices,
  useBookableServices,
  useServicesGroupedByCategory,
  useServiceWithVariants,
  useStaffForService,
  useServiceDuration,
  useServicePrice,
} from './use-services';
