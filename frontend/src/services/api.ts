import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  LoginRequest,
  LoginResponse,
  RefreshTokenResponse,
  PaginatedResponse,
  AuthUser,
  User,
  Ticket,
  Country,
  City,
  District,
  Branch,
  ServiceType,
  ServiceUsage,
  Workplace,
  NotificationTemplate,
  Notification,
  AuditLog,
  KPISummary,
  DashboardMetrics,
  PublicDisplayData,
  DisplaySettings,
  OperatorShift,
  CurrentOperatorShift,
  NotificationProviderMode,
  SystemSettingsResponse,
  SystemHealth,
  SystemMetrics,
  Permission,
  UserScopeInput,
  UserAccessSnapshot,
  WaitingTimeStats,
  ServiceTimeStats,
  OperatorRating,
  KioskTerminal,
  ScopeLevel,
} from '@/types';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000/api/v1';

class ApiClient {
  private client: AxiosInstance;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private refreshPromise: Promise<void> | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 15000,
    });

    if (typeof window !== 'undefined') {
      this.accessToken = localStorage.getItem('accessToken');
      this.refreshToken = localStorage.getItem('refreshToken');
    }

    // Attach auth header
    this.client.interceptors.request.use(
      (config) => {
        if (this.accessToken) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error),
    );

    // Handle 401 with token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        if (
          error.response?.status === 401 &&
          originalRequest.url !== '/auth/refresh' &&
          this.refreshToken &&
          !originalRequest._retry
        ) {
          originalRequest._retry = true;

          // Serialize concurrent 401s: only one refresh at a time.
          // If a refresh is already in flight, all subsequent 401s wait for it.
          if (!this.refreshPromise) {
            this.refreshPromise = this.client
              .post<RefreshTokenResponse>('/auth/refresh', {
                refreshToken: this.refreshToken,
              })
              .then((res) => {
                this.setTokens(res.data.accessToken, res.data.refreshToken);
              })
              .catch(() => {
                this.clearTokens();
              })
              .finally(() => {
                this.refreshPromise = null;
              });
          }

          await this.refreshPromise;

          // If clearTokens was called (refresh failed), reject the original request
          if (!this.accessToken) {
            return Promise.reject(error);
          }

          originalRequest.headers.Authorization = `Bearer ${this.accessToken}`;
          return this.client(originalRequest);
        }
        return Promise.reject(error);
      },
    );
  }

  setTokens(accessToken: string, refreshToken: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    if (typeof window !== 'undefined') {
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
    }
  }

  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    }
  }

  getAccessToken() {
    return this.accessToken;
  }

  private unwrapTicketPayload(payload: unknown): Ticket | null {
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const maybeWrapped = payload as { ticket?: Ticket | null };
    if (Object.prototype.hasOwnProperty.call(maybeWrapped, 'ticket')) {
      return maybeWrapped.ticket ?? null;
    }

    return payload as Ticket;
  }

  private normalizeTicket(ticket: Record<string, unknown>): Ticket {
    const currentService = ticket.currentService as { id?: string; name?: string } | undefined;
    const branch = ticket.branch as { id?: string; name?: string } | undefined;
    const workplace = ticket.workplace as { id?: string; name?: string } | undefined;
    const operator = ticket.operator as { id?: string; fullName?: string } | undefined;

    return {
      id: String(ticket.id ?? ''),
      number: String(ticket.number ?? ''),
      clientPhone: String(ticket.clientPhone ?? ticket.phone ?? ''),
      clientName: (ticket.clientName as string | undefined) ?? undefined,
      serviceId: String(ticket.serviceId ?? ticket.serviceTypeId ?? currentService?.id ?? ''),
      serviceName: (ticket.serviceName as string | undefined) ?? currentService?.name,
      branchId: String(ticket.branchId ?? branch?.id ?? ''),
      branchName: (ticket.branchName as string | undefined) ?? branch?.name,
      workplaceId: (ticket.workplaceId as string | undefined) ?? workplace?.id,
      workplaceNumber: (ticket.workplaceNumber as string | undefined) ?? workplace?.name,
      operatorId: (ticket.operatorId as string | undefined) ?? operator?.id,
      operatorName: (ticket.operatorName as string | undefined) ?? operator?.fullName,
      status: ticket.status as Ticket['status'],
      notes: ticket.notes as string | undefined,
      cancelReason: ticket.cancelReason as string | undefined,
      createdAt: String(ticket.createdAt ?? new Date().toISOString()),
      startedAt: ticket.startedAt as string | undefined,
      completedAt: ticket.completedAt as string | undefined,
    };
  }

  private normalizeWorkplace(workplace: Record<string, unknown>): Workplace {
    const branch = workplace.branch as { id?: string; name?: string } | undefined;
    const workplaceServices = workplace.workplaceServices as Array<
      { serviceTypeId?: string; serviceType?: { id?: string; name?: string } }
    > | undefined;
    const primaryService = workplaceServices?.[0];

    return {
      id: String(workplace.id ?? ''),
      number: String(workplace.number ?? workplace.name ?? ''),
      branchId: String(workplace.branchId ?? branch?.id ?? ''),
      branchName: (workplace.branchName as string | undefined) ?? branch?.name,
      serviceId: String(workplace.serviceId ?? primaryService?.serviceTypeId ?? primaryService?.serviceType?.id ?? ''),
      serviceName: (workplace.serviceName as string | undefined) ?? primaryService?.serviceType?.name,
      isActive: Boolean(workplace.isActive ?? true),
      status: workplace.status as Workplace['status'],
      currentOperatorId: workplace.currentOperatorId as string | undefined,
      createdAt: String(workplace.createdAt ?? new Date().toISOString()),
      updatedAt: workplace.updatedAt as string | undefined,
    };
  }

  private normalizeUser(user: Record<string, unknown>): User {
    const fullName = String(user.fullName ?? '').trim();
    const [firstName, ...rest] = fullName.split(' ').filter(Boolean);
    const lastName = rest.join(' ');

    return {
      id: String(user.id ?? ''),
      firstName: (user.firstName as string | undefined) ?? firstName ?? '',
      lastName: (user.lastName as string | undefined) ?? lastName ?? '',
      email: String(user.email ?? ''),
      phoneNumber: (user.phoneNumber as string | undefined) ?? (user.phone as string | undefined),
      roleId: (user.roleId as User['roleId'] | undefined) ?? (user.role as User['roleId']),
      scopeLevel: (user.scopeLevel as User['scopeLevel'] | undefined) ?? ('ALL' as ScopeLevel),
      countryId: user.countryId as string | undefined,
      cityId: user.cityId as string | undefined,
      districtId: user.districtId as string | undefined,
      branchId: user.branchId as string | undefined,
      isActive: Boolean(user.isActive ?? true),
      createdAt: String(user.createdAt ?? new Date().toISOString()),
      updatedAt: user.updatedAt as string | undefined,
    };
  }

  // ─── Auth ────────────────────────────────────────────────────────────────

  async login(data: LoginRequest): Promise<LoginResponse> {
    const response = await this.client.post<LoginResponse>('/auth/login', data);
    this.setTokens(response.data.accessToken, response.data.refreshToken);
    return response.data;
  }

  async logout(refreshToken: string): Promise<{ success: boolean }> {
    try {
      const response = await this.client.post<{ success: boolean }>('/auth/logout', {
        refreshToken,
      });
      this.clearTokens();
      return response.data;
    } catch {
      this.clearTokens();
      return { success: true };
    }
  }

  async refreshAccessToken(): Promise<RefreshTokenResponse> {
    if (!this.refreshToken) throw new Error('No refresh token available');
    const response = await this.client.post<RefreshTokenResponse>('/auth/refresh', {
      refreshToken: this.refreshToken,
    });
    this.setTokens(response.data.accessToken, response.data.refreshToken);
    return response.data;
  }

  async getMe(): Promise<AuthUser> {
    const response = await this.client.get<AuthUser>('/auth/me');
    return response.data;
  }

  // ─── Users ───────────────────────────────────────────────────────────────

  async getUsers(params?: {
    page?: number;
    limit?: number;
    role?: string;
    search?: string;
    status?: 'ALL' | 'ACTIVE' | 'INACTIVE';
  }): Promise<PaginatedResponse<User>> {
    const response = await this.client.get<PaginatedResponse<Record<string, unknown>>>('/users', {
      params: { page: 1, limit: 20, ...params },
    });
    return {
      ...response.data,
      data: (response.data.data ?? []).map((user) => this.normalizeUser(user)),
    };
  }

  async createUser(data: Partial<User>): Promise<User> {
    const response = await this.client.post<Record<string, unknown> | { user: Record<string, unknown> }>('/users', data);
    const payload = (response.data as { user?: Record<string, unknown> }).user ?? (response.data as Record<string, unknown>);
    return this.normalizeUser(payload);
  }

  async updateUser(userId: string, data: Partial<User>): Promise<User> {
    const response = await this.client.patch<Record<string, unknown> | { user: Record<string, unknown> }>(`/users/${userId}`, data);
    const payload = (response.data as { user?: Record<string, unknown> }).user ?? (response.data as Record<string, unknown>);
    return this.normalizeUser(payload);
  }

  async deactivateUser(userId: string): Promise<{ success: boolean }> {
    const response = await this.client.post<{ success: boolean }>(
      `/users/${userId}/deactivate`,
    );
    return response.data;
  }

  async resetUserPassword(
    userId: string,
    newPassword: string,
  ): Promise<{ success: boolean }> {
    const response = await this.client.post<{ success: boolean }>(
      `/users/${userId}/reset-password`,
      { newPassword },
    );
    return response.data;
  }

  async getPermissions(params?: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Permission>> {
    const response = await this.client.get<PaginatedResponse<Permission>>('/permissions', {
      params: { page: 1, limit: 100, ...params },
    });
    return response.data;
  }

  async updateUserPermissions(
    userId: string,
    permissions: string[],
  ): Promise<{ success: boolean; assigned: number }> {
    const response = await this.client.put<{ success: boolean; assigned: number }>(
      `/users/${userId}/permissions`,
      { permissions },
    );
    return response.data;
  }

  async updateUserScopes(
    userId: string,
    scopes: UserScopeInput[],
  ): Promise<{ success: boolean; assigned: number }> {
    const response = await this.client.put<{ success: boolean; assigned: number }>(
      `/users/${userId}/scopes`,
      { scopes },
    );
    return response.data;
  }

  async updateUserServiceAccess(
    userId: string,
    serviceIds: string[],
  ): Promise<{ success: boolean; assigned: number }> {
    const response = await this.client.put<{ success: boolean; assigned: number }>(
      `/users/${userId}/service-access`,
      { serviceIds },
    );
    return response.data;
  }

  async getUserAccess(userId: string): Promise<UserAccessSnapshot> {
    const response = await this.client.get<UserAccessSnapshot>(`/users/${userId}/access`);
    return response.data;
  }

  // ─── Organisation ─────────────────────────────────────────────────────────

  async getCountries(): Promise<Country[]> {
    const response = await this.client.get<Country[]>('/org/countries');
    return response.data;
  }

  async createCountry(data: Partial<Country>): Promise<Country> {
    const response = await this.client.post<Country>('/org/countries', data);
    return response.data;
  }

  async getCities(countryId?: string): Promise<City[]> {
    const response = await this.client.get<City[]>('/org/cities', {
      params: countryId ? { countryId } : {},
    });
    return response.data;
  }

  async createCity(data: Partial<City>): Promise<City> {
    const response = await this.client.post<City>('/org/cities', data);
    return response.data;
  }

  async getDistricts(cityId?: string): Promise<District[]> {
    const response = await this.client.get<District[]>('/org/districts', {
      params: cityId ? { cityId } : {},
    });
    return response.data;
  }

  async createDistrict(data: Partial<District>): Promise<District> {
    const response = await this.client.post<District>('/org/districts', data);
    return response.data;
  }

  async getBranches(districtId?: string): Promise<Branch[]> {
    const response = await this.client.get<Branch[]>('/org/branches', {
      params: districtId ? { districtId } : {},
    });
    return response.data;
  }

  async createBranch(data: Partial<Branch>): Promise<Branch> {
    const response = await this.client.post<Branch>('/org/branches', data);
    return response.data;
  }

  /** Generic update for any org entity by its REST path segment */
  async updateOrgEntity(
    id: string,
    data: Record<string, unknown>,
    entity?: 'countries' | 'cities' | 'districts' | 'branches',
  ): Promise<Record<string, unknown>> {
    const seg = entity ?? 'branches';
    const response = await this.client.patch(`/org/${seg}/${id}`, data);
    return response.data;
  }

  /** Generic delete for any org entity */
  async deleteOrgEntity(
    id: string,
    entity?: 'countries' | 'cities' | 'districts' | 'branches',
  ): Promise<{ success: boolean }> {
    const seg = entity ?? 'branches';
    const response = await this.client.delete<{ success: boolean }>(`/org/${seg}/${id}`);
    return response.data;
  }

  // ─── Workplaces ───────────────────────────────────────────────────────────

  async getWorkplaces(params?: {
    page?: number;
    limit?: number;
    branchId?: string;
  }): Promise<PaginatedResponse<Workplace>> {
    const response = await this.client.get<PaginatedResponse<Record<string, unknown>>>('/workplaces', {
      params: { page: 1, limit: 50, ...params },
    });
    return {
      ...response.data,
      data: (response.data.data ?? []).map((row) => this.normalizeWorkplace(row)),
    };
  }

  async getMyAvailableWorkplaces(): Promise<Workplace[]> {
    const response = await this.client.get<Record<string, unknown>[] | PaginatedResponse<Record<string, unknown>>>('/workplaces/my-available');
    const rows = Array.isArray(response.data) ? response.data : response.data.data;
    return rows.map((row) => this.normalizeWorkplace(row));
  }

  async createWorkplace(data: Partial<Workplace>): Promise<Workplace> {
    const response = await this.client.post<Record<string, unknown>>('/workplaces', data);
    return this.normalizeWorkplace(response.data);
  }

  async updateWorkplace(workplaceId: string, data: Partial<Workplace>): Promise<Workplace> {
    const response = await this.client.patch<Record<string, unknown>>(`/workplaces/${workplaceId}`, data);
    return this.normalizeWorkplace(response.data);
  }

  async deleteWorkplace(workplaceId: string): Promise<{ success: boolean }> {
    const response = await this.client.delete<{ success: boolean }>(`/workplaces/${workplaceId}`);
    return response.data;
  }

  // ─── Services ─────────────────────────────────────────────────────────────

  async getServices(): Promise<ServiceType[]> {
    const response = await this.client.get<ServiceType[] | PaginatedResponse<ServiceType>>('/services');
    return Array.isArray(response.data) ? response.data : response.data.data;
  }

  async getServicesPage(params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: 'ALL' | 'ACTIVE' | 'INACTIVE';
  }): Promise<PaginatedResponse<ServiceType>> {
    const response = await this.client.get<PaginatedResponse<ServiceType>>('/services', {
      params: { page: 1, limit: 20, ...params },
    });
    return response.data;
  }

  async createService(data: Partial<ServiceType>): Promise<ServiceType> {
    const response = await this.client.post<{ service: ServiceType }>('/services', data);
    return response.data.service;
  }

  async updateServiceType(serviceId: string, data: Partial<ServiceType>): Promise<ServiceType> {
    const response = await this.client.patch<{ service: ServiceType }>(`/services/${serviceId}`, data);
    return response.data.service;
  }

  async deleteServiceType(serviceId: string): Promise<{ success: boolean }> {
    const response = await this.client.delete<{ success: boolean }>(`/services/${serviceId}`);
    return response.data;
  }

  async getServiceUsage(serviceId: string): Promise<ServiceUsage> {
    const response = await this.client.get<ServiceUsage>(`/services/${serviceId}/usage`);
    return response.data;
  }

  // ─── Tickets ──────────────────────────────────────────────────────────────

  async getTickets(params?: {
    page?: number;
    limit?: number;
    status?: string;
    branchId?: string;
    scope?: 'operator' | 'admin';
  }): Promise<PaginatedResponse<Ticket>> {
    const response = await this.client.get<PaginatedResponse<Record<string, unknown>>>('/tickets', {
      params: { page: 1, limit: 20, ...params },
    });
    return {
      ...response.data,
      data: (response.data.data ?? []).map((ticket) => this.normalizeTicket(ticket)),
    };
  }

  async createTicket(data: {
    phone: string;
    serviceTypeId: string;
    branchId: string;
    clientName?: string;
    notes?: string;
  }): Promise<Ticket> {
    const response = await this.client.post<Record<string, unknown> | { ticket: Record<string, unknown> }>('/tickets', data);
    const ticket = this.unwrapTicketPayload(response.data);
    if (!ticket) throw new Error('Не вдалося створити талон');
    return this.normalizeTicket(ticket as unknown as Record<string, unknown>);
  }

  async getTicket(ticketId: string): Promise<Ticket> {
    const response = await this.client.get<Record<string, unknown> | { ticket: Record<string, unknown> }>(`/tickets/${ticketId}`);
    const ticket = this.unwrapTicketPayload(response.data as unknown as Ticket | { ticket: Ticket });
    if (!ticket) throw new Error('Талон не знайдено');
    return this.normalizeTicket(ticket as unknown as Record<string, unknown>);
  }

  async getCurrentTicket(): Promise<Ticket | null> {
    try {
      const response = await this.client.get<Record<string, unknown> | { ticket: Record<string, unknown> | null }>('/tickets/current');
      const ticket = this.unwrapTicketPayload(response.data as unknown as Ticket | { ticket: Ticket | null });
      if (!ticket) return null;
      return this.normalizeTicket(ticket as unknown as Record<string, unknown>);
    } catch (error) {
      if ((error as AxiosError)?.response?.status === 404) return null;
      throw error;
    }
  }

  async getNextTicket(serviceId?: string): Promise<{ ticket: Ticket | null; message?: string }> {
    const response = await this.client.post<{ ticket: Ticket | null; message?: string }>(
      '/tickets/next',
      serviceId ? { serviceId } : {},
    );
    return response.data;
  }

  async startTicket(ticketId: string): Promise<Ticket> {
    const response = await this.client.post<Record<string, unknown> | { ticket: Record<string, unknown> }>(`/tickets/${ticketId}/start`);
    const ticket = this.unwrapTicketPayload(response.data);
    if (!ticket) throw new Error('Не вдалося почати обслуговування');
    return this.normalizeTicket(ticket as unknown as Record<string, unknown>);
  }

  async completeTicket(ticketId: string): Promise<Ticket> {
    const response = await this.client.post<Record<string, unknown> | { ticket: Record<string, unknown> }>(`/tickets/${ticketId}/complete`);
    const ticket = this.unwrapTicketPayload(response.data);
    if (!ticket) throw new Error('Не вдалося завершити талон');
    return this.normalizeTicket(ticket as unknown as Record<string, unknown>);
  }

  async cancelTicket(ticketId: string, reason: string): Promise<Ticket> {
    const response = await this.client.post<Record<string, unknown> | { ticket: Record<string, unknown> }>(`/tickets/${ticketId}/cancel`, {
      reason,
    });
    const ticket = this.unwrapTicketPayload(response.data);
    if (!ticket) throw new Error('Не вдалося скасувати талон');
    return this.normalizeTicket(ticket as unknown as Record<string, unknown>);
  }

  async redirectTicket(ticketId: string, targetServiceTypeId: string, reason = ''): Promise<Ticket> {
    const response = await this.client.post<Record<string, unknown> | { ticket: Record<string, unknown> }>(`/tickets/${ticketId}/redirect`, {
      targetServiceTypeId,
      reason,
    });
    const ticket = this.unwrapTicketPayload(response.data);
    if (!ticket) throw new Error('Не вдалося перенаправити талон');
    return this.normalizeTicket(ticket as unknown as Record<string, unknown>);
  }

  async callSpecificTicket(ticketId: string): Promise<Ticket> {
    const response = await this.client.post<Record<string, unknown> | { ticket: Record<string, unknown> }>(`/tickets/${ticketId}/call`);
    const ticket = this.unwrapTicketPayload(response.data);
    if (!ticket) throw new Error('Не вдалося викликати конкретний талон');
    return this.normalizeTicket(ticket as unknown as Record<string, unknown>);
  }

  // ─── Notifications ────────────────────────────────────────────────────────

  async getNotificationTemplates(): Promise<NotificationTemplate[]> {
    const response = await this.client.get<
      NotificationTemplate[] | { data: NotificationTemplate[]; total: number }
    >('/notification-templates');
    return Array.isArray(response.data)
      ? response.data
      : (response.data.data ?? []);
  }

  async createNotificationTemplate(
    data: { code: string; channel: string; text: string; description?: string },
  ): Promise<NotificationTemplate> {
    const response = await this.client.post<{ template: NotificationTemplate } | NotificationTemplate>(
      '/notification-templates',
      data,
    );
    const payload = response.data as { template?: NotificationTemplate };
    return payload.template ?? (response.data as NotificationTemplate);
  }

  async updateNotificationTemplate(
    templateId: string,
    data: { text?: string; isActive?: boolean },
  ): Promise<NotificationTemplate> {
    const response = await this.client.patch<{ template: NotificationTemplate } | NotificationTemplate>(
      `/notification-templates/${templateId}`,
      data,
    );
    const payload = response.data as { template?: NotificationTemplate };
    return payload.template ?? (response.data as NotificationTemplate);
  }

  async deleteNotificationTemplate(templateId: string): Promise<{ success: boolean }> {
    const response = await this.client.delete<{ success: boolean }>(
      `/notification-templates/${templateId}`,
    );
    return response.data;
  }

  async testSendNotification(params: {
    templateId: string;
    phone: string;
  }): Promise<{ success: boolean }> {
    const response = await this.client.post<{ success: boolean }>(
      `/notification-templates/${params.templateId}/test-send`,
      { phone: params.phone },
    );
    return response.data;
  }

  async getNotificationDeliveryLog(params?: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Notification>> {
    const response = await this.client.get<PaginatedResponse<Notification>>(
      '/notifications/delivery-log',
      { params: { page: 1, limit: 20, ...params } },
    );
    return response.data;
  }

  // ─── Analytics ────────────────────────────────────────────────────────────

  async getKPISummary(period?: string): Promise<KPISummary> {
    const response = await this.client.get<KPISummary>('/analytics/kpi-summary', {
      params: period ? { period } : {},
    });
    return response.data;
  }

  async getDashboardMetrics(): Promise<DashboardMetrics> {
    const response = await this.client.get<DashboardMetrics>('/analytics/dashboard');
    return response.data;
  }

  async getAnalyticsExport(params?: {
    format?: 'csv' | 'xlsx';
    dateRange?: string;
  }): Promise<Blob> {
    const response = await this.client.get('/analytics/export', {
      params: { format: 'csv', ...params },
      responseType: 'blob',
    });
    return response.data as Blob;
  }

  // ─── Audit ────────────────────────────────────────────────────────────────

  async getAuditLogs(params?: {
    page?: number;
    limit?: number;
    action?: string;
    entity?: string;
  }): Promise<PaginatedResponse<AuditLog>> {
    const response = await this.client.get<PaginatedResponse<AuditLog>>('/audit', {
      params: { page: 1, limit: 25, ...params },
    });
    return response.data;
  }

  async getAuditLogsByEntity(
    entityType: string,
    entityId: string,
    limit?: number,
  ): Promise<AuditLog[]> {
    const response = await this.client.get<AuditLog[]>(
      `/audit/entity/${entityType}/${entityId}`,
      { params: limit ? { limit } : {} },
    );
    return response.data;
  }

  // ─── System ───────────────────────────────────────────────────────────────

  async getSystemSettings(): Promise<SystemSettingsResponse> {
    const response = await this.client.get<SystemSettingsResponse>('/system/settings');
    return response.data;
  }

  async updateSystemSettings(payload: Record<string, unknown>): Promise<{ success: boolean; updated: number }> {
    const response = await this.client.put<{ success: boolean; updated: number }>(
      '/system/settings',
      payload,
    );
    return response.data;
  }

  async getSystemHealth(): Promise<SystemHealth> {
    const response = await this.client.get<SystemHealth>('/system/health');
    return response.data;
  }

  async getSystemMetrics(): Promise<SystemMetrics> {
    const response = await this.client.get<SystemMetrics>('/system/metrics');
    return response.data;
  }

  async switchNotificationProvider(mode: NotificationProviderMode): Promise<{ success: boolean; mode: NotificationProviderMode }> {
    const response = await this.client.post<{ success: boolean; mode: NotificationProviderMode }>(
      '/system/notification-provider/switch',
      { mode },
    );
    return response.data;
  }

  async getKioskTerminals(): Promise<{ data: KioskTerminal[]; total: number }> {
    const response = await this.client.get<{ data: KioskTerminal[]; total: number }>('/system/terminals');
    return response.data;
  }

  async createKioskTerminal(payload: {
    name: string;
    branchId: string;
    status?: 'ACTIVE' | 'INACTIVE';
    description?: string;
  }): Promise<{ terminal: KioskTerminal }> {
    const response = await this.client.post<{ terminal: KioskTerminal }>('/system/terminals', payload);
    return response.data;
  }

  async updateKioskTerminal(
    terminalId: string,
    payload: {
      name?: string;
      branchId?: string;
      status?: 'ACTIVE' | 'INACTIVE';
      description?: string;
      lastSeenAt?: string;
    },
  ): Promise<{ terminal: KioskTerminal }> {
    const response = await this.client.patch<{ terminal: KioskTerminal }>(`/system/terminals/${terminalId}`, payload);
    return response.data;
  }

  async rotateKioskTerminalKey(terminalId: string): Promise<{ terminal: KioskTerminal }> {
    const response = await this.client.post<{ terminal: KioskTerminal }>(`/system/terminals/${terminalId}/rotate-key`);
    return response.data;
  }

  async deleteKioskTerminal(terminalId: string): Promise<{ success: boolean }> {
    const response = await this.client.delete<{ success: boolean }>(`/system/terminals/${terminalId}`);
    return response.data;
  }

  // ─── Public Display ───────────────────────────────────────────────────────

  async getPublicDisplayData(branchId: string): Promise<PublicDisplayData> {
    const response = await this.client.get<PublicDisplayData>(
      `/public/display/${branchId}`,
    );
    return response.data;
  }

  async getPublicServicesForBranch(
    branchId: string,
    params?: { page?: number; limit?: number },
  ): Promise<PaginatedResponse<ServiceType>> {
    const response = await this.client.get<PaginatedResponse<ServiceType>>(
      '/public/services/available-for-branch',
      { params: { branchId, page: 1, limit: 100, ...params } },
    );
    return response.data;
  }

  async createPublicTicket(data: {
    branchId: string;
    serviceTypeId: string;
    phone: string;
    clientName?: string;
  }): Promise<{ ticket: Ticket }> {
    const response = await this.client.post<{ ticket: Ticket }>('/public/tickets', data);
    return response.data;
  }

  async getDisplaySettings(branchId: string): Promise<DisplaySettings> {
    const response = await this.client.get<DisplaySettings>(`/display/settings/${branchId}`);
    return response.data;
  }

  async updateDisplaySettings(
    branchId: string,
    payload: Partial<DisplaySettings>,
  ): Promise<{ settings: DisplaySettings }> {
    const response = await this.client.put<{ settings: DisplaySettings }>(
      `/display/settings/${branchId}`,
      payload,
    );
    return response.data;
  }

  async testDisplayTts(text?: string): Promise<{ success: boolean; text: string; note: string }> {
    const response = await this.client.post<{ success: boolean; text: string; note: string }>(
      '/display/tts/test',
      text ? { text } : {},
    );
    return response.data;
  }

  // ─── Operator Shifts ──────────────────────────────────────────────────────

  async startShift(workplaceId: string): Promise<{ shift: OperatorShift }> {
    const response = await this.client.post<{ shift: OperatorShift }>('/operator-shifts/start', { workplaceId });
    return response.data;
  }

  async getCurrentShift(): Promise<CurrentOperatorShift> {
    const response = await this.client.get<CurrentOperatorShift>('/operator-shifts/current');
    return response.data;
  }

  async endShift(): Promise<{ success: boolean; closed: number; autoCancelledTickets?: number }> {
    const response = await this.client.post<{ success: boolean; closed: number; autoCancelledTickets?: number }>('/operator-shifts/end');
    return response.data;
  }

  // ─── Queue Orchestrator ───────────────────────────────────────────────────

  async callNextTicket(serviceId?: string): Promise<{ ticket: Ticket | null; message?: string }> {
    const response = await this.client.post<{ ticket: Ticket | null; message?: string }>(
      '/queue/next',
      serviceId ? { serviceId } : {},
    );
    return response.data;
  }

  // ─── Analytics Extended ───────────────────────────────────────────────────

  async getWaitingTime(params?: { from?: string; to?: string; branchId?: string }): Promise<WaitingTimeStats[]> {
    const response = await this.client.get<WaitingTimeStats[]>('/analytics/waiting-time', { params });
    return response.data;
  }

  async getServiceTime(params?: { from?: string; to?: string; branchId?: string }): Promise<ServiceTimeStats[]> {
    const response = await this.client.get<ServiceTimeStats[]>('/analytics/service-time', { params });
    return response.data;
  }

  async getOperatorsRating(params?: { from?: string; to?: string; branchId?: string }): Promise<OperatorRating[]> {
    const response = await this.client.get<OperatorRating[]>('/analytics/operators-rating', { params });
    return response.data;
  }
}

const apiClient = new ApiClient();
export default apiClient;
