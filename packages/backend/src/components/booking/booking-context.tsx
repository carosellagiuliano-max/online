'use client';

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import type {
  BookableService,
  BookableStaff,
  AvailableSlot,
  SlotReservation,
  ServiceVariant,
} from '@/lib/domain/booking';

// ============================================
// BOOKING STATE
// ============================================

export type BookingStep = 'services' | 'staff' | 'time' | 'confirm';

interface BookingState {
  currentStep: BookingStep;
  salonId: string;
  selectedServices: BookableService[];
  selectedStaff: BookableStaff | null;
  noStaffPreference: boolean;
  selectedSlot: AvailableSlot | null;
  reservation: SlotReservation | null;
  customerInfo: {
    name: string;
    email: string;
    phone: string;
    notes: string;
    acceptTerms: boolean;
  };
  paymentMethod: 'online' | 'at_venue';
  isLoading: boolean;
  error: string | null;
}

const initialState: BookingState = {
  currentStep: 'services',
  salonId: '',
  selectedServices: [],
  selectedStaff: null,
  noStaffPreference: true,
  selectedSlot: null,
  reservation: null,
  customerInfo: {
    name: '',
    email: '',
    phone: '',
    notes: '',
    acceptTerms: false,
  },
  paymentMethod: 'at_venue',
  isLoading: false,
  error: null,
};

// ============================================
// ACTIONS
// ============================================

type BookingAction =
  | { type: 'SET_SALON_ID'; payload: string }
  | { type: 'SET_STEP'; payload: BookingStep }
  | { type: 'RESTORE_STATE'; payload: Partial<BookingState> }
  | { type: 'ADD_SERVICE'; payload: BookableService }
  | { type: 'REMOVE_SERVICE'; payload: string }
  | { type: 'SET_SERVICES'; payload: BookableService[] }
  | { type: 'SET_STAFF'; payload: BookableStaff | null }
  | { type: 'SET_NO_STAFF_PREFERENCE'; payload: boolean }
  | { type: 'SET_SLOT'; payload: AvailableSlot | null }
  | { type: 'SET_RESERVATION'; payload: SlotReservation | null }
  | { type: 'UPDATE_CUSTOMER_INFO'; payload: Partial<BookingState['customerInfo']> }
  | { type: 'SET_PAYMENT_METHOD'; payload: 'online' | 'at_venue' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'RESET' };

function bookingReducer(state: BookingState, action: BookingAction): BookingState {
  switch (action.type) {
    case 'SET_SALON_ID':
      return { ...state, salonId: action.payload };

    case 'SET_STEP':
      return { ...state, currentStep: action.payload, error: null };

    case 'ADD_SERVICE':
      if (state.selectedServices.some((s) => s.id === action.payload.id)) {
        return state;
      }
      return {
        ...state,
        selectedServices: [...state.selectedServices, action.payload],
      };

    case 'REMOVE_SERVICE':
      return {
        ...state,
        selectedServices: state.selectedServices.filter(
          (s) => s.id !== action.payload
        ),
      };

    case 'SET_SERVICES':
      return { ...state, selectedServices: action.payload };

    case 'SET_STAFF':
      return {
        ...state,
        selectedStaff: action.payload,
        noStaffPreference: action.payload === null,
      };

    case 'SET_NO_STAFF_PREFERENCE':
      return {
        ...state,
        noStaffPreference: action.payload,
        selectedStaff: action.payload ? null : state.selectedStaff,
      };

    case 'SET_SLOT':
      return { ...state, selectedSlot: action.payload };

    case 'SET_RESERVATION':
      return { ...state, reservation: action.payload };

    case 'UPDATE_CUSTOMER_INFO':
      return {
        ...state,
        customerInfo: { ...state.customerInfo, ...action.payload },
      };

    case 'SET_PAYMENT_METHOD':
      return { ...state, paymentMethod: action.payload };

    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload };

    case 'RESET':
      return initialState;

    case 'RESTORE_STATE':
      return { ...state, ...action.payload };

    default:
      return state;
  }
}

