export type PaginationQuery = {
  page?: number | string;
  limit?: number | string;
};

export type ParsedPagination = {
  page: number;
  limit: number;
  skip: number;
};
