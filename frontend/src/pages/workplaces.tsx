import { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { withDashboard } from '@/components/DashboardLayout';
import { DataTable, DataTableColumn } from '@/components/DataTable';
import { Modal, ConfirmDialog } from '@/components/Modal';
import { PageHeader } from '@/components/PageHeader';
import { useToast } from '@/components/Toast';
import { PencilLine, Trash2 } from 'lucide-react';
import apiClient from '@/services/api';
import { usePagination, useFormState, useDeleteAction } from '@/hooks';
import { Workplace, ServiceType, Branch } from '@/types';
import { formatDateTime } from '@/utils/formatters';
import { readPositiveIntQueryParam, readQueryParam, replaceShallowQuery } from '@/utils/urlQuery';
import { URL_QUERY_KEYS } from '@/utils/urlQueryKeys';

function WorkplacesPage() {
  const router = useRouter();
  const { show: showToast } = useToast();
  const PAGE_SIZE = 10;
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUrlReady, setIsUrlReady] = useState(false);
  const [branchFilter, setBranchFilter] = useState<string>('ALL');

  const [branches, setBranches] = useState<Branch[]>([]);
  const [services, setServices] = useState<ServiceType[]>([]);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingWorkplace, setEditingWorkplace] = useState<Workplace | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [totalWorkplaces, setTotalWorkplaces] = useState(0);
  const pagination = usePagination(totalWorkplaces, PAGE_SIZE);
  const { currentPage, goToPage } = pagination;

  // Form state management
  const form = useFormState({
    initialData: { number: '', branchId: '', serviceId: '', isActive: true },
    validator: (data) => {
      const errors: Record<string, string> = {};
      if (!data.number.trim()) {
        errors.number = 'Номер обов\'язковий';
      }
      if (!data.branchId) {
        errors.branchId = 'Філія обов\'язкова';
      }
      if (!data.serviceId) {
        errors.serviceId = 'Послуга обов\'язкова';
      }
      return errors;
    },
  });

  // Delete action management
  const deleteAction = useDeleteAction({
    onDelete: (workplace: Workplace) => apiClient.deleteWorkplace(workplace.id),
    onSuccess: async () => {
      showToast('Робоче місце видалено', 'success');
      await loadWorkplaces();
    },
  });

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [branchesData, servicesData] = await Promise.all([
          apiClient.getBranches(),
          apiClient.getServices(),
        ]);
        setBranches(branchesData);
        setServices(servicesData);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Помилка при завантаженні даних', 'error');
      }
    };

    loadInitialData();
  }, [showToast]);

  // Load workplaces
  const loadWorkplaces = useCallback(async () => {
    if (!isUrlReady) return;

    try {
      setIsLoading(true);
      const response = await apiClient.getWorkplaces({
        page: currentPage,
        limit: PAGE_SIZE,
        ...(branchFilter !== 'ALL' && { branchId: branchFilter }),
      });
      setWorkplaces(response.data ?? []);
      setTotalWorkplaces(response.total ?? 0);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Помилка при завантаженні робочих місць',
        'error'
      );
    } finally {
      setIsLoading(false);
    }
  }, [PAGE_SIZE, branchFilter, currentPage, isUrlReady, showToast]);

  useEffect(() => {
    if (!router.isReady) return;

    const nextBranch = readQueryParam(router.query, URL_QUERY_KEYS.branch, 'ALL');
    const nextPage = readPositiveIntQueryParam(router.query, URL_QUERY_KEYS.page, 1);

    setBranchFilter(nextBranch || 'ALL');
    goToPage(nextPage);
    setIsUrlReady(true);
  }, [goToPage, router.isReady, router.query]);

  useEffect(() => {
    if (!router.isReady || !isUrlReady) return;

    const nextQuery: Record<string, string> = {};
    if (branchFilter !== 'ALL') {
      nextQuery[URL_QUERY_KEYS.branch] = branchFilter;
    }
    if (currentPage > 1) {
      nextQuery[URL_QUERY_KEYS.page] = String(currentPage);
    }

    void replaceShallowQuery(router, nextQuery);
  }, [branchFilter, currentPage, isUrlReady, router]);

  useEffect(() => {
    loadWorkplaces();
  }, [loadWorkplaces]);

  const duplicateKeys = useMemo(() => {
    const counters = new Map<string, number>();

    workplaces.forEach((workplace) => {
      const key = `${workplace.branchId}::${workplace.number.trim().toLowerCase()}`;
      counters.set(key, (counters.get(key) ?? 0) + 1);
    });

    const duplicates = new Set<string>();
    counters.forEach((count, key) => {
      if (count > 1) {
        duplicates.add(key);
      }
    });

    return duplicates;
  }, [workplaces]);

  const handleCreateWorkplace = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.validate()) return;

    try {
      form.setIsSubmitting(true);
      await apiClient.createWorkplace({
        number: form.data.number,
        branchId: form.data.branchId,
        serviceId: form.data.serviceId,
      });
      showToast('Робоче місце створено', 'success');
      await loadWorkplaces();
      form.reset();
      setIsCreateModalOpen(false);
    } catch (err) {
      showToast(
        `Помилка при створенні: ${err instanceof Error ? err.message : ''}`,
        'error'
      );
    } finally {
      form.setIsSubmitting(false);
    }
  };

  const handleUpdateWorkplace = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingWorkplace || !form.validate()) return;

    try {
      form.setIsSubmitting(true);
      await apiClient.updateWorkplace(editingWorkplace.id, {
        number: form.data.number,
        branchId: form.data.branchId,
        serviceId: form.data.serviceId,
      });
      showToast('Робоче місце оновлено', 'success');
      await loadWorkplaces();
      form.reset();
      setIsEditModalOpen(false);
      setEditingWorkplace(null);
    } catch (err) {
      showToast(
        `Помилка при оновленні: ${err instanceof Error ? err.message : ''}`,
        'error'
      );
    } finally {
      form.setIsSubmitting(false);
    }
  };

  const columns: DataTableColumn<Workplace>[] = [
    {
      key: 'number',
      label: 'Номер',
      width: '100px',
      sortable: true,
      render: (value, row) => {
        const key = `${row.branchId}::${String(value).trim().toLowerCase()}`;
        const isDuplicate = duplicateKeys.has(key);

        return (
          <div className="flex items-center gap-2">
            <span>{value}</span>
            {isDuplicate && <span className="badge badge-warning">Дубль</span>}
          </div>
        );
      },
    },
    {
      key: 'branchName',
      label: 'Філія',
      render: (value) => value || '-',
    },
    {
      key: 'serviceName',
      label: 'Послуга',
      render: (value) => value || '-',
    },
    {
      key: 'isActive',
      label: 'Статус',
      width: '100px',
      render: (isActive) => (
        <span className={`badge ${isActive ? 'badge-success' : 'badge-danger'}`}>
          {isActive ? 'Активне' : 'Неактивне'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Створене',
      width: '180px',
      render: (value) => formatDateTime(new Date(value)),
    },
  ];

  return (
    <>
      <Head>
        <title>Робочі місця - SoftTurn</title>
      </Head>

      <div className="space-y-6">
        <PageHeader
          title="Робочі місця"
          subtitle="Управління робочими місцями та послугами"
          actions={(
            <div className="flex gap-2">
              <button
                onClick={() => void loadWorkplaces()}
                className="btn btn-white"
                type="button"
              >
                Оновити
              </button>
              <button
                onClick={() => {
                  form.reset();
                  form.clearErrors();
                  setIsCreateModalOpen(true);
                }}
                className="btn btn-primary"
                type="button"
              >
                Нове робоче місце
              </button>
            </div>
          )}
        />

        {/* Filters */}
        <div className="card">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="form-label">Філія</label>
              <select
                className="form-select"
                value={branchFilter}
                onChange={(e) => {
                  setBranchFilter(e.target.value);
                  goToPage(1);
                }}
              >
                <option value="ALL">Усі філії</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => {
                setBranchFilter('ALL');
                goToPage(1);
              }}
              className="btn btn-white btn-small"
            >
              Очистити
            </button>
          </div>
        </div>

        {/* Workplaces Table */}
        <div className="card">
          <DataTable<Workplace>
            columns={columns}
            data={workplaces}
            rowKey="id"
            loading={isLoading}
            emptyMessage="Немає робочих місць"
            pagination={{
              total: totalWorkplaces,
              pageSize: PAGE_SIZE,
              currentPage,
              onPageChange: pagination.goToPage,
            }}
            actions={(workplace) => (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setEditingWorkplace(workplace);
                    form.setData({
                      number: workplace.number,
                      branchId: workplace.branchId,
                      serviceId: workplace.serviceId,
                      isActive: workplace.isActive,
                    });
                    form.clearErrors();
                    setIsEditModalOpen(true);
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  title="Редагувати"
                  aria-label="Редагувати"
                >
                  <PencilLine size={16} />
                </button>
                <button
                  onClick={() => deleteAction.setDeleteConfirm(workplace)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md text-red-600 hover:bg-red-50 hover:text-red-900"
                  title="Видалити"
                  aria-label="Видалити"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          />
        </div>
      </div>

      {/* Create Workplace Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Створити нове робоче місце"
        size="md"
      >
        <form onSubmit={handleCreateWorkplace} className="space-y-4">
          <div className="form-group">
            <label className="form-label">Номер *</label>
            <input
              type="text"
              className={`form-input ${form.errors.number ? 'border-red-500' : ''}`}
              placeholder="1"
              value={form.data.number}
              onChange={(e) => form.setField('number', e.target.value)}
              disabled={form.isSubmitting}
            />
            {form.errors.number && <p className="text-red-500 text-sm mt-1">{form.errors.number}</p>}
          </div>

          <div className="form-group">
            <label className="form-label">Філія *</label>
            <select
              className={`form-select ${form.errors.branchId ? 'border-red-500' : ''}`}
              value={form.data.branchId}
              onChange={(e) => form.setField('branchId', e.target.value)}
              disabled={form.isSubmitting}
            >
              <option value="">Виберіть філію...</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
            {form.errors.branchId && (
              <p className="text-red-500 text-sm mt-1">{form.errors.branchId}</p>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Послуга *</label>
            <select
              className={`form-select ${form.errors.serviceId ? 'border-red-500' : ''}`}
              value={form.data.serviceId}
              onChange={(e) => form.setField('serviceId', e.target.value)}
              disabled={form.isSubmitting}
            >
              <option value="">Виберіть послугу...</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
            {form.errors.serviceId && (
              <p className="text-red-500 text-sm mt-1">{form.errors.serviceId}</p>
            )}
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

      {/* Edit Workplace Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Редагувати робоче місце"
        size="md"
      >
        <form onSubmit={handleUpdateWorkplace} className="space-y-4">
          <div className="form-group">
            <label className="form-label">Номер *</label>
            <input
              type="text"
              className={`form-input ${form.errors.number ? 'border-red-500' : ''}`}
              placeholder="1"
              value={form.data.number}
              onChange={(e) => form.setField('number', e.target.value)}
              disabled={form.isSubmitting}
            />
            {form.errors.number && <p className="text-red-500 text-sm mt-1">{form.errors.number}</p>}
          </div>

          <div className="form-group">
            <label className="form-label">Філія *</label>
            <select
              className={`form-select ${form.errors.branchId ? 'border-red-500' : ''}`}
              value={form.data.branchId}
              onChange={(e) => form.setField('branchId', e.target.value)}
              disabled={form.isSubmitting}
            >
              <option value="">Виберіть філію...</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
            {form.errors.branchId && (
              <p className="text-red-500 text-sm mt-1">{form.errors.branchId}</p>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Послуга *</label>
            <select
              className={`form-select ${form.errors.serviceId ? 'border-red-500' : ''}`}
              value={form.data.serviceId}
              onChange={(e) => form.setField('serviceId', e.target.value)}
              disabled={form.isSubmitting}
            >
              <option value="">Виберіть послугу...</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
            {form.errors.serviceId && (
              <p className="text-red-500 text-sm mt-1">{form.errors.serviceId}</p>
            )}
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
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

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteAction.deleteConfirm}
        title="Видалити робоче місце?"
        message={`Ви впевнені, що хочете видалити робоче місце №${deleteAction.deleteConfirm?.number}? Це не можна скасувати.`}
        onCancel={() => deleteAction.setDeleteConfirm(null)}
        onConfirm={deleteAction.execute}
        isLoading={deleteAction.isDeleting}
      />
    </>
  );
}

export default withDashboard(WorkplacesPage);
