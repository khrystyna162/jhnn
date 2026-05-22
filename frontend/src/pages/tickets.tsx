import { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { withDashboard } from '@/components/DashboardLayout';
import { DataTable, DataTableColumn } from '@/components/DataTable';
import { Modal } from '@/components/Modal';
import { PageHeader } from '@/components/PageHeader';
import { TicketForm } from '@/components/TicketForm';
import { TicketDetail } from '@/components/TicketDetail';
import { useToast } from '@/components/Toast';
import apiClient from '@/services/api';
import { usePagination } from '@/hooks';
import { useAuthStore } from '@/store/authStore';
import { Plus, RefreshCcw } from 'lucide-react';
import { Branch, Role, Ticket, TicketStatus } from '@/types';
import { formatDateTime, getTicketStatusLabel, getTicketStatusColor } from '@/utils/formatters';
import { readEnumQueryParam, readPositiveIntQueryParam, readQueryParam, replaceShallowQuery } from '@/utils/urlQuery';
import { URL_QUERY_KEYS } from '@/utils/urlQueryKeys';

function TicketsPage() {
  const router = useRouter();
  const { hasRole } = useAuthStore();
  const { show: showToast } = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUrlReady, setIsUrlReady] = useState(false);
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'ALL'>('ALL');
  const [branchFilter, setBranchFilter] = useState<string>('ALL');
  const [scopeFilter, setScopeFilter] = useState<'operator' | 'admin'>('admin');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAutoRefresh, setIsAutoRefresh] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [sortBy, setSortBy] = useState<keyof Ticket>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [totalTickets, setTotalTickets] = useState(0);
  const pagination = usePagination(totalTickets, 10);
  const { currentPage, goToPage } = pagination;
  const canUseScopeFilter = hasRole([Role.ADMIN, Role.SYSADMIN]);
  const activeScope = canUseScopeFilter ? scopeFilter : 'operator';

  // Load tickets
  const loadTickets = useCallback(async () => {
    if (!isUrlReady) return;

    try {
      setLoading(true);
      const params = {
        page: currentPage,
        limit: 10,
        scope: activeScope,
        ...(statusFilter !== 'ALL' && { status: statusFilter }),
        ...(branchFilter !== 'ALL' && { branchId: branchFilter }),
      };
      const response = await apiClient.getTickets(params);
      setTickets(response.data);
      setTotalTickets(response.total);
      setLastUpdatedAt(new Date());
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Помилка при завантаженні талонів', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeScope, branchFilter, currentPage, isUrlReady, statusFilter]);

  useEffect(() => {
    if (!router.isReady) return;

    const nextStatus = readEnumQueryParam(
      router.query,
      URL_QUERY_KEYS.status,
      ['ALL', TicketStatus.WAITING, TicketStatus.CALLED, TicketStatus.IN_PROGRESS, TicketStatus.COMPLETED, TicketStatus.CANCELLED, TicketStatus.REDIRECTED] as const,
      'ALL'
    );
    const nextBranch = readQueryParam(router.query, URL_QUERY_KEYS.branch, 'ALL');
    const nextScope = readEnumQueryParam(router.query, URL_QUERY_KEYS.scope, ['operator', 'admin'] as const, 'admin');
    const nextSearch = readQueryParam(router.query, URL_QUERY_KEYS.search, '');
    const nextPage = readPositiveIntQueryParam(router.query, URL_QUERY_KEYS.page, 1);

    setStatusFilter(nextStatus);
    setBranchFilter(nextBranch || 'ALL');
    if (canUseScopeFilter) {
      setScopeFilter(nextScope);
    }
    setSearchQuery(nextSearch);
    goToPage(nextPage);
    setIsUrlReady(true);
  }, [canUseScopeFilter, goToPage, router.isReady, router.query]);

  useEffect(() => {
    if (!router.isReady || !isUrlReady) return;

    const nextQuery: Record<string, string> = {};
    if (statusFilter !== 'ALL') {
      nextQuery[URL_QUERY_KEYS.status] = statusFilter;
    }
    if (branchFilter !== 'ALL') {
      nextQuery[URL_QUERY_KEYS.branch] = branchFilter;
    }
    if (canUseScopeFilter) {
      nextQuery[URL_QUERY_KEYS.scope] = scopeFilter;
    }
    if (searchQuery.trim()) {
      nextQuery[URL_QUERY_KEYS.search] = searchQuery.trim();
    }
    if (currentPage > 1) {
      nextQuery[URL_QUERY_KEYS.page] = String(currentPage);
    }

    void replaceShallowQuery(router, nextQuery);
  }, [branchFilter, canUseScopeFilter, currentPage, isUrlReady, router, scopeFilter, searchQuery, statusFilter]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    if (!isAutoRefresh) return;

    const timer = window.setInterval(() => {
      void loadTickets();
    }, 15000);

    return () => {
      window.clearInterval(timer);
    };
  }, [isAutoRefresh, loadTickets]);

  useEffect(() => {
    const loadBranches = async () => {
      try {
        const data = await apiClient.getBranches();
        setBranches(data);
      } catch {
        setBranches([]);
      }
    };

    void loadBranches();
  }, []);

  const handleCreateTicket = async (data: {
    phone: string;
    serviceTypeId: string;
    branchId: string;
  }) => {
    try {
      setIsCreating(true);
      await apiClient.createTicket(data);
      showToast('Талон створено', 'success');
      await loadTickets();
      setIsCreateModalOpen(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Помилка при створенні талона', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const filteredTickets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return tickets;

    return tickets.filter((ticket) => {
      const values = [
        ticket.number,
        ticket.clientPhone,
        ticket.serviceName,
        ticket.branchName,
        ticket.operatorName,
      ];

      return values.some((value) => String(value ?? '').toLowerCase().includes(query));
    });
  }, [searchQuery, tickets]);

  const sortedTickets = useMemo(() => {
    const items = [...filteredTickets];
    items.sort((a, b) => {
      const left = a[sortBy];
      const right = b[sortBy];

      if (sortBy === 'createdAt' || sortBy === 'startedAt' || sortBy === 'completedAt') {
        const leftTime = left ? new Date(String(left)).getTime() : 0;
        const rightTime = right ? new Date(String(right)).getTime() : 0;
        return sortOrder === 'asc' ? leftTime - rightTime : rightTime - leftTime;
      }

      const leftValue = String(left ?? '').toLowerCase();
      const rightValue = String(right ?? '').toLowerCase();
      if (leftValue === rightValue) return 0;
      if (sortOrder === 'asc') return leftValue > rightValue ? 1 : -1;
      return leftValue < rightValue ? 1 : -1;
    });
    return items;
  }, [filteredTickets, sortBy, sortOrder]);

  const statusSummary = useMemo(
    () => ({
      waiting: filteredTickets.filter((ticket) => ticket.status === TicketStatus.WAITING).length,
      inProgress: filteredTickets.filter((ticket) => ticket.status === TicketStatus.IN_PROGRESS)
        .length,
      completed: filteredTickets.filter((ticket) => ticket.status === TicketStatus.COMPLETED).length,
      cancelled: filteredTickets.filter((ticket) => ticket.status === TicketStatus.CANCELLED).length,
    }),
    [filteredTickets],
  );

  const handleSort = (key: string) => {
    const typedKey = key as keyof Ticket;
    if (sortBy === typedKey) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortBy(typedKey);
    setSortOrder('asc');
  };

  const columns: DataTableColumn<Ticket>[] = [
    {
      key: 'number',
      label: '№ Талона',
      width: '80px',
      sortable: true,
    },
    {
      key: 'clientPhone',
      label: 'Телефон',
      width: '150px',
      sortable: true,
    },
    {
      key: 'serviceName',
      label: 'Послуга',
      sortable: true,
    },
    {
      key: 'branchName',
      label: 'Філія',
      sortable: true,
    },
    {
      key: 'status',
      label: 'Статус',
      width: '150px',
      render: (status: TicketStatus) => (
        <span className={`badge ${getTicketStatusColor(status)}`}>
          {getTicketStatusLabel(status)}
        </span>
      ),
    },
    {
      key: 'workplaceNumber',
      label: 'Робоче місце',
      width: '120px',
      render: (value) => value || '-',
    },
    {
      key: 'operatorName',
      label: 'Оператор',
      render: (value) => value || '-',
    },
    {
      key: 'createdAt',
      label: 'Час створення',
      width: '180px',
      sortable: true,
      render: (value) => formatDateTime(new Date(value)),
    },
  ];

  return (
    <>
      <Head>
        <title>Талони - SoftTurn</title>
      </Head>

      <div className="space-y-6">
        <PageHeader
          title="Талони"
          subtitle="Управління талонами та чергами"
          actions={(
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => void loadTickets()}
                className="btn btn-white inline-flex items-center gap-1.5"
                type="button"
              >
                <RefreshCcw size={15} />
                Оновити
              </button>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="btn btn-primary inline-flex items-center gap-1.5"
                type="button"
              >
                <Plus size={16} />
                Новий талон
              </button>
            </div>
          )}
        />

        {/* Filters */}
        <div className="card">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-semibold text-gray-700">Статус</label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as TicketStatus | 'ALL');
                  goToPage(1);
                }}
                className="form-select mt-2"
              >
                <option value="ALL">Всі статуси</option>
                <option value={TicketStatus.WAITING}>Очікування</option>
                <option value={TicketStatus.CALLED}>Викликано</option>
                <option value={TicketStatus.IN_PROGRESS}>Обслуговується</option>
                <option value={TicketStatus.COMPLETED}>Завершено</option>
                <option value={TicketStatus.CANCELLED}>Скасовано</option>
                <option value={TicketStatus.REDIRECTED}>Перенаправлено</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700">Філія</label>
              <select
                value={branchFilter}
                onChange={(e) => {
                  setBranchFilter(e.target.value);
                  goToPage(1);
                }}
                className="form-select mt-2"
              >
                <option value="ALL">Всі філії</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
            {canUseScopeFilter && (
              <div>
                <label className="text-sm font-semibold text-gray-700">Показувати</label>
                <select
                  value={scopeFilter}
                  onChange={(e) => {
                    setScopeFilter(e.target.value as 'operator' | 'admin');
                    goToPage(1);
                  }}
                  className="form-select mt-2"
                >
                  <option value="admin">Всі талони</option>
                  <option value="operator">Черга оператора</option>
                </select>
              </div>
            )}
            <div>
              <label className="text-sm font-semibold text-gray-700">Разом талонів</label>
              <p className="text-2xl font-bold text-blue-600 mt-2">{totalTickets}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-4">
            <div>
              <label className="text-sm font-semibold text-gray-700">Пошук</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  goToPage(1);
                }}
                className="form-input mt-2"
                placeholder="№ талона, телефон, послуга..."
              />
            </div>
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700">
                <input
                  type="checkbox"
                  checked={isAutoRefresh}
                  onChange={(e) => setIsAutoRefresh(e.target.checked)}
                />
                Автооновлення кожні 15 сек
              </label>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setStatusFilter('ALL');
                  setBranchFilter('ALL');
                  setSearchQuery('');
                  setIsAutoRefresh(false);
                  if (canUseScopeFilter) setScopeFilter('admin');
                  goToPage(1);
                }}
              >
                Скинути фільтри
              </button>
            </div>
            <div className="flex items-end justify-start xl:justify-end">
              <p className="text-sm text-gray-500">
                Оновлено: {lastUpdatedAt ? formatDateTime(lastUpdatedAt) : 'ще не завантажено'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            <div className="rounded border border-gray-200 bg-blue-50 px-3 py-2">
              <p className="text-xs uppercase text-blue-700">Очікують</p>
              <p className="text-xl font-bold text-blue-900">{statusSummary.waiting}</p>
            </div>
            <div className="rounded border border-gray-200 bg-yellow-50 px-3 py-2">
              <p className="text-xs uppercase text-yellow-700">В роботі</p>
              <p className="text-xl font-bold text-yellow-900">{statusSummary.inProgress}</p>
            </div>
            <div className="rounded border border-gray-200 bg-green-50 px-3 py-2">
              <p className="text-xs uppercase text-green-700">Завершені</p>
              <p className="text-xl font-bold text-green-900">{statusSummary.completed}</p>
            </div>
            <div className="rounded border border-gray-200 bg-red-50 px-3 py-2">
              <p className="text-xs uppercase text-red-700">Скасовані</p>
              <p className="text-xl font-bold text-red-900">{statusSummary.cancelled}</p>
            </div>
          </div>
        </div>

        {/* Tickets Table */}
        <div className="card">
          {searchQuery.trim() && (
            <p className="text-sm text-gray-600 mb-3">
              Знайдено: <span className="font-semibold">{sortedTickets.length}</span>
            </p>
          )}
          <DataTable<Ticket>
            columns={columns}
            data={sortedTickets}
            rowKey="id"
            loading={loading}
            emptyMessage="Немає талонів"
            pagination={{
              total: totalTickets,
              pageSize: 10,
              currentPage: pagination.currentPage,
              onPageChange: (page) => pagination.goToPage(page),
            }}
            onRowClick={(ticket) => {
              setSelectedTicket(ticket);
              setIsDetailModalOpen(true);
            }}
            sortBy={String(sortBy)}
            sortOrder={sortOrder}
            onSort={handleSort}
          />
        </div>
      </div>

      {/* Create Ticket Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Створити новий талон"
        size="md"
      >
        <TicketForm
          onSubmit={handleCreateTicket}
          isLoading={isCreating}
        />
      </Modal>

      {/* Ticket Detail Modal */}
      {selectedTicket && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedTicket(null);
          }}
          title={`Талон #${selectedTicket.number}`}
          size="lg"
        >
          <TicketDetail
            ticket={selectedTicket}
            onUpdate={(updated) => {
              setSelectedTicket(updated);
              setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
            }}
          />
        </Modal>
      )}
    </>
  );
}

export default withDashboard(TicketsPage);
