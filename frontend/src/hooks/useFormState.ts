import { useState, useCallback } from 'react';

export interface FormValidator<T> {
  (data: T): Record<string, string>;
}

export interface UseFormStateOptions<T> {
  initialData: T;
  validator?: FormValidator<T>;
}

export interface UseFormStateReturn<T> {
  data: T;
  errors: Record<string, string>;
  isValid: boolean;
  isSubmitting: boolean;
  setData: (data: T) => void;
  setField: (key: keyof T, value: unknown) => void;
  reset: () => void;
  validate: () => boolean;
  clearErrors: () => void;
  setErrors: (errors: Record<string, string>) => void;
  setIsSubmitting: (value: boolean) => void;
}

/**
 * Custom hook for managing form state, validation, and error handling
 * Reduces boilerplate across create/edit forms
 *
 * @example
 * const form = useFormState(
 *   { name: '', email: '' },
 *   (data) => {
 *     const errors: Record<string, string> = {};
 *     if (!data.name.trim()) errors.name = 'Name is required';
 *     if (!data.email.includes('@')) errors.email = 'Invalid email';
 *     return errors;
 *   }
 * );
 *
 * // In render:
 * <input value={form.data.name} onChange={(e) => form.setField('name', e.target.value)} />
 * {form.errors.name && <p>{form.errors.name}</p>}
 * <button disabled={!form.isValid}>Submit</button>
 */
export function useFormState<T extends Record<string, unknown>>({
  initialData,
  validator,
}: UseFormStateOptions<T>): UseFormStateReturn<T> {
  const [data, setData] = useState<T>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = useCallback((): boolean => {
    if (!validator) {
      setErrors({});
      return true;
    }

    const newErrors = validator(data);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [data, validator]);

  const isValid = Object.keys(errors).length === 0;

  const setField = useCallback((key: keyof T, value: unknown) => {
    setData((prev) => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  const reset = useCallback(() => {
    setData(initialData);
    setErrors({});
    setIsSubmitting(false);
  }, [initialData]);

  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  return {
    data,
    errors,
    isValid,
    isSubmitting,
    setData,
    setField,
    reset,
    validate,
    clearErrors,
    setErrors,
    setIsSubmitting,
  };
}
