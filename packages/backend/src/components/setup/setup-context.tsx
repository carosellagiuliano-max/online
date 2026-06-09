'use client';

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  type ReactNode,
} from 'react';
import {
  DEFAULT_OPENING_HOURS,
  type OpeningHourInput,
  type ServiceInput,
  type CategoryInput,
} from '@/lib/setup/schemas';

// ============================================
// SETUP STATE
// ============================================

export type SetupStep = 'admin' | 'salon' | 'hours' | 'services' | 'complete';

interface AdminData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
}

interface SalonData {
  name: string;
  companyName: string;
  slug: string;
  address: string;
  zipCode: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  timezone: string;
  currency: string;
  vatRate: number;
}

interface SetupState {
  currentStep: SetupStep;
  isSubmitting: boolean;
  error: string | null;
  adminUserId: string | null;

  // Step 1: Admin
  admin: AdminData;

  // Step 2: Salon
  salon: SalonData;

  // Step 3: Opening Hours
  openingHours: OpeningHourInput[];

  // Step 4: Services
  categories: CategoryInput[];
}

const initialState: SetupState = {
  currentStep: 'admin',
  isSubmitting: false,
  error: null,
  adminUserId: null,

  admin: {
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
  },

  salon: {
    name: '',
    companyName: '',
    slug: '',
    address: '',
    zipCode: '',
    city: '',
    country: 'Schweiz',
    phone: '',
    email: '',
    timezone: 'Europe/Zurich',
    currency: 'CHF',
    vatRate: 8.1,
  },

  openingHours: DEFAULT_OPENING_HOURS,

  categories: [
    {
      tempId: crypto.randomUUID(),
      name: '',
      services: [
        {
          tempId: crypto.randomUUID(),
          name: '',
          durationMinutes: 30,
          priceCents: 0,
          description: '',
        },
      ],
    },
  ],
};

// ============================================
// ACTIONS
// ============================================

