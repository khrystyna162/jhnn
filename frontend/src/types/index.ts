// ─── Auth / User Roles ────────────────────────────────────────────────────────

export enum Role {
  OPERATOR = 'OPERATOR',
  ADMIN = 'ADMIN',
  SYSADMIN = 'SYSADMIN',
}

export enum ScopeLevel {
  ALL = 'ALL',
  COUNTRY = 'COUNTRY',
  CITY = 'CITY',
  DISTRICT = 'DISTRICT',
  BRANCH = 'BRANCH',
}

/** Logged-in user state (from JWT / login response) */
export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  roleId: Role;
  scopeLevel: ScopeLevel;
  countryId?: string;
  cityId?: string;
  districtId?: string;
  branchId?: string;
  isActive: boolean;
}

export interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  error: string | null;
}

// ─── User (admin list) ────────────────────────────────────────────────────────

/** Full user record returned from /users list */
export interface User extends AuthUser {
  createdAt: string;
  updatedAt?: string;
}

// ─── Organisation ────────────────────────────────────────────────────────────

export interface Country {
  id: string;
  code?: string;
  name: string;
  isActive?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface City {
  id: string;
  countryId: string;
  countryName?: string;
  name: string;
  isActive?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface District {
  id: string;
  cityId: string;
  cityName?: string;
  name: string;
  isActive?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Branch {
  id: string;
  districtId: string;
  districtName?: string;
  cityId?: string;
  countryId?: string;
  code?: string;
  name: string;
  addressLine?: string;
  isActive?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface OrgNode {
  id: string;
  type: 'country' | 'city' | 'district' | 'branch';
  name: string;
  children?: OrgNode[];
}

// ─── Workplace ────────────────────────────────────────────────────────────────

export enum WorkplaceStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  INACTIVE = 'INACTIVE',
}

export interface Workplace {
  id: string;
  /** Display number, e.g. "1", "2A" */
  number: string;
  branchId: string;
  branchName?: string;
  serviceId: string;
  serviceName?: string;
  isActive: boolean;
  status?: WorkplaceStatus;
  currentOperatorId?: string;
  createdAt: string;
  updatedAt?: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export interface ServiceType {
  id: string;
  code?: string;
  name: string;
  prefix: string;
  slaMinutes?: number;
  isActive?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface ServiceWorkplaceUsage {
  id: string;
  name: string;
  isActive: boolean;
  branchId: string;
  branchName: string;
  districtId: string;
  districtName: string;
  cityId: string;
  cityName: string;
  countryId: string;
  countryName: string;
}

export interface ServiceOperatorUsage {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  isActive: boolean;
}

export interface ServiceUsage {
  service: ServiceType;
  workplaces: ServiceWorkplaceUsage[];
  operators: ServiceOperatorUsage[];
}

// ─── Ticket ───────────────────────────────────────────────────────────────────

export enum TicketStatus {
  WAITING = 'WAITING',
  CALLED = 'CALLED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  REDIRECTED = 'REDIRECTED',
}

export interface TicketEvent {
  id?: string;
  ticketId?: string;
  eventType: string;
  timestamp: string;
  notes?: string;
  createdById?: string;
  createdByName?: string;
}

export interface Ticket {
  id: string;
  number: string;
  clientPhone: string;
  clientName?: string;
  serviceId: string;
  serviceName?: string;
  branchId: string;
  branchName?: string;
  workplaceId?: string;
  workplaceNumber?: string;
  operatorId?: string;
  operatorName?: string;
  status: TicketStatus;
  notes?: string;
  cancelReason?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  events?: TicketEvent[];
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// ─── Notifications ────────────────────────────────────────────────────────────

export enum NotificationChannel {
  VIBER = 'VIBER',
  SMS = 'SMS',
}

export enum DeliveryStatus {
  NOT_SENT = 'NOT_SENT',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

export interface NotificationTemplate {
  id: string;
  /** System code key, e.g. TICKET_CREATED */
  code: string;
  channel: string;
  text: string;
  description?: string;
  version?: number;
  isActive?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Notification {
  id: string;
  ticketId?: string;
  channel: NotificationChannel;
  status: DeliveryStatus;
  providerName?: string;
  providerMessageId?: string;
  templateCode?: string;
  errorMessage?: string;
  sentAt?: string;
  createdAt: string;
  ticket?: { number: string };
}

// ─── Audit ────────────────────────────────────────────────────────────────────

export interface AuditLog {
  id: string;
  userId?: string;
  userEmail?: string;
  action: string;
  entity?: string;
  entityId?: string;
  changes?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export interface KPISummary {
  totalTickets: number;
  completedTickets: number;
  cancelledTickets: number;
  redirectedTickets: number;
  avgWaitingTime: number;
  avgServiceTime: number;
  minServiceTime: number;
  maxServiceTime: number;
  period: string;
}

export interface DashboardMetrics {
  currentQueues: Record<string, number>;
  activeOperators: number;
  serviceTime: number;
  waitingTime: number;
  completionRate: number;
}

// ─── Public Display ───────────────────────────────────────────────────────────

export interface PublicWorkplace {
  id: string;
  number: string;
  serviceName?: string;
  currentTicketNumber?: string;
  operatorName?: string;
  status: WorkplaceStatus;
}

export interface PublicTicket {
  number: string;
  serviceName?: string;
  workplaceNumber?: string;
  status: TicketStatus;
  calledAt?: string;
}

export interface PublicDisplayData {
  branchId: string;
  branchName: string;
  updatedAt: string;
  workplaces: PublicWorkplace[];
  activeTickets: PublicTicket[];
  completedTicketNumbers: string[];
}

export type DisplayLayoutMode = 'FHD' | 'UHD';

export interface DisplaySettings {
  branchId: string;
  layoutMode: DisplayLayoutMode;
  ttsEnabled: boolean;
  ttsVoice?: string;
  ttsRate: number;
  ttsVolume: number;
}

// ─── System ─────────────────────────────────────────────────────────────────

export type NotificationProviderMode = 'mock' | 'sandbox' | 'production';

export interface SystemSetting {
  key: string;
  value: Record<string, unknown>;
}

export interface SystemSettingsResponse {
  data: SystemSetting[];
  total: number;
}

export interface SystemHealth {
  status: 'ok' | 'degraded' | 'down' | string;
  timestamp: string;
}

export interface SystemMetrics {
  users: number;
  branches: number;
  workplaces: number;
  waitingTickets: number;
  inProgressTickets: number;
  timestamp: string;
}

export type KioskTerminalStatus = 'ACTIVE' | 'INACTIVE';

export interface KioskTerminal {
  id: string;
  name: string;
  branchId: string;
  branchName?: string;
  status: KioskTerminalStatus;
  apiKey: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  lastSeenAt?: string;
}

// ─── API Requests / Responses ─────────────────────────────────────────────────

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
  user: AuthUser;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
}

export interface ApiResponse<T> {
  data?: T;
  message?: string;
  error?: string;
  statusCode?: number;
}

// ─── Permissions (future) ─────────────────────────────────────────────────────

export interface UserScope {
  id: string;
  userId: string;
  level: ScopeLevel;
  countryId?: string;
  cityId?: string;
  districtId?: string;
  branchId?: string;
  createdAt: string;
}

export interface UserScopeInput {
  level: ScopeLevel;
  countryId?: string;
  cityId?: string;
  districtId?: string;
  branchId?: string;
}

export interface Permission {
  id: string;
  code: string;
  description?: string;
  createdAt: string;
}

export interface UserAccessSnapshot {
  permissions: string[];
  scopes: UserScopeInput[];
  serviceIds: string[];
}

// ─── Operator Shift ───────────────────────────────────────────────────────────

export enum ShiftStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

export interface OperatorShift {
  id: string;
  userId: string;
  workplaceId: string;
  status: ShiftStatus;
  startedAt: string;
  endedAt?: string;
}

export interface OperatorShiftWorkplaceSummary {
  id: string;
  number: string;
}

export interface CurrentOperatorShift {
  shift: OperatorShift | null;
  workplace?: OperatorShiftWorkplaceSummary;
}

// ─── Analytics Extended ───────────────────────────────────────────────────────

export interface WaitingTimeStats {
  hour: number;
  avgWaitingSeconds: number;
  ticketCount: number;
}

export interface ServiceTimeStats {
  serviceId: string;
  serviceName: string;
  avgServiceSeconds: number;
  ticketCount: number;
}

export interface OperatorRating {
  operatorId: string;
  operatorName: string;
  completed: number;
  avgServiceSeconds: number;
}
