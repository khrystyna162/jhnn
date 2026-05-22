import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { withDashboard } from '@/components/DashboardLayout';
import apiClient from '@/services/api';
import { DashboardMetrics, KPISummary } from '@/types';
import { formatDuration } from '@/utils/formatters';
import { ArrowRight, Building2, RefreshCcw, Settings2, TicketPlus, Users, Wrench } from 'lucide-react';

function StatCard({
  label, value, sub, accent,
}: { label: string; value: string | number; sub?: ReactNode; accent?: string }) {
  const valueColor = accent === 'purple' ? 'text-violet-600' : accent === 'green' ? 'text-emerald-600' : accent === 'yellow' ? 'text-amber-500' : accent === 'red' ? 'text-red-600' : 'text-gray-900';
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1.5">{label}</div>
      <div className={`text-4xl font-bold leading-none mb-2 ${valueColor}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400">{sub}</div>}
    </div>
  );
}

function KpiRow({ label, value, color }: { label: string; value: string | number; color?: string }) {
  const valueColor = color === 'green' ? 'text-emerald-600' : color === 'red' ? 'text-red-600' : color === 'yellow' ? 'text-amber-500' : 'text-gray-800';
  return (
    <div className="flex items-center justify-between border-b border-gray-100 py-2.5 last:border-b-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm font-semibold ${valueColor}`}>{value}</span>
    </div>
  );
}

