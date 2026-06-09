'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ServiceResult, ServiceListResult, ServiceError } from '@/lib/api';

// ============================================
// TYPES
// ============================================

interface UseQueryOptions<T> {
  enabled?: boolean;
  refetchInterval?: number;
  onSuccess?: (data: T) => void;
  onError?: (error: ServiceError) => void;
}

interface UseQueryResult<T> {
  data: T | null;
  error: ServiceError | null;
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
  refetch: () => Promise<void>;
}

interface UseListQueryResult<T> extends Omit<UseQueryResult<T[]>, 'data'> {
  data: T[];
  count: number | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
}

interface UseMutationOptions<TData, TVariables> {
  onSuccess?: (data: TData, variables: TVariables) => void;
  onError?: (error: ServiceError, variables: TVariables) => void;
  onSettled?: (data: TData | null, error: ServiceError | null, variables: TVariables) => void;
}

interface UseMutationResult<TData, TVariables> {
  mutate: (variables: TVariables) => Promise<TData | null>;
  mutateAsync: (variables: TVariables) => Promise<TData>;
  data: TData | null;
  error: ServiceError | null;
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
  reset: () => void;
}

// ============================================
// USE QUERY HOOK
// For single item queries
// ============================================

export function useQuery<T>(
  queryFn: () => Promise<ServiceResult<T>>,
  options: UseQueryOptions<T> = {}
): UseQueryResult<T> {
  const { enabled = true, refetchInterval, onSuccess, onError } = options;

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ServiceError | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);

  const mountedRef = useRef(true);
  const queryFnRef = useRef(queryFn);
  queryFnRef.current = queryFn;

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await queryFnRef.current();

      if (!mountedRef.current) return;

      if (result.error) {
        setError(result.error);
        setData(null);
        onError?.(result.error);
      } else {
        setData(result.data);
        setError(null);
        if (result.data) {
          onSuccess?.(result.data);
        }
      }
    } catch (err) {
      if (!mountedRef.current) return;
      const serviceError: ServiceError = {
        code: 'FETCH_ERROR',
        message: err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten',
      };
      setError(serviceError);
      onError?.(serviceError);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [onSuccess, onError]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (enabled) {
      fetchData();
    }
  }, [enabled, fetchData]);

  useEffect(() => {
    if (enabled && refetchInterval) {
      const interval = setInterval(fetchData, refetchInterval);
      return () => clearInterval(interval);
    }
  }, [enabled, refetchInterval, fetchData]);

  return {
    data,
    error,
    isLoading,
    isError: !!error,
    isSuccess: !!data && !error,
    refetch: fetchData,
  };
}

// ============================================
// USE LIST QUERY HOOK
// For list queries with pagination
// ============================================

