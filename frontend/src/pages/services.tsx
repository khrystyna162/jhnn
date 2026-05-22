import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { withDashboard } from '@/components/DashboardLayout';
import { DataTable, DataTableColumn } from '@/components/DataTable';
import { Modal, ConfirmDialog } from '@/components/Modal';
import { useToast } from '@/components/Toast';
import apiClient from '@/services/api';
import { usePagination, useFormState, useDeleteAction } from '@/hooks';
import { ChevronDown, Download, Eye, PencilLine, Plus, Search, Trash2, X } from 'lucide-react';
import { ServiceType, ServiceUsage } from '@/types';
import { formatDateTime } from '@/utils/formatters';
import { readEnumQueryParam, readPositiveIntQueryParam, readQueryParam, replaceShallowQuery } from '@/utils/urlQuery';
import { URL_QUERY_KEYS } from '@/utils/urlQueryKeys';

function ServicesPage() {
  const router = useRouter();
  const { show: showToast } = useToast();
  const [services, setServices] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUrlReady, setIsUrlReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceType | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isUsageModalOpen, setIsUsageModalOpen] = useState(false);
  const [selectedServiceUsage, setSelectedServiceUsage] = useState<ServiceUsage | null>(null);
  const [isUsageLoading, setIsUsageLoading] = useState(false);
  const [usageError, setUsageError] = useState<string | null>(null);

  const form = useFormState({
    initialData: { name: '', prefix: '', code: '', slaMinutes: '', isActive: true },
    validator: (data) => {
      const errors: Record<string, string> = {};

      if (!data.name.trim()) {
        errors.name = 'Назва послуги обов\'язкова';
      }

      if (!data.prefix.trim()) {
        errors.prefix = 'Префікс обов\'язковий';
      }

      return errors;
    },
  });

  const [totalServices, setTotalServices] = useState(0);
  const pagination = usePagination(totalServices, 10);
  const { currentPage, goToPage } = pagination;
  const actionButtonClass = 'inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2';

  const csvEscape = (value: string) => {
    const normalized = String(value ?? '').replace(/"/g, '""');
    return `"${normalized}"`;
  };

  const downloadCsv = (filename: string, rows: string[]) => {
    const blob = new Blob(['\ufeff', rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('ALL');
    goToPage(1);
  };

  const loadServices = useCallback(async () => {
    if (!isUrlReady) return;

    try {
      setLoading(true);
      const response = await apiClient.getServicesPage({
        page: currentPage,
        limit: 10,
        ...(searchQuery.trim() && { search: searchQuery.trim() }),
        ...(statusFilter !== 'ALL' && { status: statusFilter }),
      });
      setServices(response.data);
      setTotalServices(response.total);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Помилка при завантаженні послуг', 'error');
    } finally {
      setLoading(false);
    }
  }, [currentPage, isUrlReady, searchQuery, showToast, statusFilter]);

  const deleteAction = useDeleteAction<ServiceType>({
    onDelete: (service) => apiClient.deleteServiceType(service.id),
    onSuccess: async () => {
      showToast('Послугу деактивовано', 'success');
      await loadServices();
    },
  });

  useEffect(() => {
    if (!router.isReady) return;

    const nextSearch = readQueryParam(router.query, URL_QUERY_KEYS.search, '');
    const nextStatus = readEnumQueryParam(router.query, URL_QUERY_KEYS.status, ['ALL', 'ACTIVE', 'INACTIVE'] as const, 'ALL');
    const nextPage = readPositiveIntQueryParam(router.query, URL_QUERY_KEYS.page, 1);

    setSearchQuery(nextSearch);
    setStatusFilter(nextStatus);
    goToPage(nextPage);
    setIsUrlReady(true);
  }, [goToPage, router.isReady, router.query]);

  useEffect(() => {
    if (!router.isReady || !isUrlReady) return;

    const nextQuery: Record<string, string> = {};
    if (searchQuery.trim()) {
      nextQuery[URL_QUERY_KEYS.search] = searchQuery.trim();
    }
    if (statusFilter !== 'ALL') {
      nextQuery[URL_QUERY_KEYS.status] = statusFilter;
    }
    if (currentPage > 1) {
      nextQuery[URL_QUERY_KEYS.page] = String(currentPage);
    }

    void replaceShallowQuery(router, nextQuery);
  }, [currentPage, isUrlReady, router, searchQuery, statusFilter]);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  const openCreateModal = () => {
    form.reset();
    form.clearErrors();
    setIsCreateModalOpen(true);
  };

  const openEditModal = (service: ServiceType) => {
    setEditingService(service);
    form.setData({
      name: service.name,
      prefix: service.prefix,
      code: service.code || '',
      slaMinutes: service.slaMinutes ? String(service.slaMinutes) : '',
      isActive: service.isActive ?? true,
    });
    form.clearErrors();
    setIsEditModalOpen(true);
  };

  const openUsageModal = async (service: ServiceType) => {
    try {
      setIsUsageModalOpen(true);
      setIsUsageLoading(true);
      setUsageError(null);
      const usage = await apiClient.getServiceUsage(service.id);
      setSelectedServiceUsage(usage);
    } catch (err) {
      setUsageError(err instanceof Error ? err.message : 'Не вдалося завантажити використання послуги');
    } finally {
      setIsUsageLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const response = await apiClient.getServicesPage({
        page: 1,
        limit: 1000,
        ...(searchQuery.trim() && { search: searchQuery.trim() }),
        ...(statusFilter !== 'ALL' && { status: statusFilter }),
      });

      const rows = [
        ['Назва', 'Код', 'Префікс', 'SLA, хв', 'Статус', 'Створена'].map(csvEscape).join(';'),
        ...response.data.map((service) => [
          service.name,
          service.code || '',
          service.prefix,
          service.slaMinutes != null ? String(service.slaMinutes) : '',
          service.isActive ? 'Активна' : 'Неактивна',
          formatDateTime(new Date(service.createdAt)),
        ].map(csvEscape).join(';')),
      ];

      const filename = `services${statusFilter !== 'ALL' ? `_${statusFilter}` : ''}${searchQuery.trim() ? '_search' : ''}.csv`;
      downloadCsv(filename, rows);
    } catch (err) {
      showToast(`Не вдалося експортувати послуги: ${err instanceof Error ? err.message : ''}`, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.validate()) return;

    try {
      form.setIsSubmitting(true);
      await apiClient.createService({
        name: form.data.name,
        prefix: form.data.prefix,
        code: form.data.code || undefined,
        slaMinutes: form.data.slaMinutes ? Number(form.data.slaMinutes) : undefined,
        isActive: form.data.isActive,
      });
      showToast('Послугу створено', 'success');
      await loadServices();
      form.reset();
      setIsCreateModalOpen(false);
    } catch (err) {
      showToast(`Помилка при створенні послуги: ${err instanceof Error ? err.message : ''}`, 'error');
    } finally {
      form.setIsSubmitting(false);
    }
  };

  const handleUpdateService = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingService || !form.validate()) return;

    try {
      form.setIsSubmitting(true);
      await apiClient.updateServiceType(editingService.id, {
        name: form.data.name,
        prefix: form.data.prefix,
        code: form.data.code || undefined,
        slaMinutes: form.data.slaMinutes ? Number(form.data.slaMinutes) : undefined,
        isActive: form.data.isActive,
      });
      showToast('Послугу оновлено', 'success');
      await loadServices();
      form.reset();
      setIsEditModalOpen(false);
      setEditingService(null);
    } catch (err) {
      showToast(`Помилка при оновленні послуги: ${err instanceof Error ? err.message : ''}`, 'error');
    } finally {
      form.setIsSubmitting(false);
    }
  };

  const handleDeleteService = async () => {
    try {
      await deleteAction.execute();
    } catch (err) {
      showToast(`Помилка при деактивації послуги: ${err instanceof Error ? err.message : ''}`, 'error');
    }
  };

  const columns: DataTableColumn<ServiceType>[] = [
    {
      key: 'name',
      label: 'Назва послуги',
      sortable: true,
    },
    {
      key: 'code',
      label: 'Код',
      width: '130px',
      render: (value) => value || '-',
    },
    {
      key: 'prefix',
      label: 'Префікс',
      width: '120px',
    },
    {
      key: 'slaMinutes',
      label: 'SLA, хв',
      width: '110px',
      render: (value) => (value ? String(value) : '-'),
    },
    {
      key: 'isActive',
      label: 'Статус',
      width: '120px',
      render: (value) => (
        <span className={`badge ${value ? 'badge-success' : 'badge-danger'}`}>
          {value ? 'Активна' : 'Неактивна'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Створена',
      width: '180px',
      render: (value) => formatDateTime(new Date(value)),
    },
  ];

  return (
    <>
      <Head>
        <title>Послуги - SoftTurn</title>
      </Head>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Послуги</h1>
            <p className="text-gray-600 mt-2">Каталог послуг, що надаються у системі</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleExport} className="btn btn-white" disabled={isExporting || loading}>
              {isExporting ? (
                <>
                  <span className="spinner inline-block mr-2 h-4 w-4"></span>
                  Експорт...
                </>
              ) : (
                <>
                  <Download size={16} className="mr-2" />
                  CSV
                </>
              )}
            </button>
            <button onClick={openCreateModal} className="btn btn-primary">
              <Plus size={16} className="mr-2" />
              Нова послуга
            </button>
          </div>
        </div>

        <div className="card border border-blue-200 bg-blue-50/60">
          <h2 className="text-lg font-semibold text-blue-900">Каталог послуг</h2>
          <p className="text-sm text-blue-900 mt-2">
            Тут ви керуєте довідником послуг: створення, редагування, деактивація, SLA, коди та префікси.
          </p>
          <p className="text-sm text-blue-900 mt-2">
            Кнопка з іконкою ока показує аналітику використання послуги: де вона підключена та ким використовується.
          </p>
        </div>

        {/* Stats */}
        <div className="card">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-sm font-semibold text-gray-700">Разом послуг</label>
              <p className="text-2xl font-bold text-blue-600 mt-2">{totalServices}</p>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700">Поточна сторінка</label>
              <p className="text-2xl font-bold text-gray-900 mt-2">{currentPage}</p>
            </div>
            <div className="md:flex md:justify-end md:items-center">
              <button type="button" onClick={clearFilters} className="btn btn-white btn-small">
                <X size={16} className="mr-2" />
                Скинути фільтри
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-gray-700">Пошук</label>
              <div className="relative mt-2">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    goToPage(1);
                  }}
                  className="form-input pl-10"
                  placeholder="Назва, код або префікс"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700">Статус</label>
              <div className="relative mt-2">
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE');
                    goToPage(1);
                  }}
                  className="form-select pr-10 appearance-none"
                >
                  <option value="ALL">Всі</option>
                  <option value="ACTIVE">Активні</option>
                  <option value="INACTIVE">Неактивні</option>
                </select>
                <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Services Table */}
        <div className="card">
          <DataTable<ServiceType>
            columns={columns}
            data={services}
            rowKey="id"
            loading={loading}
            emptyMessage="Немає послуг"
            pagination={{
              total: totalServices,
              pageSize: 10,
              currentPage,
              onPageChange: (page) => goToPage(page),
            }}
            actions={(service) => (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => void openUsageModal(service)}
                  className={`${actionButtonClass} text-indigo-600 hover:bg-indigo-50 hover:text-indigo-800`}
                  title="Аналітика використання"
                  aria-label="Аналітика використання"
                >
                  <Eye size={16} />
                </button>
                <button
                  onClick={() => openEditModal(service)}
                  className={`${actionButtonClass} text-blue-600 hover:bg-blue-50 hover:text-blue-800`}
                  title="Редагувати"
                  aria-label="Редагувати"
                >
                  <PencilLine size={16} />
                </button>
                <button
                  onClick={() => deleteAction.setDeleteConfirm(service)}
                  className={`${actionButtonClass} text-red-600 hover:bg-red-50 hover:text-red-800`}
                  title="Деактивувати"
                  aria-label="Деактивувати"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          />
        </div>
      </div>

      {/* Create Service Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Створити нову послугу"
        size="lg"
      >
        <form onSubmit={handleCreateService} className="space-y-4">
          <div className="form-group">
            <label className="form-label">Назва послуги *</label>
            <input
              type="text"
              className={`form-input ${form.errors.name ? 'border-red-500' : ''}`}
              placeholder="Консультація"
              value={form.data.name}
              onChange={(e) => form.setField('name', e.target.value)}
              disabled={form.isSubmitting}
            />
            {form.errors.name && <p className="text-red-500 text-sm mt-1">{form.errors.name}</p>}
          </div>

          <div className="form-group">
            <label className="form-label">Префікс *</label>
            <input
              type="text"
              className={`form-input ${form.errors.prefix ? 'border-red-500' : ''}`}
              placeholder="CONS"
              value={form.data.prefix}
              onChange={(e) => form.setField('prefix', e.target.value)}
              disabled={form.isSubmitting}
            />
            {form.errors.prefix && <p className="text-red-500 text-sm mt-1">{form.errors.prefix}</p>}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="form-group">
              <label className="form-label">Код</label>
              <input
                type="text"
                className="form-input"
                placeholder="CONS_001"
                value={form.data.code}
                onChange={(e) => form.setField('code', e.target.value)}
                disabled={form.isSubmitting}
              />
            </div>

            <div className="form-group">
              <label className="form-label">SLA, хв</label>
              <input
                type="number"
                min={1}
                className="form-input"
                placeholder="15"
                value={form.data.slaMinutes}
                onChange={(e) => form.setField('slaMinutes', e.target.value)}
                disabled={form.isSubmitting}
              />
            </div>
          </div>

          <div className="form-group flex items-center gap-3">
            <input
              id="serviceActive"
              type="checkbox"
              checked={form.data.isActive}
              onChange={(e) => form.setField('isActive', e.target.checked)}
              disabled={form.isSubmitting}
            />
            <label htmlFor="serviceActive" className="form-label mb-0">
              Активна
            </label>
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="btn btn-white"
              disabled={form.isSubmitting}
            >
              Скасувати
            </button>
            <button type="submit" className="btn btn-primary" disabled={form.isSubmitting}>
              {form.isSubmitting ? (
                <>
                  <span className="spinner inline-block mr-2 h-4 w-4"></span>
                  Зберігаю...
                </>
              ) : (
                'Створити'
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Service Modal */}
      {editingService && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingService(null);
            form.reset();
            form.clearErrors();
          }}
          title={`Редагувати послугу: ${editingService.name}`}
          size="lg"
        >
          <form onSubmit={handleUpdateService} className="space-y-4">
            <div className="form-group">
              <label className="form-label">Назва послуги *</label>
              <input
                type="text"
                className={`form-input ${form.errors.name ? 'border-red-500' : ''}`}
                placeholder="Консультація"
                value={form.data.name}
                onChange={(e) => form.setField('name', e.target.value)}
                disabled={form.isSubmitting}
              />
              {form.errors.name && <p className="text-red-500 text-sm mt-1">{form.errors.name}</p>}
            </div>

            <div className="form-group">
              <label className="form-label">Префікс *</label>
              <input
                type="text"
                className={`form-input ${form.errors.prefix ? 'border-red-500' : ''}`}
                placeholder="CONS"
                value={form.data.prefix}
                onChange={(e) => form.setField('prefix', e.target.value)}
                disabled={form.isSubmitting}
              />
              {form.errors.prefix && <p className="text-red-500 text-sm mt-1">{form.errors.prefix}</p>}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="form-group">
                <label className="form-label">Код</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="CONS_001"
                  value={form.data.code}
                  onChange={(e) => form.setField('code', e.target.value)}
                  disabled={form.isSubmitting}
                />
              </div>

              <div className="form-group">
                <label className="form-label">SLA, хв</label>
                <input
                  type="number"
                  min={1}
                  className="form-input"
                  placeholder="15"
                  value={form.data.slaMinutes}
                  onChange={(e) => form.setField('slaMinutes', e.target.value)}
                  disabled={form.isSubmitting}
                />
              </div>
            </div>

            <div className="form-group flex items-center gap-3">
              <input
                id="serviceActiveEdit"
                type="checkbox"
                checked={form.data.isActive}
                onChange={(e) => form.setField('isActive', e.target.checked)}
                disabled={form.isSubmitting}
              />
              <label htmlFor="serviceActiveEdit" className="form-label mb-0">
                Активна
              </label>
            </div>

            <div className="flex gap-3 justify-end pt-4">
              <button
                type="button"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingService(null);
                  form.reset();
                  form.clearErrors();
                }}
                className="btn btn-white"
                disabled={form.isSubmitting}
              >
                Скасувати
              </button>
              <button type="submit" className="btn btn-primary" disabled={form.isSubmitting}>
                {form.isSubmitting ? (
                  <>
                    <span className="spinner inline-block mr-2 h-4 w-4"></span>
                    Зберігаю...
                  </>
                ) : (
                  'Оновити'
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!deleteAction.deleteConfirm}
        title="Деактивувати послугу"
        message={`Ви впевнені, що хочете деактивувати послугу "${deleteAction.deleteConfirm?.name}"? Вона не зникне з бази, але стане недоступною для нових призначень.`}
        onConfirm={() => void handleDeleteService()}
        onCancel={() => deleteAction.setDeleteConfirm(null)}
        isDangerous
        isLoading={deleteAction.isDeleting}
      />

      <Modal
        isOpen={isUsageModalOpen}
        onClose={() => {
          setIsUsageModalOpen(false);
          setSelectedServiceUsage(null);
          setUsageError(null);
        }}
        title={selectedServiceUsage ? `Аналітика: ${selectedServiceUsage.service.name}` : 'Аналітика послуги'}
        size="lg"
      >
        {isUsageLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="spinner"></div>
            <span className="ml-3 text-gray-600">Завантажую призначення...</span>
          </div>
        ) : usageError ? (
          <div className="alert alert-error">{usageError}</div>
        ) : selectedServiceUsage ? (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="card p-4">
                <div className="text-xs uppercase tracking-wide text-gray-500">Філій / робочих місць</div>
                <div className="mt-2 text-2xl font-bold text-gray-900">{selectedServiceUsage.workplaces.length}</div>
              </div>
              <div className="card p-4">
                <div className="text-xs uppercase tracking-wide text-gray-500">Операторів</div>
                <div className="mt-2 text-2xl font-bold text-gray-900">{selectedServiceUsage.operators.length}</div>
              </div>
              <div className="card p-4">
                <div className="text-xs uppercase tracking-wide text-gray-500">Статус</div>
                <div className="mt-2 text-lg font-semibold text-gray-900">
                  {selectedServiceUsage.service.isActive ? 'Активна' : 'Неактивна'}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Робочі місця і філії</h3>
              {selectedServiceUsage.workplaces.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">Робоче місце</th>
                        <th className="px-4 py-3 text-left font-semibold">Філія</th>
                        <th className="px-4 py-3 text-left font-semibold">Район</th>
                        <th className="px-4 py-3 text-left font-semibold">Статус</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedServiceUsage.workplaces.map((workplace) => (
                        <tr key={workplace.id} className="border-t border-gray-100">
                          <td className="px-4 py-3 font-medium text-gray-900">{workplace.name}</td>
                          <td className="px-4 py-3 text-gray-700">{workplace.branchName}</td>
                          <td className="px-4 py-3 text-gray-700">{workplace.districtName}</td>
                          <td className="px-4 py-3 text-gray-700">{workplace.isActive ? 'Активне' : 'Неактивне'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-500">До цієї послуги ще не прив’язані робочі місця.</p>
              )}
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Оператори з доступом</h3>
              {selectedServiceUsage.operators.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">Оператор</th>
                        <th className="px-4 py-3 text-left font-semibold">Email</th>
                        <th className="px-4 py-3 text-left font-semibold">Роль</th>
                        <th className="px-4 py-3 text-left font-semibold">Статус</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedServiceUsage.operators.map((operator) => (
                        <tr key={operator.id} className="border-t border-gray-100">
                          <td className="px-4 py-3 font-medium text-gray-900">{operator.fullName}</td>
                          <td className="px-4 py-3 text-gray-700">{operator.email}</td>
                          <td className="px-4 py-3 text-gray-700">{operator.role}</td>
                          <td className="px-4 py-3 text-gray-700">{operator.isActive ? 'Активний' : 'Неактивний'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-500">Ще жодному оператору не видано доступ до цієї послуги.</p>
              )}
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}

export default withDashboard(ServicesPage);
