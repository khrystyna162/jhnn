import React from 'react';
import { useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useAuthStore } from '@/store/authStore';

export const useApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { clearAuth } = useAuthStore();

  const handleError = useCallback(
    (err: unknown) => {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);

      // If 401 Unauthorized, clear auth and redirect to login
      if (err instanceof Error && err.message.includes('401')) {
        clearAuth();
        router.push('/login');
      }
    },
    [clearAuth, router],
  );

  return { loading, error, setLoading, setError, handleError };
};

export const useAsync = <T,>(
  asyncFunction: () => Promise<T>,
  immediate = true,
) => {
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(async () => {
    setStatus('pending');
    setData(null);
    setError(null);

    try {
      const response = await asyncFunction();
      setData(response);
      setStatus('success');
      return response;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setStatus('error');
      throw err;
    }
  }, [asyncFunction]);

  const retry = useCallback(() => execute(), [execute]);

  return { execute, retry, status, data, error };
};

export const useLocalStorage = <T,>(key: string, initialValue: T) => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch {}

    return initialValue;
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch {}
  };

  const removeValue = () => {
    try {
      setStoredValue(initialValue);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
      }
    } catch {}
  };

  return [storedValue, setValue, removeValue] as const;
};

export const useDebounce = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
};

export const useIsMounted = () => {
  const [isMounted, setIsMounted] = useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  return isMounted;
};

export const usePagination = (total: number, pageSize: number = 10) => {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canPrevious = currentPage > 1;
  const canNext = currentPage < totalPages;

  React.useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const goToPrevious = useCallback(() => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  }, []);

  const goToNext = useCallback(() => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  }, [totalPages]);

  const goToPage = useCallback((page: number) => {
    const pageNumber = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(pageNumber);
  }, [totalPages]);

  return {
    currentPage,
    totalPages,
    canPrevious,
    canNext,
    goToPrevious,
    goToNext,
    goToPage,
    setCurrentPage,
  };
};

// Re-export new hooks
export { useFormState } from './useFormState';
export type { UseFormStateOptions, UseFormStateReturn } from './useFormState';
export { useDeleteAction } from './useDeleteAction';
export type { UseDeleteActionOptions, UseDeleteActionReturn } from './useDeleteAction';