export function useListQuery<T>(
  queryFn: (page: number) => Promise<ServiceListResult<T>>,
  options: UseQueryOptions<T[]> & { pageSize?: number } = {}
): UseListQueryResult<T> {
  const { enabled = true, refetchInterval, onSuccess, onError, pageSize = 20 } = options;

  const [data, setData] = useState<T[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState<ServiceError | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [page, setPage] = useState(1);

  const mountedRef = useRef(true);
  const queryFnRef = useRef(queryFn);
  queryFnRef.current = queryFn;

  const fetchData = useCallback(async (pageNum: number = 1, append: boolean = false) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await queryFnRef.current(pageNum);

      if (!mountedRef.current) return;

      if (result.error) {
        setError(result.error);
        if (!append) setData([]);
        onError?.(result.error);
      } else {
        const newData = append ? [...data, ...result.data] : result.data;
        setData(newData);
        setCount(result.count);
        setError(null);
        onSuccess?.(newData);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      const serviceError: ServiceError = {
        code: 'FETCH_ERROR',
        message: err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten',
      };
      setError(serviceError);
      onError?.(serviceError);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [data, onSuccess, onError]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (enabled) {
      fetchData(1, false);
    }
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (enabled && refetchInterval) {
      const interval = setInterval(() => fetchData(1, false), refetchInterval);
      return () => clearInterval(interval);
    }
  }, [enabled, refetchInterval, fetchData]);

  const loadMore = useCallback(async () => {
    const nextPage = page + 1;
    setPage(nextPage);
    await fetchData(nextPage, true);
  }, [page, fetchData]);

  const refetch = useCallback(async () => {
    setPage(1);
    await fetchData(1, false);
  }, [fetchData]);

  const hasMore = count !== null && data.length < count;

  return {
    data,
    count,
    error,
    isLoading,
    isError: !!error,
    isSuccess: data.length > 0 && !error,
    hasMore,
    loadMore,
    refetch,
  };
}

// ============================================
// USE MUTATION HOOK
// For create/update/delete operations
// ============================================

export function useMutation<TData, TVariables = void>(
  mutationFn: (variables: TVariables) => Promise<ServiceResult<TData>>,
  options: UseMutationOptions<TData, TVariables> = {}
): UseMutationResult<TData, TVariables> {
  const { onSuccess, onError, onSettled } = options;

  const [data, setData] = useState<TData | null>(null);
  const [error, setError] = useState<ServiceError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const mutationFnRef = useRef(mutationFn);
  mutationFnRef.current = mutationFn;

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
  }, []);

  const mutateAsync = useCallback(async (variables: TVariables): Promise<TData> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await mutationFnRef.current(variables);

      if (result.error) {
        setError(result.error);
        setData(null);
        onError?.(result.error, variables);
        onSettled?.(null, result.error, variables);
        throw new Error(result.error.message);
      }

      setData(result.data);
      setError(null);
      if (result.data) {
        onSuccess?.(result.data, variables);
        onSettled?.(result.data, null, variables);
      }
      return result.data as TData;
    } catch (err) {
      if (!error) {
        const serviceError: ServiceError = {
          code: 'MUTATION_ERROR',
          message: err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten',
        };
        setError(serviceError);
        onError?.(serviceError, variables);
        onSettled?.(null, serviceError, variables);
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [onSuccess, onError, onSettled, error]);

  const mutate = useCallback(async (variables: TVariables): Promise<TData | null> => {
    try {
      return await mutateAsync(variables);
    } catch {
      return null;
    }
  }, [mutateAsync]);

  return {
    mutate,
    mutateAsync,
    data,
    error,
    isLoading,
    isError: !!error,
    isSuccess: !!data && !error,
    reset,
  };
}

// ============================================
// OPTIMISTIC UPDATE HELPER
// ============================================

export function useOptimisticMutation<TData, TVariables = void>(
  mutationFn: (variables: TVariables) => Promise<ServiceResult<TData>>,
  options: UseMutationOptions<TData, TVariables> & {
    optimisticUpdate: (variables: TVariables) => TData;
    rollback: (previousData: TData | null) => void;
  }
): UseMutationResult<TData, TVariables> {
  const { optimisticUpdate, rollback, ...mutationOptions } = options;

  const previousDataRef = useRef<TData | null>(null);

  const mutation = useMutation<TData, TVariables>(mutationFn, {
    ...mutationOptions,
    onError: (error, variables) => {
      rollback(previousDataRef.current);
      mutationOptions.onError?.(error, variables);
    },
  });

  const mutate = useCallback(async (variables: TVariables): Promise<TData | null> => {
    previousDataRef.current = mutation.data;
    // Note: Caller should handle setting optimistic data in their state
    return mutation.mutate(variables);
  }, [mutation]);

  const mutateAsync = useCallback(async (variables: TVariables): Promise<TData> => {
    previousDataRef.current = mutation.data;
    return mutation.mutateAsync(variables);
  }, [mutation]);

  return {
    ...mutation,
    mutate,
    mutateAsync,
  };
}
