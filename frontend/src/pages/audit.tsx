import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { withDashboard } from '@/components/DashboardLayout';
import { DataTable, DataTableColumn } from '@/components/DataTable';
import apiClient from '@/services/api';
import { usePagination } from '@/hooks';
import { AuditLog } from '@/types';
import { formatDateTime } from '@/utils/formatters';
import { readPositiveIntQueryParam, readQueryParam, replaceShallowQuery } from '@/utils/urlQuery';
import { URL_QUERY_KEYS } from '@/utils/urlQueryKeys';

function AuditPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUrlReady, setIsUrlReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [entityFilter, setEntityFilter] = useState<string>('ALL');

  const [totalLogs, setTotalLogs] = useState(0);
  const pagination = usePagination(totalLogs, 25);
  const { currentPage, goToPage } = pagination;

  // Load audit logs
  const loadLogs = useCallback(async () => {
    if (!isUrlReady) return;

    try {
      setLoading(true);
      const params = {
        page: currentPage,
        limit: 25,
        ...(actionFilter !== 'ALL' && { action: actionFilter }),
        ...(entityFilter !== 'ALL' && { entity: entityFilter }),
      };
      const response = await apiClient.getAuditLogs(params);
      setLogs(response.data);
      setTotalLogs(response.total);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка при завантаженні логів');
    } finally {
      setLoading(false);
    }
  }, [actionFilter, currentPage, entityFilter, isUrlReady]);

  useEffect(() => {
    if (!router.isReady) return;

    const nextAction = readQueryParam(router.query, URL_QUERY_KEYS.action, 'ALL');
    const nextEntity = readQueryParam(router.query, URL_QUERY_KEYS.entity, 'ALL');
    const nextPage = readPositiveIntQueryParam(router.query, URL_QUERY_KEYS.page, 1);

    setActionFilter(nextAction || 'ALL');
    setEntityFilter(nextEntity || 'ALL');
    goToPage(nextPage);
    setIsUrlReady(true);
  }, [goToPage, router.isReady, router.query]);

  useEffect(() => {
    if (!router.isReady || !isUrlReady) return;

    const nextQuery: Record<string, string> = {};
    if (actionFilter !== 'ALL') {
      nextQuery[URL_QUERY_KEYS.action] = actionFilter;
    }
    if (entityFilter !== 'ALL') {
      nextQuery[URL_QUERY_KEYS.entity] = entityFilter;
    }
    if (currentPage > 1) {
      nextQuery[URL_QUERY_KEYS.page] = String(currentPage);
    }

    void replaceShallowQuery(router, nextQuery);
  }, [actionFilter, currentPage, entityFilter, isUrlReady, router]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const getActionBadgeColor = (action: string) => {
    const colorMap: Record<string, string> = {
      CREATE: 'badge-success',
      READ: 'badge-info',
      UPDATE: 'badge-warning',
      DELETE: 'badge-danger',
      LOGIN: 'badge-success',
      LOGOUT: 'badge-secondary',
    };
    return colorMap[action] || 'badge-secondary';
  };

  const columns: DataTableColumn<AuditLog>[] = [
    {
      key: 'createdAt',
      label: 'Час',
      width: '180px',
      render: (value) => formatDateTime(new Date(value)),
    },
    {
      key: 'action',
      label: 'Дія',
      width: '100px',
      render: (action) => <span className={`badge ${getActionBadgeColor(action as string)}`}>{action}</span>,
    },
    {
      key: 'entity',
      label: 'Сутність',
      width: '120px',
    },
    {
      key: 'entityId',
      label: 'ID',
      width: '150px',
      render: (value) => (
        <code className="text-xs bg-gray-100 px-2 py-1 rounded">{value}</code>
      ),
    },
    {
      key: 'userId',
      label: 'Користувач',
      render: (_, log) => `${log.userEmail || log.userId}`,
    },
    {
      key: 'changes',
      label: 'Деталі',
      render: (changes) => {
        if (!changes || typeof changes === 'string') return '-';
        return (
          <details className="cursor-pointer">
            <summary className="text-xs text-blue-600 hover:underline">Переглянути</summary>
            <pre className="text-xs bg-gray-50 p-2 mt-2 rounded border border-gray-200 overflow-auto max-h-64">
              {JSON.stringify(changes, null, 2)}
            </pre>
          </details>
        );
      },
    },
  ];

  const uniqueActions = ['CREATE', 'READ', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT'];
  const uniqueEntities = ['TICKET', 'USER', 'WORKPLACE', 'SERVICE', 'TEMPLATE', 'ORGANIZATION'];

  return (
    <>
      <Head>
        <title>Журнал аудиту - SoftTurn</title>
      </Head>

      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Журнал аудиту</h1>
          <p className="text-gray-600 mt-2">Реєстрація всіх дій користувачів у системі</p>
        </div>

        {/* Filters */}
        <div className="card">
          <div className="flex gap-4 flex-wrap">
            <div>
              <label className="text-sm font-semibold text-gray-700">Дія</label>
              <select
                value={actionFilter}
                onChange={(e) => {
                  setActionFilter(e.target.value);
                  goToPage(1);
                }}
                className="form-select mt-2"
              >
                <option value="ALL">Усі дії</option>
                {uniqueActions.map((action) => (
                  <option key={action} value={action}>
                    {action}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700">Сутність</label>
              <select
                value={entityFilter}
                onChange={(e) => {
                  setEntityFilter(e.target.value);
                  goToPage(1);
                }}
                className="form-select mt-2"
              >
                <option value="ALL">Усі сутності</option>
                {uniqueEntities.map((entity) => (
                  <option key={entity} value={entity}>
                    {entity}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700">Разом записів</label>
              <p className="text-2xl font-bold text-blue-600 mt-2">{totalLogs}</p>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="alert alert-error">
            <p>{error}</p>
            <button
              onClick={loadLogs}
              className="mt-2 text-sm underline hover:no-underline"
            >
              Спробувати ще раз
            </button>
          </div>
        )}

        {/* Logs Table */}
        <div className="card">
          <DataTable<AuditLog>
            columns={columns}
            data={logs}
            rowKey="id"
            loading={loading}
            emptyMessage="Немає записів"
            pagination={{
              total: totalLogs,
              pageSize: 25,
              currentPage: pagination.currentPage,
              onPageChange: (page) => pagination.goToPage(page),
            }}
          />
        </div>
      </div>
    </>
  );
}

export default withDashboard(AuditPage);