// ============================================
// CONTEXT
// ============================================

interface BookingContextValue {
  state: BookingState;
  // Navigation
  goToStep: (step: BookingStep) => void;
  goBack: () => void;
  goNext: () => void;
  // Services
  addService: (service: BookableService) => void;
  removeService: (serviceId: string) => void;
  toggleService: (service: BookableService) => void;
  selectServiceWithVariant: (service: BookableService, variant: ServiceVariant) => void;
  // Staff
  selectStaff: (staff: BookableStaff | null) => void;
  setNoPreference: (value: boolean) => void;
  // Slot
  selectSlot: (slot: AvailableSlot | null) => void;
  setReservation: (reservation: SlotReservation | null) => void;
  // Customer
  updateCustomerInfo: (info: Partial<BookingState['customerInfo']>) => void;
  setPaymentMethod: (method: 'online' | 'at_venue') => void;
  // Utility
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
  // Computed
  totalDuration: number;
  totalPrice: number;
  canProceed: boolean;
}

const BookingContext = createContext<BookingContextValue | null>(null);

// ============================================
// PROVIDER
// ============================================

interface BookingProviderProps {
  children: ReactNode;
  salonId: string;
}

const STEP_ORDER: BookingStep[] = ['services', 'staff', 'time', 'confirm'];

const STORAGE_KEY = 'beautifypro_demo_booking_state';

