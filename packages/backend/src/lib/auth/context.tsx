'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '../db/client';
import type { Profile, UserRole, RoleName, Salon } from '../db/types';

// ============================================
// TYPES
// ============================================

interface AuthUser extends User {
  profile?: Profile | null;
  roles?: UserRole[];
  currentSalonId?: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  profile: Profile | null;
  roles: UserRole[];
  currentSalonId: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Role checks
  hasRole: (role: RoleName, salonId?: string) => boolean;
  isAdmin: (salonId?: string) => boolean;
  isStaff: (salonId?: string) => boolean;
  isCustomer: () => boolean;

  // Salon context
  setCurrentSalon: (salonId: string | null) => void;
  getUserSalons: () => Promise<Salon[]>;

  // Auth actions
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (
    email: string,
    password: string,
    metadata?: { first_name?: string; last_name?: string }
  ) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (password: string) => Promise<{ error: Error | null }>;

  // Profile
  refreshProfile: () => Promise<void>;
}

// ============================================
// CONTEXT
// ============================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ============================================
// PROVIDER
// ============================================

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [currentSalonId, setCurrentSalonId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch user profile
  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }

    return data;
  }, []);

  // Fetch user roles
  const fetchRoles = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .eq('profile_id', userId);

    if (error) {
      console.error('Error fetching roles:', error);
      return [];
    }

    return data || [];
  }, []);

  // Load user data (profile + roles)
  const loadUserData = useCallback(
    async (userId: string) => {
      const [profileData, rolesData] = await Promise.all([fetchProfile(userId), fetchRoles(userId)]);

      setProfile(profileData);
      setRoles(rolesData);

      // Set default salon (first one with a role) - only if not already set
      if (rolesData.length > 0) {
        const firstSalonRole = rolesData.find((r) => r.salon_id);
        if (firstSalonRole?.salon_id) {
          setCurrentSalonId((prev) => prev ?? firstSalonRole.salon_id);
        }
      }

      return { profile: profileData, roles: rolesData };
    },
    [fetchProfile, fetchRoles]
  );

  // Initialize auth state
  useEffect(() => {
    let cancelled = false;

    const initAuth = async () => {
      try {
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();

        if (cancelled) return;

        if (currentSession?.user) {
          setSession(currentSession);
          setUser(currentSession.user as AuthUser);
          // Load profile/roles in background - don't block isLoading
          loadUserData(currentSession.user.id).catch((err) => {
            if (!cancelled) console.error('Error loading user data:', err);
          });
        }
      } catch (error) {
        // Ignore AbortError from cleanup during React Strict Mode remount
        if (error && (error as any).name === 'AbortError') return;
        if (!cancelled) {
          console.error('Error initializing auth:', error);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    initAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, newSession: Session | null) => {
      if (cancelled) return;

      setSession(newSession);

      if (newSession?.user) {
        setUser(newSession.user as AuthUser);
        loadUserData(newSession.user.id).catch((err) => {
          if (!cancelled) console.error('Error loading user data:', err);
        });
      } else {
        setUser(null);
        setProfile(null);
        setRoles([]);
        setCurrentSalonId(null);
      }

      setIsLoading(false);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [loadUserData]);

  // ============================================
  // ROLE CHECKS
  // ============================================

  const hasRole = useCallback(
    (role: RoleName, salonId?: string): boolean => {
      const targetSalonId = salonId || currentSalonId;
      return roles.some(
        (r) =>
          r.role_name === role && (r.salon_id === targetSalonId || r.salon_id === null) // Global roles
      );
    },
    [roles, currentSalonId]
  );

  const isAdmin = useCallback(
    (salonId?: string): boolean => {
      return hasRole('admin', salonId);
    },
    [hasRole]
  );

  const isStaff = useCallback(
    (salonId?: string): boolean => {
      const targetSalonId = salonId || currentSalonId;
      return roles.some(
        (r) =>
          ['admin', 'manager', 'mitarbeiter'].includes(r.role_name) &&
          (r.salon_id === targetSalonId || r.salon_id === null)
      );
    },
    [roles, currentSalonId]
  );

  const isCustomer = useCallback((): boolean => {
    return hasRole('kunde');
  }, [hasRole]);

  // ============================================
  // SALON CONTEXT
  // ============================================

  const setCurrentSalon = useCallback((salonId: string | null) => {
    setCurrentSalonId(salonId);
    if (salonId) {
      localStorage.setItem('beautifypro_demo_current_salon', salonId);
    } else {
      localStorage.removeItem('beautifypro_demo_current_salon');
    }
  }, []);

  const getUserSalons = useCallback(async (): Promise<Salon[]> => {
    if (!user) return [];

    const salonIds = roles.filter((r) => r.salon_id).map((r) => r.salon_id as string);

    if (salonIds.length === 0) return [];

    const { data, error } = await supabase.from('salons').select('*').in('id', salonIds);

    if (error) {
      console.error('Error fetching salons:', error);
      return [];
    }

    return data || [];
  }, [user, roles]);

  // ============================================
  // AUTH ACTIONS
  // ============================================

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (
    email: string,
    password: string,
    metadata?: { first_name?: string; last_name?: string }
  ) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
      },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
    setCurrentSalonId(null);
    localStorage.removeItem('beautifypro_demo_current_salon');
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    return { error: error as Error | null };
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error as Error | null };
  };

  // ============================================
  // PROFILE REFRESH
  // ============================================

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await loadUserData(user.id);
    }
  }, [user, loadUserData]);

  // ============================================
  // CONTEXT VALUE
  // ============================================

  const value: AuthContextType = {
    user,
    session,
    profile,
    roles,
    currentSalonId,
    isLoading,
    isAuthenticated: !!user,

    hasRole,
    isAdmin,
    isStaff,
    isCustomer,

    setCurrentSalon,
    getUserSalons,

    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,

    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ============================================
// HOOK
// ============================================

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// ============================================
// GUARD COMPONENT
// ============================================

interface AuthGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
  requiredRole?: RoleName;
  requireStaff?: boolean;
  requireAdmin?: boolean;
}

export function AuthGuard({
  children,
  fallback = null,
  requiredRole,
  requireStaff,
  requireAdmin,
}: AuthGuardProps) {
  const { isAuthenticated, isLoading, hasRole, isStaff, isAdmin } = useAuth();

  if (isLoading) {
    return fallback;
  }

  if (!isAuthenticated) {
    return fallback;
  }

  if (requiredRole && !hasRole(requiredRole)) {
    return fallback;
  }

  if (requireStaff && !isStaff()) {
    return fallback;
  }

  if (requireAdmin && !isAdmin()) {
    return fallback;
  }

  return <>{children}</>;
}
