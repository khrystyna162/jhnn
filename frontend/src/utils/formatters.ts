import { TicketStatus, ScopeLevel } from '@/types';

export const formatPhoneNumber = (phone: string): string => {
  if (!phone) return '';
  // Simple formatting for Ukrainian phone numbers
  const cleaned = phone.replace(/\\D/g, '');
  if (cleaned.length === 10) {
    return `+380 ${cleaned.substring(0, 2)} ${cleaned.substring(2, 5)} ${cleaned.substring(5)}`;
  }
  if (cleaned.length === 12) {
    return `+${cleaned.substring(0, 2)} ${cleaned.substring(2, 4)} ${cleaned.substring(4, 7)} ${cleaned.substring(7)}`;
  }
  return phone;
};

export const maskPhoneNumber = (phone: string): string => {
  if (!phone) return '';
  // Mask middle digits
  const cleaned = phone.replace(/\\D/g, '');
  if (cleaned.length >= 10) {
    const lastFour = cleaned.slice(-4);
    return `****${lastFour}`;
  }
  return phone;
};

export const formatDateTime = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('uk-UA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

export const formatTime = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('uk-UA', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

export const formatDate = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('uk-UA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

export const getDurationInSeconds = (startTime: string, endTime: string): number => {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  return Math.floor((end - start) / 1000);
};

export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}ч ${minutes}м`;
  }
  if (minutes > 0) {
    return `${minutes}м ${secs}с`;
  }
  return `${secs}с`;
};

export const getTicketStatusLabel = (status: TicketStatus): string => {
  const labels: Record<TicketStatus, string> = {
    WAITING: 'Очікує',
    CALLED: 'Викликано',
    IN_PROGRESS: 'В роботі',
    COMPLETED: 'Завершено',
    CANCELLED: 'Скасовано',
    REDIRECTED: 'Перенаправлено',
  };
  return labels[status] || status;
};

export const getTicketStatusColor = (status: TicketStatus): string => {
  const colors: Record<TicketStatus, string> = {
    WAITING: 'bg-yellow-100 text-yellow-800',
    CALLED: 'bg-blue-100 text-blue-800',
    IN_PROGRESS: 'bg-blue-100 text-blue-800',
    COMPLETED: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-red-100 text-red-800',
    REDIRECTED: 'bg-orange-100 text-orange-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
};

export const getScopeLevelLabel = (level: ScopeLevel): string => {
  const labels: Record<ScopeLevel, string> = {
    ALL: 'Всі',
    COUNTRY: 'Країна',
    CITY: 'Місто',
    DISTRICT: 'Район',
    BRANCH: 'Філія',
  };
  return labels[level] || level;
};

export const validatePhoneNumber = (phone: string): boolean => {
  const cleaned = phone.replace(/\\D/g, '');
  return cleaned.length >= 10;
};

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  return emailRegex.test(email);
};

export const formatCurrency = (amount: number, currency = 'UAH'): string => {
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
};

export const calculateWaitingTime = (createdAt: string, startedAt?: string): number => {
  const created = new Date(createdAt).getTime();
  const started = startedAt ? new Date(startedAt).getTime() : Date.now();
  return Math.floor((started - created) / 1000);
};

export const calculateServiceTime = (startedAt?: string, completedAt?: string): number => {
  if (!startedAt || !completedAt) return 0;
  const started = new Date(startedAt).getTime();
  const completed = new Date(completedAt).getTime();
  return Math.floor((completed - started) / 1000);
};

export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const getInitials = (fullName?: string): string => {
  if (!fullName) return '?';
  return fullName
    .split(' ')
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
};
