export interface ServiceType {
  id: string;
  name: string;
}

export interface Ticket {
  id: string;
  number: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
