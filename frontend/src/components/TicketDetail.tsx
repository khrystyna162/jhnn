import { useState } from 'react';
import { ServiceType, Ticket, TicketStatus } from '@/types';
import { formatDateTime, getTicketStatusLabel, getTicketStatusColor } from '@/utils/formatters';
import apiClient from '@/services/api';
import { ArrowRightLeft, Ban, CheckCircle2, PhoneCall, Play } from 'lucide-react';

interface TicketDetailProps {
  ticket: Ticket;
  onUpdate: (updatedTicket: Ticket) => void;
}

export function TicketDetail({ ticket, onUpdate }: TicketDetailProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isRedirectOpen, setIsRedirectOpen] = useState(false);
  const [redirectReason, setRedirectReason] = useState('');
  const [targetServiceTypeId, setTargetServiceTypeId] = useState('');
  const [availableServices, setAvailableServices] = useState<ServiceType[]>([]);
  const [isLoadingServices, setIsLoadingServices] = useState(false);

  const closeInlineForms = () => {
    setIsCancelOpen(false);
    setIsRedirectOpen(false);
    setCancelReason('');
    setRedirectReason('');
    setTargetServiceTypeId('');
  };

  const openRedirectForm = async () => {
    setActionError(null);
    setIsCancelOpen(false);
    setIsRedirectOpen(true);

    if (availableServices.length > 0) return;

    try {
      setIsLoadingServices(true);
      const services = await apiClient.getServices();
      setAvailableServices(services.filter((service) => service.id !== ticket.serviceId));
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Не вдалося завантажити список послуг',
      );
    } finally {
      setIsLoadingServices(false);
    }
  };

  const handleCallTicket = async () => {
    if (ticket.status !== TicketStatus.WAITING) return;

    try {
      setActionError(null);
      setIsLoading(true);
      const updated = await apiClient.callSpecificTicket(ticket.id);
      onUpdate(updated);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Помилка при виклику талона');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartTicket = async () => {
    if (ticket.status !== TicketStatus.CALLED) return;

    try {
      setActionError(null);
      setIsLoading(true);
      const updated = await apiClient.startTicket(ticket.id);
      onUpdate(updated);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Помилка при початку обслуговування');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteTicket = async () => {
    if (ticket.status !== TicketStatus.IN_PROGRESS) return;

    try {
      setActionError(null);
      setIsLoading(true);
      const updated = await apiClient.completeTicket(ticket.id);
      onUpdate(updated);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Помилка при завершенні талона');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelTicket = async () => {
    if (![TicketStatus.WAITING, TicketStatus.IN_PROGRESS].includes(ticket.status))
      return;

    const reason = cancelReason.trim();
    if (reason.length < 3) {
      setActionError('Вкажіть причину скасування (мінімум 3 символи)');
      return;
    }

    try {
      setActionError(null);
      setIsLoading(true);
      const updated = await apiClient.cancelTicket(ticket.id, reason);
      onUpdate(updated);
      closeInlineForms();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Помилка при скасуванні талона');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRedirectTicket = async () => {
    if (ticket.status !== TicketStatus.IN_PROGRESS) return;

    const reason = redirectReason.trim();
    if (!targetServiceTypeId) {
      setActionError('Оберіть цільову послугу');
      return;
    }
    if (reason.length < 3) {
      setActionError('Вкажіть причину перенаправлення (мінімум 3 символи)');
      return;
    }

    try {
      setActionError(null);
      setIsLoading(true);
      const updated = await apiClient.redirectTicket(ticket.id, targetServiceTypeId, reason);
      onUpdate(updated);
      closeInlineForms();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Помилка при перенаправленні талона');
    } finally {
      setIsLoading(false);
    }
  };

  const canCall = ticket.status === TicketStatus.WAITING;
  const canStart = ticket.status === TicketStatus.CALLED;
  const canComplete = ticket.status === TicketStatus.IN_PROGRESS;
  const canCancel = [TicketStatus.WAITING, TicketStatus.IN_PROGRESS].includes(
    ticket.status
  );
  const canRedirect = ticket.status === TicketStatus.IN_PROGRESS;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Талон #{ticket.number}</h2>
          <p className="text-gray-600 mt-1">ID: {ticket.id}</p>
        </div>
        <div className={`badge ${getTicketStatusColor(ticket.status)}`}>
          {getTicketStatusLabel(ticket.status)}
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-600">Номер телефону</p>
            <p className="text-lg font-semibold text-gray-900">{ticket.clientPhone}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Послуга</p>
            <p className="text-lg font-semibold text-gray-900">{ticket.serviceName}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Філія</p>
            <p className="text-lg font-semibold text-gray-900">{ticket.branchName}</p>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-600">Робоче місце</p>
            <p className="text-lg font-semibold text-gray-900">
              {ticket.workplaceNumber || '-'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Оператор</p>
            <p className="text-lg font-semibold text-gray-900">
              {ticket.operatorName || 'Не призначено'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Час створення</p>
            <p className="text-lg font-semibold text-gray-900">
              {formatDateTime(new Date(ticket.createdAt))}
            </p>
          </div>
        </div>
      </div>

      {/* Timeline Events */}
      {ticket.events && ticket.events.length > 0 && (
        <div className="border-t pt-6">
          <h3 className="font-semibold text-gray-900 mb-4">Історія подій</h3>
          <div className="space-y-3">
            {ticket.events.map((event, idx) => (
              <div key={event.id ?? `${event.timestamp}-${idx}`} className="flex gap-3 p-3 bg-gray-50 rounded">
                <div className="text-xs text-gray-500 pt-1 min-w-fit">
                  {formatDateTime(new Date(event.timestamp))}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{event.eventType}</p>
                  {event.notes && (
                    <p className="text-sm text-gray-600 mt-1">{event.notes}</p>
                  )}
                  {event.createdByName && (
                    <p className="text-xs text-gray-500 mt-1">Оператор: {event.createdByName}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="border-t pt-6">
        {actionError && (
          <div className="alert alert-error mb-4">
            <p>{actionError}</p>
          </div>
        )}

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="text-sm font-semibold text-gray-900 mb-3">Доступні дії</div>
          <div className="flex flex-wrap gap-2">
            {canCall && (
              <button
                type="button"
                onClick={() => {
                  setActionError(null);
                  closeInlineForms();
                  void handleCallTicket();
                }}
                className="btn btn-primary inline-flex items-center"
                disabled={isLoading}
              >
                <PhoneCall size={16} className="mr-2" />
                Викликати талон
              </button>
            )}

            {canStart && (
              <button
                type="button"
                onClick={() => {
                  setActionError(null);
                  closeInlineForms();
                  void handleStartTicket();
                }}
                className="btn btn-primary inline-flex items-center"
                disabled={isLoading}
              >
                <Play size={16} className="mr-2" />
                Розпочати обслуговування
              </button>
            )}

            {canComplete && (
              <button
                type="button"
                onClick={() => {
                  setActionError(null);
                  closeInlineForms();
                  void handleCompleteTicket();
                }}
                className="btn inline-flex items-center bg-green-600 text-white hover:bg-green-700"
                disabled={isLoading}
              >
                <CheckCircle2 size={16} className="mr-2" />
                Завершити талон
              </button>
            )}

            {canRedirect && (
              <button
                type="button"
                onClick={() => {
                  void openRedirectForm();
                }}
                className="btn inline-flex items-center bg-amber-500 text-white hover:bg-amber-600"
                disabled={isLoading}
              >
                <ArrowRightLeft size={16} className="mr-2" />
                Перенаправити
              </button>
            )}

            {canCancel && (
              <button
                type="button"
                onClick={() => {
                  setIsRedirectOpen(false);
                  setActionError(null);
                  setIsCancelOpen(true);
                }}
                className="btn btn-danger inline-flex items-center"
                disabled={isLoading}
              >
                <Ban size={16} className="mr-2" />
                Скасувати талон
              </button>
            )}
          </div>

          {isLoading && (
            <div className="mt-3 text-sm text-gray-600 inline-flex items-center">
              <span className="spinner inline-block mr-2 h-4 w-4"></span>
              Обробка дії...
            </div>
          )}
        </div>

        {isCancelOpen && (
          <div className="mt-4 p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-3">
            <label className="form-label">Причина скасування</label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="form-textarea"
              rows={3}
              placeholder="Вкажіть причину..."
              disabled={isLoading}
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => closeInlineForms()}
                disabled={isLoading}
              >
                Скасувати
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => void handleCancelTicket()}
                disabled={isLoading}
              >
                Підтвердити скасування
              </button>
            </div>
          </div>
        )}

        {isRedirectOpen && (
          <div className="mt-4 p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-3">
            <div>
              <label className="form-label">Цільова послуга</label>
              <select
                value={targetServiceTypeId}
                onChange={(e) => setTargetServiceTypeId(e.target.value)}
                className="form-select"
                disabled={isLoading || isLoadingServices}
              >
                <option value="">Оберіть послугу...</option>
                {availableServices.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Причина перенаправлення</label>
              <textarea
                value={redirectReason}
                onChange={(e) => setRedirectReason(e.target.value)}
                className="form-textarea"
                rows={3}
                placeholder="Вкажіть причину..."
                disabled={isLoading}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => closeInlineForms()}
                disabled={isLoading}
              >
                Закрити
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void handleRedirectTicket()}
                disabled={isLoading || isLoadingServices}
              >
                Перенаправити
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
