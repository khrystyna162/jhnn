import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useAuthStore } from '@/store/authStore';
import apiClient from '@/services/api';
import { Ticket, TicketStatus } from '@/types';
import { formatDateTime } from '@/utils/formatters';

export default function UserHomePage() {
  const router = useRouter();
  const { user, accessToken, logout } = useAuthStore();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isTicketsLoading, setIsTicketsLoading] = useState(true);
  const [ticketsError, setTicketsError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken || !user) {
      void router.replace('/user-login');
    }
  }, [accessToken, user, router]);

  useEffect(() => {
    if (!accessToken || !user) return;

    const loadTickets = async () => {
      try {
        setIsTicketsLoading(true);
        setTicketsError(null);
        const response = await apiClient.getTickets({ page: 1, limit: 30, scope: 'operator' });
        setTickets(response.data);
      } catch {
        setTicketsError('Не вдалося завантажити талони');
      } finally {
        setIsTicketsLoading(false);
      }
    };

    void loadTickets();
  }, [accessToken, user]);

  const handleLogout = async () => {
    await logout();
    await router.push('/user-login');
  };

  if (!accessToken || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="spinner" />
      </div>
    );
  }

  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
    || (user as { fullName?: string }).fullName
    || user.email
    || 'Користувач';

  const myTickets = useMemo(
    () => [...tickets].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [tickets],
  );

  const activeQueueTickets = useMemo(
    () => myTickets.filter((ticket) => [TicketStatus.WAITING, TicketStatus.CALLED, TicketStatus.IN_PROGRESS].includes(ticket.status)),
    [myTickets],
  );

  const historyTickets = useMemo(
    () => myTickets.filter((ticket) => [TicketStatus.COMPLETED, TicketStatus.CANCELLED, TicketStatus.REDIRECTED].includes(ticket.status)).slice(0, 10),
    [myTickets],
  );

  const queueStatusLabel = (status: TicketStatus) => {
    switch (status) {
      case TicketStatus.WAITING:
        return 'Очікує';
      case TicketStatus.CALLED:
        return 'Викликано';
      case TicketStatus.IN_PROGRESS:
        return 'В роботі';
      default:
        return status;
    }
  };

  const historyStatusLabel = (status: TicketStatus) => {
    switch (status) {
      case TicketStatus.COMPLETED:
        return 'Завершено';
      case TicketStatus.CANCELLED:
        return 'Скасовано';
      case TicketStatus.REDIRECTED:
        return 'Перенаправлено';
      default:
        return status;
    }
  };

  return (
    <>
      <Head>
        <title>Кабінет користувача - SoftTurn</title>
      </Head>

      <div className="min-h-screen bg-slate-50">
        <header className="border-b border-slate-200 bg-white">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Кабінет користувача</h1>
              <p className="text-sm text-slate-600">Ви увійшли в персональний розділ</p>
            </div>
            <button className="btn btn-white" onClick={() => void handleLogout()}>
              Вийти
            </button>
          </div>
        </header>

        <main className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
          <section className="card">
            <h2 className="text-lg font-semibold text-gray-900">Профіль</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2 text-sm">
              <div>
                <p className="text-gray-500">Ім'я</p>
                <p className="font-medium text-gray-900">{displayName}</p>
              </div>
              <div>
                <p className="text-gray-500">Пошта</p>
                <p className="font-medium text-gray-900">{user.email || 'Не вказано'}</p>
              </div>
            </div>
          </section>

          <section className="card">
            <h2 className="text-lg font-semibold text-gray-900">Що далі</h2>
            <p className="text-gray-600 mt-2">
              Це базова сторінка звичайного користувача. Далі можна додати тут перегляд своїх талонів,
              статус черги або історію звернень.
            </p>
          </section>

          <section className="card">
            <h2 className="text-lg font-semibold text-gray-900">Мої талони</h2>
            {isTicketsLoading ? (
              <p className="text-gray-600 mt-2">Завантаження...</p>
            ) : ticketsError ? (
              <p className="text-red-600 mt-2">{ticketsError}</p>
            ) : myTickets.length === 0 ? (
              <p className="text-gray-600 mt-2">У вас ще немає талонів.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-500">
                      <th className="text-left py-2 pr-4">Номер</th>
                      <th className="text-left py-2 pr-4">Послуга</th>
                      <th className="text-left py-2 pr-4">Статус</th>
                      <th className="text-left py-2">Створено</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myTickets.slice(0, 10).map((ticket) => (
                      <tr key={ticket.id} className="border-b border-gray-100">
                        <td className="py-2 pr-4 font-medium text-gray-900">{ticket.number}</td>
                        <td className="py-2 pr-4 text-gray-700">{ticket.serviceName || '—'}</td>
                        <td className="py-2 pr-4 text-gray-700">{queueStatusLabel(ticket.status)}</td>
                        <td className="py-2 text-gray-500">{formatDateTime(ticket.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card">
            <h2 className="text-lg font-semibold text-gray-900">Статус черги</h2>
            {isTicketsLoading ? (
              <p className="text-gray-600 mt-2">Завантаження...</p>
            ) : activeQueueTickets.length === 0 ? (
              <p className="text-gray-600 mt-2">Зараз немає активних талонів у черзі.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {activeQueueTickets.slice(0, 5).map((ticket) => (
                  <div key={ticket.id} className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 flex items-center justify-between">
                    <span className="font-medium text-blue-900">{ticket.number}</span>
                    <span className="text-sm text-blue-800">{queueStatusLabel(ticket.status)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <h2 className="text-lg font-semibold text-gray-900">Історія звернень</h2>
            {isTicketsLoading ? (
              <p className="text-gray-600 mt-2">Завантаження...</p>
            ) : historyTickets.length === 0 ? (
              <p className="text-gray-600 mt-2">Історія звернень порожня.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {historyTickets.map((ticket) => (
                  <div key={ticket.id} className="rounded-md border border-gray-200 px-3 py-2 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{ticket.number}</p>
                      <p className="text-xs text-gray-500">{ticket.serviceName || '—'} • {formatDateTime(ticket.createdAt)}</p>
                    </div>
                    <span className="text-sm text-gray-700">{historyStatusLabel(ticket.status)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </>
  );
}