export function BookingProvider({ children, salonId }: BookingProviderProps) {
  const [state, dispatch] = useReducer(bookingReducer, {
    ...initialState,
    salonId,
  });

  // Restore state from sessionStorage on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Only restore if it's for the same salon
        if (parsed.salonId === salonId) {
          // Convert date strings back to Date objects for selectedSlot
          if (parsed.selectedSlot) {
            parsed.selectedSlot.startsAt = new Date(parsed.selectedSlot.startsAt);
            parsed.selectedSlot.endsAt = new Date(parsed.selectedSlot.endsAt);
          }
          dispatch({ type: 'RESTORE_STATE', payload: parsed });
        }
      }
    } catch (err) {
      console.error('[Booking] Error restoring state:', err);
    }
  }, [salonId]);

  // Save state to sessionStorage whenever it changes
  useEffect(() => {
    try {
      // Don't save if we're at the initial state (no services selected)
      if (state.selectedServices.length > 0) {
        const toSave = {
          salonId: state.salonId,
          currentStep: state.currentStep,
          selectedServices: state.selectedServices,
          selectedStaff: state.selectedStaff,
          noStaffPreference: state.noStaffPreference,
          selectedSlot: state.selectedSlot,
          // Don't save paymentMethod - always default to 'at_venue'
          // Don't save customerInfo - will be filled from profile if logged in
        };
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
      }
    } catch (err) {
      console.error('[Booking] Error saving state:', err);
    }
  }, [state]);

  // Navigation
  const goToStep = useCallback((step: BookingStep) => {
    dispatch({ type: 'SET_STEP', payload: step });
  }, []);

  const goBack = useCallback(() => {
    const currentIndex = STEP_ORDER.indexOf(state.currentStep);
    if (currentIndex > 0) {
      dispatch({ type: 'SET_STEP', payload: STEP_ORDER[currentIndex - 1] });
    }
  }, [state.currentStep]);

  const goNext = useCallback(() => {
    const currentIndex = STEP_ORDER.indexOf(state.currentStep);
    if (currentIndex < STEP_ORDER.length - 1) {
      dispatch({ type: 'SET_STEP', payload: STEP_ORDER[currentIndex + 1] });
    }
  }, [state.currentStep]);

  // Services
  const addService = useCallback((service: BookableService) => {
    dispatch({ type: 'ADD_SERVICE', payload: service });
  }, []);

  const removeService = useCallback((serviceId: string) => {
    dispatch({ type: 'REMOVE_SERVICE', payload: serviceId });
  }, []);

  const toggleService = useCallback(
    (service: BookableService) => {
      if (state.selectedServices.some((s) => s.id === service.id)) {
        dispatch({ type: 'REMOVE_SERVICE', payload: service.id });
      } else {
        dispatch({ type: 'ADD_SERVICE', payload: service });
      }
    },
    [state.selectedServices]
  );

  // Select a service with a specific variant
  const selectServiceWithVariant = useCallback(
    (service: BookableService, variant: ServiceVariant) => {
      // Create a modified service with the variant's price and duration
      const serviceWithVariant: BookableService = {
        ...service,
        currentPrice: variant.priceCents,
        durationMinutes: variant.durationMinutes || service.durationMinutes,
        selectedVariantId: variant.id,
      };

      // Remove existing selection of this service (if any) and add with variant
      const filteredServices = state.selectedServices.filter((s) => s.id !== service.id);
      dispatch({ type: 'SET_SERVICES', payload: [...filteredServices, serviceWithVariant] });
    },
    [state.selectedServices]
  );

  // Staff
  const selectStaff = useCallback((staff: BookableStaff | null) => {
    dispatch({ type: 'SET_STAFF', payload: staff });
  }, []);

  const setNoPreference = useCallback((value: boolean) => {
    dispatch({ type: 'SET_NO_STAFF_PREFERENCE', payload: value });
  }, []);

  // Slot
  const selectSlot = useCallback((slot: AvailableSlot | null) => {
    dispatch({ type: 'SET_SLOT', payload: slot });
  }, []);

  const setReservation = useCallback((reservation: SlotReservation | null) => {
    dispatch({ type: 'SET_RESERVATION', payload: reservation });
  }, []);

  // Customer
  const updateCustomerInfo = useCallback(
    (info: Partial<BookingState['customerInfo']>) => {
      dispatch({ type: 'UPDATE_CUSTOMER_INFO', payload: info });
    },
    []
  );

  const setPaymentMethod = useCallback((method: 'online' | 'at_venue') => {
    dispatch({ type: 'SET_PAYMENT_METHOD', payload: method });
  }, []);

  // Utility
  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: loading });
  }, []);

  const setError = useCallback((error: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: error });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
    // Clear saved booking state
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      // Ignore storage errors
    }
  }, []);

  // Computed values
  const totalDuration = state.selectedServices.reduce(
    (sum, s) => sum + s.durationMinutes,
    0
  );

  const totalPrice = state.selectedServices.reduce(
    (sum, s) => sum + s.currentPrice,
    0
  );

  const canProceed = (() => {
    switch (state.currentStep) {
      case 'services':
        return state.selectedServices.length > 0;
      case 'staff':
        return state.selectedStaff !== null || state.noStaffPreference;
      case 'time':
        return state.selectedSlot !== null;
      case 'confirm':
        return (
          state.customerInfo.name.trim() !== '' &&
          state.customerInfo.email.trim() !== '' &&
          state.customerInfo.acceptTerms
        );
      default:
        return false;
    }
  })();

  const value: BookingContextValue = {
    state,
    goToStep,
    goBack,
    goNext,
    addService,
    removeService,
    toggleService,
    selectServiceWithVariant,
    selectStaff,
    setNoPreference,
    selectSlot,
    setReservation,
    updateCustomerInfo,
    setPaymentMethod,
    setLoading,
    setError,
    reset,
    totalDuration,
    totalPrice,
    canProceed,
  };

  return (
    <BookingContext.Provider value={value}>{children}</BookingContext.Provider>
  );
}

// ============================================
// HOOK
// ============================================

export function useBooking() {
  const context = useContext(BookingContext);
  if (!context) {
    throw new Error('useBooking must be used within a BookingProvider');
  }
  return context;
}
