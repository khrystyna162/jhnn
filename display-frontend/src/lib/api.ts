import axios from 'axios';
import type { PublicDisplayData } from '../types/public';

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

export async function getPublicDisplayData(branchId: string): Promise<PublicDisplayData> {
  const response = await api.get<PublicDisplayData>(`/public/display/${branchId}`);
  return response.data;
}
