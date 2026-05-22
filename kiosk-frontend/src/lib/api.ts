import axios from 'axios';
import type { PaginatedResponse, ServiceType, Ticket } from '@/types/public';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000/api/v1',
  timeout: 15000,
});

export interface PublicTerminalContext {
  id: string;
  name: string;
  branchId: string;
  branchName?: string;
  status: 'ACTIVE' | 'INACTIVE';
  lastSeenAt?: string;
}

export async function resolveTerminal(apiKey: string): Promise<PublicTerminalContext> {
  const response = await api.get<{ terminal: PublicTerminalContext }>('/public/terminals/resolve', {
    params: { apiKey },
  });
  return response.data.terminal;
}

export async function getBranchName(branchId: string): Promise<string> {
  const response = await api.get<{ branchName: string }>(`/public/display/${branchId}`);
  return response.data.branchName;
}

export async function getPublicServicesForBranch(branchId: string): Promise<PaginatedResponse<ServiceType>> {
  const response = await api.get<PaginatedResponse<ServiceType>>('/public/services/available-for-branch', {
    params: { branchId, page: 1, limit: 100 },
  });
  return response.data;
}

export async function createPublicTicket(payload: {
  branchId: string;
  serviceTypeId: string;
  phone: string;
  clientName?: string;
}): Promise<{ ticket: Ticket }> {
  const response = await api.post<{ ticket: Ticket }>('/public/tickets', payload);
  return response.data;
}
