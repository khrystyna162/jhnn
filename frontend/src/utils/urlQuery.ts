import { ParsedUrlQuery } from 'querystring';
import { NextRouter } from 'next/router';

const firstQueryValue = (value: string | string[] | undefined): string | undefined => {
  if (Array.isArray(value)) return value[0];
  return typeof value === 'string' ? value : undefined;
};

export const readQueryParam = (
  query: ParsedUrlQuery,
  key: string,
  fallback = ''
): string => {
  const value = firstQueryValue(query[key]);
  return value ?? fallback;
};

export const readEnumQueryParam = <T extends string>(
  query: ParsedUrlQuery,
  key: string,
  allowed: readonly T[],
  fallback: T
): T => {
  const value = firstQueryValue(query[key]);
  if (!value) return fallback;
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
};

export const readPositiveIntQueryParam = (
  query: ParsedUrlQuery,
  key: string,
  fallback = 1
): number => {
  const raw = firstQueryValue(query[key]);
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  const intValue = Math.trunc(parsed);
  return intValue > 0 ? intValue : fallback;
};

const normalizeQuery = (query: ParsedUrlQuery): Record<string, string> => {
  const result: Record<string, string> = {};

  Object.entries(query).forEach(([key, value]) => {
    const normalized = firstQueryValue(value);
    if (normalized != null) {
      result[key] = normalized;
    }
  });

  return result;
};

const isSameQuery = (
  left: Record<string, string>,
  right: Record<string, string>
): boolean => {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  if (leftKeys.length !== rightKeys.length) return false;

  return leftKeys.every((key) => left[key] === right[key]);
};

export const replaceShallowQuery = async (
  router: NextRouter,
  query: Record<string, string>
): Promise<void> => {
  const current = normalizeQuery(router.query);

  if (isSameQuery(current, query)) return;

  await router.replace(
    {
      pathname: router.pathname,
      query,
    },
    undefined,
    { shallow: true }
  );
};