type SetupAction =
  | { type: 'SET_STEP'; payload: SetupStep }
  | { type: 'SET_ADMIN_USER_ID'; payload: string }
  | { type: 'UPDATE_ADMIN'; payload: Partial<AdminData> }
  | { type: 'UPDATE_SALON'; payload: Partial<SalonData> }
  | { type: 'UPDATE_OPENING_HOURS'; payload: OpeningHourInput[] }
  | { type: 'UPDATE_OPENING_HOUR'; payload: { dayOfWeek: number; data: Partial<OpeningHourInput> } }
  | { type: 'ADD_CATEGORY' }
  | { type: 'UPDATE_CATEGORY'; payload: { tempId: string; name: string } }
  | { type: 'REMOVE_CATEGORY'; payload: string }
  | { type: 'ADD_SERVICE'; payload: string }
  | { type: 'UPDATE_SERVICE'; payload: { categoryTempId: string; serviceTempId: string; data: Partial<ServiceInput> } }
  | { type: 'REMOVE_SERVICE'; payload: { categoryTempId: string; serviceTempId: string } }
  | { type: 'SET_SUBMITTING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'RESET' };

function setupReducer(state: SetupState, action: SetupAction): SetupState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, currentStep: action.payload, error: null };

    case 'SET_ADMIN_USER_ID':
      return { ...state, adminUserId: action.payload };

    case 'UPDATE_ADMIN':
      return { ...state, admin: { ...state.admin, ...action.payload } };

    case 'UPDATE_SALON':
      return { ...state, salon: { ...state.salon, ...action.payload } };

    case 'UPDATE_OPENING_HOURS':
      return { ...state, openingHours: action.payload };

    case 'UPDATE_OPENING_HOUR': {
      const newHours = state.openingHours.map((hour) =>
        hour.dayOfWeek === action.payload.dayOfWeek
          ? { ...hour, ...action.payload.data }
          : hour
      );
      return { ...state, openingHours: newHours };
    }

    case 'ADD_CATEGORY':
      return {
        ...state,
        categories: [
          ...state.categories,
          {
            tempId: crypto.randomUUID(),
            name: '',
            services: [
              {
                tempId: crypto.randomUUID(),
                name: '',
                durationMinutes: 30,
                priceCents: 0,
                description: '',
              },
            ],
          },
        ],
      };

    case 'UPDATE_CATEGORY':
      return {
        ...state,
        categories: state.categories.map((cat) =>
          cat.tempId === action.payload.tempId
            ? { ...cat, name: action.payload.name }
            : cat
        ),
      };

    case 'REMOVE_CATEGORY':
      if (state.categories.length <= 1) return state;
      return {
        ...state,
        categories: state.categories.filter((cat) => cat.tempId !== action.payload),
      };

    case 'ADD_SERVICE': {
      const categoryTempId = action.payload;
      return {
        ...state,
        categories: state.categories.map((cat) =>
          cat.tempId === categoryTempId
            ? {
                ...cat,
                services: [
                  ...cat.services,
                  {
                    tempId: crypto.randomUUID(),
                    name: '',
                    durationMinutes: 30,
                    priceCents: 0,
                    description: '',
                  },
                ],
              }
            : cat
        ),
      };
    }

    case 'UPDATE_SERVICE': {
      const { categoryTempId, serviceTempId, data } = action.payload;
      return {
        ...state,
        categories: state.categories.map((cat) =>
          cat.tempId === categoryTempId
            ? {
                ...cat,
                services: cat.services.map((svc) =>
                  svc.tempId === serviceTempId ? { ...svc, ...data } : svc
                ),
              }
            : cat
        ),
      };
    }

    case 'REMOVE_SERVICE': {
      const { categoryTempId, serviceTempId } = action.payload;
      return {
        ...state,
        categories: state.categories.map((cat) =>
          cat.tempId === categoryTempId && cat.services.length > 1
            ? {
                ...cat,
                services: cat.services.filter((svc) => svc.tempId !== serviceTempId),
              }
            : cat
        ),
      };
    }

    case 'SET_SUBMITTING':
      return { ...state, isSubmitting: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

// ============================================
// CONTEXT
// ============================================

interface SetupContextValue {
  state: SetupState;
  // Navigation
  goToStep: (step: SetupStep) => void;
  goBack: () => void;
  goNext: () => void;
  // Admin
  updateAdmin: (data: Partial<AdminData>) => void;
  setAdminUserId: (id: string) => void;
  // Salon
  updateSalon: (data: Partial<SalonData>) => void;
  // Opening Hours
  updateOpeningHours: (hours: OpeningHourInput[]) => void;
  updateOpeningHour: (dayOfWeek: number, data: Partial<OpeningHourInput>) => void;
  // Categories & Services
  addCategory: () => void;
  updateCategory: (tempId: string, name: string) => void;
  removeCategory: (tempId: string) => void;
  addService: (categoryTempId: string) => void;
  updateService: (categoryTempId: string, serviceTempId: string, data: Partial<ServiceInput>) => void;
  removeService: (categoryTempId: string, serviceTempId: string) => void;
  // Utility
  setSubmitting: (submitting: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
  // Computed
  canProceed: boolean;
  currentStepIndex: number;
  totalSteps: number;
}

const SetupContext = createContext<SetupContextValue | null>(null);

// ============================================
// PROVIDER
// ============================================

interface SetupProviderProps {
  children: ReactNode;
}

const STEP_ORDER: SetupStep[] = ['admin', 'salon', 'hours', 'services', 'complete'];

export function SetupProvider({ children }: SetupProviderProps) {
  const [state, dispatch] = useReducer(setupReducer, initialState);

  // Navigation
  const goToStep = useCallback((step: SetupStep) => {
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

  // Admin
  const updateAdmin = useCallback((data: Partial<AdminData>) => {
    dispatch({ type: 'UPDATE_ADMIN', payload: data });
  }, []);

  const setAdminUserId = useCallback((id: string) => {
    dispatch({ type: 'SET_ADMIN_USER_ID', payload: id });
  }, []);

  // Salon
  const updateSalon = useCallback((data: Partial<SalonData>) => {
    dispatch({ type: 'UPDATE_SALON', payload: data });
  }, []);

  // Opening Hours
  const updateOpeningHours = useCallback((hours: OpeningHourInput[]) => {
    dispatch({ type: 'UPDATE_OPENING_HOURS', payload: hours });
  }, []);

  const updateOpeningHour = useCallback((dayOfWeek: number, data: Partial<OpeningHourInput>) => {
    dispatch({ type: 'UPDATE_OPENING_HOUR', payload: { dayOfWeek, data } });
  }, []);

  // Categories & Services
  const addCategory = useCallback(() => {
    dispatch({ type: 'ADD_CATEGORY' });
  }, []);

  const updateCategory = useCallback((tempId: string, name: string) => {
    dispatch({ type: 'UPDATE_CATEGORY', payload: { tempId, name } });
  }, []);

  const removeCategory = useCallback((tempId: string) => {
    dispatch({ type: 'REMOVE_CATEGORY', payload: tempId });
  }, []);

  const addService = useCallback((categoryTempId: string) => {
    dispatch({ type: 'ADD_SERVICE', payload: categoryTempId });
  }, []);

  const updateService = useCallback(
    (categoryTempId: string, serviceTempId: string, data: Partial<ServiceInput>) => {
      dispatch({ type: 'UPDATE_SERVICE', payload: { categoryTempId, serviceTempId, data } });
    },
    []
  );

  const removeService = useCallback((categoryTempId: string, serviceTempId: string) => {
    dispatch({ type: 'REMOVE_SERVICE', payload: { categoryTempId, serviceTempId } });
  }, []);

  // Utility
  const setSubmitting = useCallback((submitting: boolean) => {
    dispatch({ type: 'SET_SUBMITTING', payload: submitting });
  }, []);

  const setError = useCallback((error: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: error });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  // Computed values
  const currentStepIndex = STEP_ORDER.indexOf(state.currentStep);
  const totalSteps = STEP_ORDER.length - 1; // Exclude 'complete' from count

  const canProceed = (() => {
    switch (state.currentStep) {
      case 'admin':
        return (
          state.admin.email.includes('@') &&
          state.admin.password.length >= 8 &&
          state.admin.password === state.admin.confirmPassword &&
          state.admin.firstName.length >= 2 &&
          state.admin.lastName.length >= 2
        );
      case 'salon':
        return (
          state.salon.name.length >= 2 &&
          state.salon.address.length >= 5 &&
          state.salon.zipCode.length >= 4 &&
          state.salon.city.length >= 2 &&
          state.salon.phone.length >= 10 &&
          state.salon.email.includes('@')
        );
      case 'hours':
        // At least one day must be open
        return state.openingHours.some((h) => h.isOpen);
      case 'services':
        // At least one category with name and one service with name
        return state.categories.some(
          (cat) =>
            cat.name.length >= 2 &&
            cat.services.some((svc) => svc.name.length >= 2 && svc.priceCents >= 0)
        );
      case 'complete':
        return true;
      default:
        return false;
    }
  })();

  const value: SetupContextValue = {
    state,
    goToStep,
    goBack,
    goNext,
    updateAdmin,
    setAdminUserId,
    updateSalon,
    updateOpeningHours,
    updateOpeningHour,
    addCategory,
    updateCategory,
    removeCategory,
    addService,
    updateService,
    removeService,
    setSubmitting,
    setError,
    reset,
    canProceed,
    currentStepIndex,
    totalSteps,
  };

  return <SetupContext.Provider value={value}>{children}</SetupContext.Provider>;
}

// ============================================
// HOOK
// ============================================

export function useSetup() {
  const context = useContext(SetupContext);
  if (!context) {
    throw new Error('useSetup must be used within a SetupProvider');
  }
  return context;
}
