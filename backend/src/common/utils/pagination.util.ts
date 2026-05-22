import { type PaginationQuery, type ParsedPagination } from '../types/pagination-query.type';

type PaginationOptions = {
  defaultPage?: number;
  defaultLimit?: number;
  maxLimit?: number;
};

export function parsePaginationQuery(
  query: PaginationQuery | undefined,
  options?: PaginationOptions,
): ParsedPagination {
  const defaultPage = options?.defaultPage ?? 1;
  const defaultLimit = options?.defaultLimit ?? 20;
  const maxLimit = options?.maxLimit ?? 100;

  const pageRaw = Number(query?.page ?? defaultPage);
  const limitRaw = Number(query?.limit ?? defaultLimit);

  const page = Number.isFinite(pageRaw) ? Math.max(1, Math.trunc(pageRaw)) : defaultPage;
  const limit = Number.isFinite(limitRaw)
    ? Math.min(maxLimit, Math.max(1, Math.trunc(limitRaw)))
    : defaultLimit;

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}
