import { useEffect, useState, useCallback, useMemo } from 'react';
import Head from 'next/head';
import { withDashboard } from '@/components/DashboardLayout';
import { Modal, ConfirmDialog } from '@/components/Modal';
import apiClient from '@/services/api';
import { useToast } from '@/components/Toast';
import { useAuthStore } from '@/store/authStore';
import {
  Ticket,
  TicketStatus,
  Workplace,
  ServiceType,
  OperatorShiftWorkplaceSummary,
} from '@/types';
import { formatDateTime, getTicketStatusLabel, getTicketStatusColor } from '@/utils/formatters';

type ShiftState = 'no-shift' | 'active';

function OperatorPage() {
  const { user } = useAuthStore();
  const { show } = useToast();
  const operatorName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || (user as { fullName?: string }).fullName || user.email || 'Оператор'
    : 'Оператор';

  const [shiftState, setShiftState] = useState<ShiftState>('no-shift');
  const [activeWorkplace, setActiveWorkplace] = useState<OperatorShiftWorkplaceSummary | null>(null);
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
  const [selectedWorkplaceId, setSelectedWorkplaceId] = useState('');
  const [shiftLoading, setShiftLoading] = useState(false);

  const [currentTicket, setCurrentTicket] = useState<Ticket | null>(null);
  const [waitingTickets, setWaitingTickets] = useState<Ticket[]>([]);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [queueLoading, setQueueLoading] = useState(false);

  const [isRedirectModalOpen, setIsRedirectModalOpen] = useState(false);
  const [redirectServiceId, setRedirectServiceId] = useState('');
  const [nextServiceId, setNextServiceId] = useState('');
  const [availableServices, setAvailableServices] = useState<ServiceType[]>([]);
  const [isRejectConfirmOpen, setIsRejectConfirmOpen] = useState(false);

  const hasActiveTicket = useMemo(
    () =>
      !!currentTicket &&
      (currentTicket.status === TicketStatus.CALLED ||
        currentTicket.status === TicketStatus.IN_PROGRESS),
    [currentTicket],
  );

  const callBlockedReason = hasActiveTicket
    ? 'Є активний талон. Завершіть або відхиліть його, щоб викликати наступного.'
    : null;

  const filteredWaitingTickets = useMemo(() => {
    if (!nextServiceId) return waitingTickets;
    return waitingTickets.filter((ticket) => ticket.serviceId === nextServiceId);
  }, [waitingTickets, nextServiceId]);

  const loadCurrentShift = useCallback(async () => {
    try {
      const result = await apiClient.getCurrentShift();
      if (result.shift) {
        setShiftState('active');
        setActiveWorkplace(result.workplace ?? null);
        if (result.shift.workplaceId) {
          setSelectedWorkplaceId(result.shift.workplaceId);
        }
        return;
      }

      setShiftState('no-shift');
      setActiveWorkplace(null);
    } catch {
      setShiftState('no-shift');
      setActiveWorkplace(null);
    }
  }, []);

  const loadCurrentTicket = useCallback(async () => {
    try {
      const ticket = await apiClient.getCurrentTicket();
      setCurrentTicket(ticket);
    } catch {
      setCurrentTicket(null);
    }
  }, []);

  const loadWaitingTickets = useCallback(async () => {
    try {
      setQueueLoading(true);
      const result = await apiClient.getTickets({ page: 1, limit: 100, scope: 'operator' });
      const waiting = result.data
        .filter((ticket) => ticket.status === TicketStatus.WAITING)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setWaitingTickets(waiting);
    } catch {
      setWaitingTickets([]);
    } finally {
      setQueueLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCurrentShift();
    void loadCurrentTicket();
    void loadWaitingTickets();
  }, [loadCurrentShift, loadCurrentTicket, loadWaitingTickets]);

  useEffect(() => {
    if (shiftState !== 'active') return;

    const interval = window.setInterval(() => {
      void loadCurrentTicket();
      void loadWaitingTickets();
    }, 10000);

    return () => window.clearInterval(interval);
  }, [shiftState, loadCurrentTicket, loadWaitingTickets]);

  useEffect(() => {
    apiClient.getMyAvailableWorkplaces().then((items) => {
      setWorkplaces(items);
      if (items.length > 0) setSelectedWorkplaceId(items[0].id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    apiClient.getServices().then((services) => {
      setAvailableServices(services);
    }).catch(() => {});
  }, []);

  const handleStartShift = async () => {
    if (!selectedWorkplaceId) { show('Оберіть робоче місце', 'error'); return; }
    try {
      setShiftLoading(true);
      await apiClient.startShift(selectedWorkplaceId);
      await loadCurrentShift();
      await loadWaitingTickets();
      show('Зміну відкрито', 'success');
    } catch (err) {
      show(err instanceof Error ? err.message : 'Помилка при відкритті зміни', 'error');
    } finally { setShiftLoading(false); }
  };

  const handleEndShift = async () => {
    try {
      setShiftLoading(true);
      const result = await apiClient.endShift();
      setShiftState('no-shift');
      setActiveWorkplace(null);
      setCurrentTicket(null);
      setWaitingTickets([]);
      if ((result.autoCancelledTickets ?? 0) > 0) {
        show(`Зміну закрито. Не обслужено талонів: ${result.autoCancelledTickets}`, 'success');
      } else {
        show('Зміну закрито', 'success');
      }
    } catch (err) {
      show(err instanceof Error ? err.message : 'Помилка при закритті зміни', 'error');
    } finally { setShiftLoading(false); }
  };

  const handleCallNext = async () => {
    if (hasActiveTicket) {
      show('Спершу завершіть або відхиліть поточний талон', 'warning');
      return;
    }

    try {
      setTicketLoading(true);
      const result = await apiClient.callNextTicket(nextServiceId || undefined);
      if (!result.ticket) {
        show(result.message || 'У черзі немає талонів', 'info');
      } else {
        setCurrentTicket(result.ticket);
        await loadWaitingTickets();
        show(`Викликано талон №${result.ticket.number}`, 'success');
      }
    } catch (err) {
      show(err instanceof Error ? err.message : 'Помилка при виклику талона', 'error');
    } finally { setTicketLoading(false); }
  };

  const handleCallSpecific = async (ticket: Ticket) => {
    if (hasActiveTicket) {
      show('Спершу завершіть або відхиліть поточний талон', 'warning');
      return;
    }

    try {
      setTicketLoading(true);
      const called = await apiClient.callSpecificTicket(ticket.id);
      setCurrentTicket(called);
      await loadWaitingTickets();
      show(`Викликано талон №${called.number}`, 'success');
    } catch (err) {
      show(err instanceof Error ? err.message : 'Помилка при виклику талона', 'error');
    } finally {
      setTicketLoading(false);
    }
  };

  const handleStartServicing = async () => {
    if (!currentTicket) return;
    try {
      setTicketLoading(true);
      const ticket = await apiClient.startTicket(currentTicket.id);
      setCurrentTicket(ticket);
      await loadWaitingTickets();
      show('Обслуговування розпочато', 'success');
    } catch (err) {
      show(err instanceof Error ? err.message : 'Помилка', 'error');
    } finally { setTicketLoading(false); }
  };

  const handleComplete = async () => {
    if (!currentTicket) return;
    try {
      setTicketLoading(true);
      await apiClient.completeTicket(currentTicket.id);
      setCurrentTicket(null);
      await loadCurrentTicket();
      await loadWaitingTickets();
      show('Талон завершено', 'success');
    } catch (err) {
      show(err instanceof Error ? err.message : 'Помилка при завершенні', 'error');
    } finally { setTicketLoading(false); }
  };

  const handleReject = async () => {
    if (!currentTicket) return;
    try {
      setTicketLoading(true);
      await apiClient.cancelTicket(currentTicket.id, 'Відхилено оператором');
      setCurrentTicket(null);
      setIsRejectConfirmOpen(false);
      await loadCurrentTicket();
      await loadWaitingTickets();
      show('Талон відхилено', 'success');
    } catch (err) {
      show(err instanceof Error ? err.message : 'Помилка при відхиленні', 'error');
    } finally { setTicketLoading(false); }
  };

  const handleRedirect = async () => {
    if (!currentTicket || !redirectServiceId) return;
    try {
      setTicketLoading(true);
      await apiClient.redirectTicket(currentTicket.id, redirectServiceId);
      setCurrentTicket(null);
      setIsRedirectModalOpen(false);
      setRedirectServiceId('');
      await loadCurrentTicket();
      await loadWaitingTickets();
      show('Талон перенаправлено', 'success');
    } catch (err) {
      show(err instanceof Error ? err.message : 'Помилка при перенаправленні', 'error');
    } finally { setTicketLoading(false); }
  };

  const ticketBorderClass: Partial<Record<TicketStatus, string>> = {
    [TicketStatus.WAITING]: 'border-yellow-500',
    [TicketStatus.CALLED]: 'border-blue-500',
    [TicketStatus.IN_PROGRESS]: 'border-green-500',
  };

  return (
    <>
      <Head><title>Моє вікно — SoftTurn</title></Head>

      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Моє вікно</h1>
            <p className="text-gray-400 mt-1">{operatorName}</p>
          </div>

          {shiftState === 'active' && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-900/40 border border-green-600">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-green-300 text-sm font-medium">
                  Зміна відкрита{activeWorkplace ? ` — Вікно №${activeWorkplace.number}` : ''}
                </span>
              </div>
              <button onClick={handleEndShift} disabled={shiftLoading} className="btn btn-danger">
                {shiftLoading ? <span className="spinner" /> : 'Закрити зміну'}
              </button>
            </div>
          )}
        </div>

        {shiftState === 'no-shift' && (
          <div className="card max-w-lg mx-auto mt-12 text-center">
            <h2 className="text-xl font-semibold text-white mb-2">Зміну не відкрито</h2>
            <p className="text-gray-400 mb-6">Оберіть робоче місце та відкрийте зміну.</p>

            <div className="form-group mb-4 text-left">
              <label className="form-label">Робоче місце</label>
              <select
                className="form-control"
                value={selectedWorkplaceId}
                onChange={(e) => setSelectedWorkplaceId(e.target.value)}
              >
                {workplaces.length === 0 && <option value="">Завантаження...</option>}
                {workplaces.map((wp) => (
                  <option key={wp.id} value={wp.id}>
                    №{wp.number}{wp.serviceName ? ` — ${wp.serviceName}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleStartShift}
              disabled={shiftLoading || !selectedWorkplaceId}
              className="btn btn-primary w-full"
            >
              {shiftLoading ? <span className="spinner" /> : 'Відкрити зміну'}
            </button>
          </div>
        )}

        {shiftState === 'active' && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white">Поточний талон</h2>

              {!currentTicket ? (
                <div className="card flex flex-col items-center justify-center py-16">
                  <p className="text-gray-400 mb-6">Немає активного талона</p>
                  <button onClick={handleCallNext} disabled={ticketLoading} className="btn btn-primary text-lg px-8 py-3">
                    {ticketLoading ? <span className="spinner" /> : 'Викликати наступного'}
                  </button>
                </div>
              ) : (
                <div className={`card border-2 ${ticketBorderClass[currentTicket.status as TicketStatus] ?? 'border-gray-500'}`}>
                  <div className="text-center mb-6">
                    <div className="text-7xl font-bold text-white mb-2">№{currentTicket.number}</div>
                    <span className={`badge ${getTicketStatusColor(currentTicket.status as TicketStatus)} text-sm px-4 py-1`}>
                      {getTicketStatusLabel(currentTicket.status as TicketStatus)}
                    </span>
                  </div>

                  <dl className="grid grid-cols-2 gap-3 text-sm mb-6">
                    {currentTicket.serviceName && (
                      <><dt className="text-gray-400">Послуга</dt><dd className="text-white font-medium">{currentTicket.serviceName}</dd></>
                    )}
                    {currentTicket.clientPhone && (
                      <><dt className="text-gray-400">Телефон</dt><dd className="text-white">{currentTicket.clientPhone}</dd></>
                    )}
                    {currentTicket.createdAt && (
                      <><dt className="text-gray-400">Створено</dt><dd className="text-white">{formatDateTime(currentTicket.createdAt)}</dd></>
                    )}
                    {currentTicket.startedAt && (
                      <><dt className="text-gray-400">Розпочато</dt><dd className="text-white">{formatDateTime(currentTicket.startedAt)}</dd></>
                    )}
                  </dl>

                  <div className="space-y-3">
                    {currentTicket.status === TicketStatus.CALLED && (
                      <button onClick={handleStartServicing} disabled={ticketLoading} className="btn btn-primary w-full">
                        {ticketLoading ? <span className="spinner" /> : 'Почати обслуговування'}
                      </button>
                    )}
                    {currentTicket.status === TicketStatus.IN_PROGRESS && (
                      <button onClick={handleComplete} disabled={ticketLoading} className="btn btn-success w-full">
                        {ticketLoading ? <span className="spinner" /> : 'Завершити'}
                      </button>
                    )}
                    {hasActiveTicket && (
                      <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => setIsRedirectModalOpen(true)} disabled={ticketLoading} className="btn btn-secondary">
                          Перенаправити
                        </button>
                        <button onClick={() => setIsRejectConfirmOpen(true)} disabled={ticketLoading} className="btn btn-danger">
                          Відхилити
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white">Черга і виклик</h2>

              <div className="card space-y-3">
                {callBlockedReason && (
                  <div className="rounded-md border border-amber-700 bg-amber-900/30 px-3 py-2 text-sm text-amber-200">
                    {callBlockedReason}
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Фільтр послуги</label>
                  <select
                    className="form-control"
                    value={nextServiceId}
                    onChange={(e) => setNextServiceId(e.target.value)}
                    disabled={ticketLoading || hasActiveTicket}
                  >
                    <option value="">Усі дозволені послуги</option>
                    {availableServices.map((service) => (
                      <option key={service.id} value={service.id}>{service.name}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleCallNext}
                  disabled={ticketLoading || hasActiveTicket}
                  title={callBlockedReason ?? ''}
                  className={`btn btn-primary w-full text-base py-3 ${
                    hasActiveTicket ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                >
                  {ticketLoading ? <span className="spinner" /> : 'Викликати наступного'}
                </button>
                <button
                  onClick={() => {
                    void loadCurrentShift();
                    void loadCurrentTicket();
                    void loadWaitingTickets();
                  }}
                  disabled={ticketLoading || queueLoading}
                  className="btn btn-secondary w-full"
                >
                  Оновити статус
                </button>
              </div>

              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">У черзі</h3>
                  <span className="badge bg-slate-700 text-white">{filteredWaitingTickets.length}</span>
                </div>

                <div className="max-h-[420px] overflow-auto space-y-2 pr-1">
                  {queueLoading && (
                    <div className="text-sm text-gray-400">Завантаження черги...</div>
                  )}
                  {!queueLoading && filteredWaitingTickets.length === 0 && (
                    <div className="text-sm text-gray-400">Талонів у черзі немає</div>
                  )}
                  {!queueLoading && filteredWaitingTickets.map((ticket) => (
                    <div key={ticket.id} className="border border-slate-700 rounded-lg p-3 bg-slate-900/40">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-white font-semibold">№{ticket.number}</div>
                          <div className="text-xs text-gray-400">
                            {ticket.serviceName || 'Послуга'} · {formatDateTime(ticket.createdAt)}
                          </div>
                        </div>
                        <button
                          onClick={() => { void handleCallSpecific(ticket); }}
                          disabled={ticketLoading || hasActiveTicket}
                          title={callBlockedReason ?? ''}
                          className={`btn btn-primary px-3 py-1 text-sm ${
                            hasActiveTicket ? 'opacity-60 cursor-not-allowed' : ''
                          }`}
                        >
                          Викликати
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white">Стан вікна</h2>

              <div className="card">
                <h3 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wide">Зміна</h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-400">Оператор</dt>
                    <dd className="text-white">{operatorName}</dd>
                  </div>
                  {activeWorkplace && (
                    <div className="flex justify-between">
                      <dt className="text-gray-400">Вікно №</dt>
                      <dd className="text-white">{activeWorkplace.number}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-gray-400">Статус</dt>
                    <dd className="text-green-400 font-medium">Активна</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-400">Активний талон</dt>
                    <dd className="text-white">{currentTicket ? `№${currentTicket.number}` : 'Немає'}</dd>
                  </div>
                </dl>
              </div>

              <div className="card bg-blue-900/20 border border-blue-800">
                <h3 className="text-sm font-semibold text-blue-300 mb-2">Порядок роботи</h3>
                <ol className="text-sm text-gray-400 space-y-1 list-decimal list-inside">
                  <li>Викличте наступного або конкретний талон з черги</li>
                  <li>Натисніть «Почати обслуговування» коли клієнт підійшов</li>
                  <li>Натисніть «Завершити» після надання послуги</li>
                  <li>За потреби — перенаправте або відхиліть талон</li>
                </ol>
              </div>
            </div>
          </div>
        )}
      </div>

      <Modal
        isOpen={isRedirectModalOpen}
        onClose={() => { setIsRedirectModalOpen(false); setRedirectServiceId(''); }}
        title="Перенаправити талон"
        onConfirm={handleRedirect}
        confirmText="Перенаправити"
        isLoading={ticketLoading}
      >
        <div className="space-y-4">
          <p className="text-gray-600 text-sm">
            Оберіть послугу для перенаправлення талона №{currentTicket?.number}.
          </p>
          <div className="form-group">
            <label className="form-label">Послуга</label>
            <select className="form-control" value={redirectServiceId} onChange={(e) => setRedirectServiceId(e.target.value)}>
              <option value="">— Оберіть послугу —</option>
              {availableServices.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={isRejectConfirmOpen}
        title="Відхилити талон"
        message={`Ви впевнені, що хочете відхилити талон №${currentTicket?.number} як не обслужений?`}
        onConfirm={handleReject}
        onCancel={() => setIsRejectConfirmOpen(false)}
        isDangerous
        isLoading={ticketLoading}
      />
    </>
  );
}

export default withDashboard(OperatorPage);
