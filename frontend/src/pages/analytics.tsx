import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { withDashboard } from '@/components/DashboardLayout';
import { useToast } from '@/components/Toast';
import { Users, Clock, Hourglass, Download } from 'lucide-react';
import apiClient from '@/services/api';
import { KPISummary, DashboardMetrics, WaitingTimeStats, ServiceTimeStats, OperatorRating } from '@/types';
import { formatDuration, formatDateTime } from '@/utils/formatters';
import { readEnumQueryParam, replaceShallowQuery } from '@/utils/urlQuery';
import { URL_QUERY_KEYS } from '@/utils/urlQueryKeys';

type Tab = 'summary' | 'operators' | 'service-time' | 'waiting-time';

function AnalyticsPage() {
  const router = useRouter();
  const { show: showToast } = useToast();
  const [kpi, setKpi] = useState<KPISummary | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUrlReady, setIsUrlReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month'>('month');
  const [exportLoading, setExportLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('summary');

  // Detailed analytics state
  const [waitingTime, setWaitingTime] = useState<WaitingTimeStats[]>([]);
  const [serviceTime, setServiceTime] = useState<ServiceTimeStats[]>([]);
  const [operatorsRating, setOperatorsRating] = useState<OperatorRating[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Load analytics data
  const loadAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const [kpiData, metricsData] = await Promise.all([
        apiClient.getKPISummary(),
        apiClient.getDashboardMetrics(),
      ]);
      setKpi(kpiData);
      setMetrics(metricsData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка при завантаженні аналітики');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadWaitingTime = useCallback(async () => {
    setDetailLoading(true);
    try {
      const data = await apiClient.getWaitingTime();
      setWaitingTime(data);
    } catch { /* ignore */ } finally { setDetailLoading(false); }
  }, []);

  const loadServiceTime = useCallback(async () => {
    setDetailLoading(true);
    try {
      const data = await apiClient.getServiceTime();
      setServiceTime(data);
    } catch { /* ignore */ } finally { setDetailLoading(false); }
  }, []);

  const loadOperatorsRating = useCallback(async () => {
    setDetailLoading(true);
    try {
      const data = await apiClient.getOperatorsRating();
      setOperatorsRating(data);
    } catch { /* ignore */ } finally { setDetailLoading(false); }
  }, []);

  useEffect(() => {
    if (!router.isReady) return;

    const nextRange = readEnumQueryParam(router.query, URL_QUERY_KEYS.range, ['today', 'week', 'month'] as const, 'month');
    const nextTab = readEnumQueryParam(router.query, URL_QUERY_KEYS.tab, ['summary', 'operators', 'service-time', 'waiting-time'] as const, 'summary');

    setDateRange(nextRange);
    setActiveTab(nextTab);
    setIsUrlReady(true);
  }, [router.isReady, router.query]);

  useEffect(() => {
    if (!router.isReady || !isUrlReady) return;

    const nextQuery: Record<string, string> = {};
    if (dateRange !== 'month') {
      nextQuery[URL_QUERY_KEYS.range] = dateRange;
    }
    if (activeTab !== 'summary') {
      nextQuery[URL_QUERY_KEYS.tab] = activeTab;
    }

    void replaceShallowQuery(router, nextQuery);
  }, [activeTab, dateRange, isUrlReady, router]);

  useEffect(() => {
    if (!isUrlReady) return;
    loadAnalytics();
  }, [dateRange, isUrlReady, loadAnalytics]);

  // Load detailed analytics when tab changes
  useEffect(() => {
    if (activeTab === 'waiting-time' && waitingTime.length === 0) {
      loadWaitingTime();
    } else if (activeTab === 'service-time' && serviceTime.length === 0) {
      loadServiceTime();
    } else if (activeTab === 'operators' && operatorsRating.length === 0) {
      loadOperatorsRating();
    }
  }, [
    activeTab,
    waitingTime.length,
    serviceTime.length,
    operatorsRating.length,
    loadWaitingTime,
    loadServiceTime,
    loadOperatorsRating,
  ]);

  const handleExport = async () => {
    try {
      setExportLoading(true);
      const data = await apiClient.getAnalyticsExport({
        format: 'csv',
        dateRange,
      });

      // Create blob and download
      const blob = new Blob([data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      showToast('Помилка при експорті: ' + (err instanceof Error ? err.message : ''), 'error');
    } finally {
      setExportLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-gray-600">Завантаження аналітики...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <p>{error}</p>
        <button onClick={loadAnalytics} className="mt-2 text-sm underline">
          Спробувати ще раз
        </button>
      </div>
    );
  }

  const completionPercentage = kpi
    ? Math.round((kpi.completedTickets / kpi.totalTickets) * 100) || 0
    : 0;

  return (
    <>
      <Head>
        <title>Аналітика - SoftTurn</title>
      </Head>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Аналітика</h1>
            <p className="text-gray-600 mt-2">Детальні звіти та KPI</p>
          </div>
          <button onClick={handleExport} className="btn btn-primary inline-flex items-center gap-2" disabled={exportLoading}>
            {exportLoading ? (
              <>
                <span className="spinner inline-block h-4 w-4"></span>
                Експортую...
              </>
            ) : (
              <>
                <Download size={16} />
                Експорт CSV
              </>
            )}
          </button>
        </div>

        {/* Date Range Filter */}
        <div className="card">
          <label className="text-sm font-semibold text-gray-700">Період</label>
          <div className="flex gap-2 mt-3">
            {(['today', 'week', 'month'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-4 py-2 rounded font-medium transition ${
                  dateRange === range
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {range === 'today'
                  ? 'Сьогодні'
                  : range === 'week'
                    ? 'Цей тиждень'
                    : 'Цей місяць'}
              </button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex gap-1">
            {([
              { id: 'summary', label: 'Зведення' },
              { id: 'operators', label: '👤 Рейтинг операторів' },
              { id: 'service-time', label: '⏱️ Час обслуговування' },
              { id: 'waiting-time', label: '⌛ Час очікування' },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* ── Summary Tab ──────────────────────────────────────────────── */}
        {activeTab === 'summary' && (
          <>
        {/* Main KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Tickets */}
          <div className="card">
            <p className="text-gray-600 text-sm">Всього талонів</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{kpi?.totalTickets || 0}</p>
            <div className="mt-4 text-xs text-gray-500 space-y-1">
              <p>Завершено: {kpi?.completedTickets || 0}</p>
              <p>Скасовано: {kpi?.cancelledTickets || 0}</p>
              <p>↝ Перенаправлено: {kpi?.redirectedTickets || 0}</p>
            </div>
          </div>

          {/* Completion Rate */}
          <div className="card">
            <p className="text-gray-600 text-sm">Коефіцієнт завершення</p>
            <p className="text-3xl font-bold text-green-600 mt-2">{completionPercentage}%</p>
            <div className="mt-4">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all"
                  style={{ width: `${completionPercentage}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Avg Waiting Time */}
          <div className="card">
            <p className="text-gray-600 text-sm">Середній час очікування</p>
            <p className="text-3xl font-bold text-blue-600 mt-2">
              {kpi?.avgWaitingTime ? formatDuration(kpi.avgWaitingTime) : '-'}
            </p>
            <div className="mt-4 text-xs text-gray-500 space-y-1">
              <p>За період: {kpi?.period}</p>
            </div>
          </div>

          {/* Avg Service Time */}
          <div className="card">
            <p className="text-gray-600 text-sm">Середній час обслуговування</p>
            <p className="text-3xl font-bold text-orange-600 mt-2">
              {kpi?.avgServiceTime ? formatDuration(kpi.avgServiceTime) : '-'}
            </p>
            <div className="mt-4 text-xs text-gray-500 space-y-1">
              <p>Min: {kpi?.minServiceTime ? formatDuration(kpi.minServiceTime) : '-'}</p>
              <p>Max: {kpi?.maxServiceTime ? formatDuration(kpi.maxServiceTime) : '-'}</p>
            </div>
          </div>
        </div>

        {/* Detailed Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Service Performance */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Продуктивність послуг</h3>
            </div>
            {metrics?.currentQueues && Object.entries(metrics.currentQueues).length > 0 ? (
              <div className="space-y-4">
                {Object.entries(metrics.currentQueues).map(([serviceName, count]) => (
                  <div key={serviceName} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <span className="text-gray-700">{serviceName}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{
                            width: `${Math.min((count / Math.max(...Object.values(metrics.currentQueues))) * 100, 100)}%`,
                          }}
                        ></div>
                      </div>
                      <span className="font-semibold text-gray-900 w-12 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">Немає даних</p>
            )}
          </div>

          {/* System Health */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Статус системи</h3>
            </div>
            <div className="space-y-4">
              <div className="p-4 bg-green-50 rounded border border-green-200">
                <p className="text-green-800 font-semibold">Система працює нормально</p>
                <p className="text-xs text-green-600 mt-1">Активних операторів: {metrics?.activeOperators || 0}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded text-sm text-gray-700 space-y-1">
                <p>Час збору даних: {formatDateTime(new Date())}</p>
                <p>Період: {kpi?.period}</p>
                <p>Активні оператори: {metrics?.activeOperators || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Time Analysis */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Аналіз часу</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded border border-blue-200">
              <p className="text-sm text-gray-700">Мін. час обслуговування</p>
              <p className="text-2xl font-bold text-blue-600 mt-2">
                {kpi?.minServiceTime ? formatDuration(kpi.minServiceTime) : '-'}
              </p>
            </div>
            <div className="p-4 bg-orange-50 rounded border border-orange-200">
              <p className="text-sm text-gray-700">Макс. час обслуговування</p>
              <p className="text-2xl font-bold text-orange-600 mt-2">
                {kpi?.maxServiceTime ? formatDuration(kpi.maxServiceTime) : '-'}
              </p>
            </div>
            <div className="p-4 bg-purple-50 rounded border border-purple-200">
              <p className="text-sm text-gray-700">Середній час обслуговування</p>
              <p className="text-2xl font-bold text-purple-600 mt-2">
                {kpi?.avgServiceTime ? formatDuration(kpi.avgServiceTime) : '-'}
              </p>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="card bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200">
          <h3 className="font-bold text-lg text-gray-900 mb-4">Підсумок періоду</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Період</p>
              <p className="font-semibold text-gray-900">{kpi?.period || '-'}</p>
            </div>
            <div>
              <p className="text-gray-600">Завершено</p>
              <p className="font-semibold text-green-600">{kpi?.completedTickets || 0}</p>
            </div>
            <div>
              <p className="text-gray-600">Скасовано</p>
              <p className="font-semibold text-red-600">{kpi?.cancelledTickets || 0}</p>
            </div>
            <div>
              <p className="text-gray-600">Перенаправлено</p>
              <p className="font-semibold text-orange-600">{kpi?.redirectedTickets || 0}</p>
            </div>
          </div>
        </div>
          </>
        )}

        {/* ── Operators Rating Tab ──────────────────────────────────────── */}
        {activeTab === 'operators' && (
          <div className="card">
            <div className="card-header mb-4">
              <h3 className="card-title">Рейтинг операторів</h3>
              <button onClick={loadOperatorsRating} className="btn btn-secondary text-sm">Оновити</button>
            </div>
            {detailLoading ? (
              <div className="flex justify-center py-12"><span className="spinner" /></div>
            ) : operatorsRating.length === 0 ? (
              <p className="text-gray-500 text-center py-12">Немає даних за обраний період</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 text-gray-600 font-medium">#</th>
                      <th className="text-left py-2 px-3 text-gray-600 font-medium">Оператор</th>
                      <th className="text-right py-2 px-3 text-gray-600 font-medium">Завершено</th>
                      <th className="text-right py-2 px-3 text-gray-600 font-medium">Сер. час обслуг.</th>
                      <th className="py-2 px-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...operatorsRating]
                      .sort((a, b) => b.completed - a.completed)
                      .map((op, idx) => {
                        const maxCompleted = Math.max(...operatorsRating.map((o) => o.completed), 1);
                        const barWidth = Math.round((op.completed / maxCompleted) * 100);
                        return (
                          <tr key={op.operatorId} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-3 px-3 text-gray-500">{idx + 1}</td>
                            <td className="py-3 px-3 font-medium text-gray-900">{op.operatorName}</td>
                            <td className="py-3 px-3 text-right font-bold text-green-600">{op.completed}</td>
                            <td className="py-3 px-3 text-right text-gray-700">
                              {op.avgServiceSeconds ? formatDuration(op.avgServiceSeconds) : '—'}
                            </td>
                            <td className="py-3 px-3 w-32">
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-blue-500 h-2 rounded-full"
                                  style={{ width: `${barWidth}%` }}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Service Time Tab ──────────────────────────────────────────── */}
        {activeTab === 'service-time' && (
          <div className="card">
            <div className="card-header mb-4">
              <h3 className="card-title">Час обслуговування по послугах</h3>
              <button onClick={loadServiceTime} className="btn btn-secondary text-sm">Оновити</button>
            </div>
            {detailLoading ? (
              <div className="flex justify-center py-12"><span className="spinner" /></div>
            ) : serviceTime.length === 0 ? (
              <p className="text-gray-500 text-center py-12">Немає даних за обраний період</p>
            ) : (
              <div className="space-y-4">
                {[...serviceTime]
                  .sort((a, b) => b.avgServiceSeconds - a.avgServiceSeconds)
                  .map((row) => {
                    const maxSec = Math.max(...serviceTime.map((s) => s.avgServiceSeconds), 1);
                    const barWidth = Math.round((row.avgServiceSeconds / maxSec) * 100);
                    return (
                      <div key={row.serviceId} className="flex items-center gap-4">
                        <div className="w-48 text-sm text-gray-700 truncate" title={row.serviceName}>
                          {row.serviceName}
                        </div>
                        <div className="flex-1 bg-gray-200 rounded-full h-4 relative">
                          <div
                            className="bg-orange-500 h-4 rounded-full"
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <div className="w-24 text-right text-sm">
                          <span className="font-bold text-orange-600">{formatDuration(row.avgServiceSeconds)}</span>
                          <span className="text-gray-400 ml-1">({row.ticketCount})</span>
                        </div>
                      </div>
                    );
                  })}
                <p className="text-xs text-gray-400 mt-2">* В дужках — кількість талонів</p>
              </div>
            )}
          </div>
        )}

        {/* ── Waiting Time Tab ──────────────────────────────────────────── */}
        {activeTab === 'waiting-time' && (
          <div className="card">
            <div className="card-header mb-4">
              <h3 className="card-title">Час очікування по годинах</h3>
              <button onClick={loadWaitingTime} className="btn btn-secondary text-sm">Оновити</button>
            </div>
            {detailLoading ? (
              <div className="flex justify-center py-12"><span className="spinner" /></div>
            ) : waitingTime.length === 0 ? (
              <p className="text-gray-500 text-center py-12">Немає даних за обраний період</p>
            ) : (
              <div>
                {/* Bar chart */}
                <div className="flex items-end gap-1 h-40 mb-4">
                  {Array.from({ length: 24 }, (_, h) => {
                    const row = waitingTime.find((w) => w.hour === h);
                    const maxSec = Math.max(...waitingTime.map((w) => w.avgWaitingSeconds), 1);
                    const heightPct = row ? Math.round((row.avgWaitingSeconds / maxSec) * 100) : 0;
                    return (
                      <div
                        key={h}
                        className="flex-1 flex flex-col items-center justify-end"
                        title={row ? `${h}:00 — ${formatDuration(row.avgWaitingSeconds)} (${row.ticketCount} талонів)` : `${h}:00 — немає даних`}
                      >
                        <div
                          className="w-full rounded-t-sm bg-blue-500 opacity-80 hover:opacity-100 transition-opacity"
                          style={{ height: `${heightPct}%`, minHeight: heightPct > 0 ? '4px' : '0' }}
                        />
                        <span className="text-xs text-gray-400 mt-1">{h}</span>
                      </div>
                    );
                  })}
                </div>
                {/* Legend */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-3 text-gray-600 font-medium">Година</th>
                        <th className="text-right py-2 px-3 text-gray-600 font-medium">Сер. час очікування</th>
                        <th className="text-right py-2 px-3 text-gray-600 font-medium">Кількість талонів</th>
                      </tr>
                    </thead>
                    <tbody>
                      {waitingTime.map((row) => (
                        <tr key={row.hour} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-2 px-3 text-gray-700">{row.hour}:00 – {row.hour + 1}:00</td>
                          <td className="py-2 px-3 text-right font-medium text-blue-600">{formatDuration(row.avgWaitingSeconds)}</td>
                          <td className="py-2 px-3 text-right text-gray-700">{row.ticketCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export default withDashboard(AnalyticsPage);