function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [kpi, setKpi] = useState<KPISummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [metricsData, kpiData] = await Promise.all([
        apiClient.getDashboardMetrics(),
        apiClient.getKPISummary(),
      ]);
      setMetrics(metricsData);
      setKpi(kpiData);
      setLastUpdatedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка при завантаженні даних');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" />
        <p className="text-sm text-gray-400">Завантаження...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
        {error}
      </div>
    );
  }

  const completionPct = metrics?.completionRate ? Math.round(metrics.completionRate * 100) : 0;
  const currentQueues = metrics?.currentQueues ?? {};
  const hasQueues = Object.keys(currentQueues).length > 0;
  const isEmptyDashboard = (kpi?.totalTickets ?? 0) === 0 && (metrics?.activeOperators ?? 0) === 0 && !hasQueues;

  return (
    <>
      <Head><title>Дашборд — SoftTurn</title></Head>

      <div className="mb-7 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Дашборд</h1>
          <p className="text-sm text-gray-500 mt-1">Огляд показників {kpi?.period ? `· ${kpi.period}` : ''}</p>
          <p className="text-xs text-gray-500 mt-1">
            Оновлено: {lastUpdatedAt ? lastUpdatedAt.toLocaleTimeString('uk-UA') : 'ще не оновлювалось'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void fetchData()}
          className="btn btn-white inline-flex items-center"
        >
          <RefreshCcw size={16} className="mr-2" />
          Оновити
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 mb-6">
        <Link href="/tickets" className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:border-blue-300 transition-colors">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-gray-900">Новий талон</div>
              <div className="text-xs text-gray-500 mt-1">Швидко перейти до створення</div>
            </div>
            <TicketPlus size={18} className="text-blue-600" />
          </div>
        </Link>
        <Link href="/workplaces" className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:border-blue-300 transition-colors">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-gray-900">Робочі місця</div>
              <div className="text-xs text-gray-500 mt-1">Призначення послуг по філіях</div>
            </div>
            <Building2 size={18} className="text-blue-600" />
          </div>
        </Link>
        <Link href="/users" className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:border-blue-300 transition-colors">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-gray-900">Користувачі</div>
              <div className="text-xs text-gray-500 mt-1">Ролі, доступи, оператори</div>
            </div>
            <Users size={18} className="text-blue-600" />
          </div>
        </Link>
        <Link href="/display-settings" className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:border-blue-300 transition-colors">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-gray-900">Налаштування табло</div>
              <div className="text-xs text-gray-500 mt-1">Озвучення, макет, параметри</div>
            </div>
            <Settings2 size={18} className="text-blue-600" />
          </div>
        </Link>
      </div>

      {isEmptyDashboard && (
        <div className="rounded-xl border border-dashed border-blue-300 bg-blue-50/40 p-5 mb-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-sm font-bold text-gray-600 mb-2">Система запущена, але даних ще немає</div>
              <p className="text-sm text-gray-600 mb-3">
                Після першого талона дашборд автоматично покаже реальні KPI: час очікування, завершення та активність операторів.
              </p>
              <div className="space-y-2 text-sm text-gray-700">
                <div className="flex items-center gap-2"><Wrench size={14} className="text-blue-600" /> 1) Додайте послуги та робочі місця</div>
                <div className="flex items-center gap-2"><Users size={14} className="text-blue-600" /> 2) Призначте операторів і доступи</div>
                <div className="flex items-center gap-2"><TicketPlus size={14} className="text-blue-600" /> 3) Створіть перші талони для тесту</div>
              </div>
            </div>
            <Link href="/tickets" className="btn btn-primary inline-flex items-center w-fit">
              Перейти до талонів
              <ArrowRight size={16} className="ml-2" />
            </Link>
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 mb-6">
        <StatCard
          label="Всього талонів"
          value={kpi?.totalTickets ?? 0}
          sub={`Завершено: ${kpi?.completedTickets ?? 0} · Скасовано: ${kpi?.cancelledTickets ?? 0}`}
        />
        <StatCard
          label="Активних операторів"
          value={metrics?.activeOperators ?? 0}
          sub="Зараз онлайн"
          accent="purple"
        />
        <StatCard
          label="Середній час очікування"
          value={metrics?.waitingTime ? formatDuration(metrics.waitingTime) : '—'}
          sub="За поточний період"
        />
        <StatCard
          label="Коефіцієнт завершення"
          value={`${completionPct}%`}
          sub={
            <div className="h-1.5 rounded-full bg-gray-200 mt-1 overflow-hidden">
              <div className="h-full rounded-full bg-violet-600 transition-[width] duration-500" style={{ width: `${completionPct}%` }} />
            </div>
          }
          accent={completionPct >= 80 ? 'green' : completionPct >= 50 ? 'yellow' : 'red'}
        />
      </div>

      {/* Detail panels */}
      <div className="grid gap-4 md:grid-cols-2 mb-6">
        {/* KPI */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-bold text-gray-600 mb-3">KPI деталі</div>
          <div>
            <KpiRow label="Всього талонів" value={kpi?.totalTickets ?? 0} />
            <KpiRow label="Завершено" value={kpi?.completedTickets ?? 0} color="green" />
            <KpiRow label="Скасовано" value={kpi?.cancelledTickets ?? 0} color="red" />
            <KpiRow label="Перенаправлено" value={kpi?.redirectedTickets ?? 0} color="yellow" />
          </div>
        </div>

        {/* Service times */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-bold text-gray-600 mb-3">Часи обслуговування</div>
          <div>
            <KpiRow label="Середній" value={kpi?.avgServiceTime ? formatDuration(kpi.avgServiceTime) : '—'} />
            <KpiRow label="Мінімальний" value={kpi?.minServiceTime ? formatDuration(kpi.minServiceTime) : '—'} />
            <KpiRow label="Максимальний" value={kpi?.maxServiceTime ? formatDuration(kpi.maxServiceTime) : '—'} />
            <KpiRow label="Середнє очікування" value={kpi?.avgWaitingTime ? formatDuration(kpi.avgWaitingTime) : '—'} />
          </div>
        </div>
      </div>

      {/* Queues */}
      {hasQueues && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-bold text-gray-600 mb-3">Поточні черги</div>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
            {Object.entries(currentQueues).map(([name, count]) => (
              <div key={name} className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-center">
                <div className="text-3xl font-bold text-violet-600 leading-none">{count}</div>
                <div className="text-xs text-gray-400 mt-1.5">{name}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export default withDashboard(DashboardPage);
