import { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { withDashboard } from '@/components/DashboardLayout';
import { DataTable, DataTableColumn } from '@/components/DataTable';
import { Modal, ConfirmDialog } from '@/components/Modal';
import { PageHeader } from '@/components/PageHeader';
import { useToast } from '@/components/Toast';
import apiClient from '@/services/api';
import { useDeleteAction, useFormState } from '@/hooks';
import { Branch, KioskTerminal } from '@/types';
import { formatDateTime } from '@/utils/formatters';
import { readEnumQueryParam, readQueryParam, replaceShallowQuery } from '@/utils/urlQuery';
import { URL_QUERY_KEYS } from '@/utils/urlQueryKeys';

function TerminalsPage() {
  const router = useRouter();
  const { show: showToast } = useToast();
  const [items, setItems] = useState<KioskTerminal[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUrlReady, setIsUrlReady] = useState(false);

  const [branchFilter, setBranchFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [search, setSearch] = useState('');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editing, setEditing] = useState<KioskTerminal | null>(null);

  const createForm = useFormState({
    initialData: {
      name: '',
      branchId: '',
      description: '',
      status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
    },
    validator: (data) => {
      const errors: Record<string, string> = {};
      if (!data.name.trim()) {
        errors.name = 'Назва обов\'язкова';
      }
      if (!data.branchId) {
        errors.branchId = 'Філія обов\'язкова';
      }
      return errors;
    },
  });

  const editForm = useFormState({
    initialData: {
      name: '',
      branchId: '',
      description: '',
      status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
    },
    validator: (data) => {
      const errors: Record<string, string> = {};
      if (!data.name.trim()) {
        errors.name = 'Назва обов\'язкова';
      }
      if (!data.branchId) {
        errors.branchId = 'Філія обов\'язкова';
      }
      return errors;
    },
  });

  const resetCreateForm = () => {
    createForm.setData({
    name: '',
    branchId: '',
    description: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
    });
    createForm.clearErrors();
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [terminalsRes, branchesRes] = await Promise.all([
        apiClient.getKioskTerminals(),
        apiClient.getBranches(),
      ]);
      setItems(terminalsRes.data ?? []);
      setBranches(branchesRes ?? []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Не вдалося завантажити термінали', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const deleteAction = useDeleteAction<KioskTerminal>({
    onDelete: (terminal) => apiClient.deleteKioskTerminal(terminal.id),
    onSuccess: async () => {
      showToast('Термінал видалено', 'success');
      await load();
    },
  });

  useEffect(() => {
    if (!router.isReady) return;

    const nextBranch = readQueryParam(router.query, URL_QUERY_KEYS.branch, 'ALL');
    const nextStatus = readEnumQueryParam(router.query, URL_QUERY_KEYS.status, ['ALL', 'ACTIVE', 'INACTIVE'] as const, 'ALL');
    const nextSearch = readQueryParam(router.query, URL_QUERY_KEYS.search, '');

    setBranchFilter(nextBranch || 'ALL');
    setStatusFilter(nextStatus);
    setSearch(nextSearch);
    setIsUrlReady(true);
  }, [router.isReady, router.query]);

  useEffect(() => {
    if (!router.isReady || !isUrlReady) return;

    const nextQuery: Record<string, string> = {};
    if (branchFilter !== 'ALL') {
      nextQuery[URL_QUERY_KEYS.branch] = branchFilter;
    }
    if (statusFilter !== 'ALL') {
      nextQuery[URL_QUERY_KEYS.status] = statusFilter;
    }
    if (search.trim()) {
      nextQuery[URL_QUERY_KEYS.search] = search.trim();
    }

    void replaceShallowQuery(router, nextQuery);
  }, [branchFilter, isUrlReady, router, search, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((item) => (branchFilter === 'ALL' ? true : item.branchId === branchFilter))
      .filter((item) => (statusFilter === 'ALL' ? true : item.status === statusFilter))
      .filter((item) => {
        if (!q) return true;
        return (
          item.name.toLowerCase().includes(q)
          || (item.branchName ?? '').toLowerCase().includes(q)
          || item.apiKey.toLowerCase().includes(q)
        );
      });
  }, [items, branchFilter, statusFilter, search]);

  const createTerminal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.validate()) return;

    try {
      createForm.setIsSubmitting(true);
      const response = await apiClient.createKioskTerminal({
        name: createForm.data.name,
        branchId: createForm.data.branchId,
        description: createForm.data.description || undefined,
        status: createForm.data.status,
      });
      setItems((prev) => [response.terminal, ...prev]);
      showToast('Термінал створено', 'success');
      setIsCreateOpen(false);
      resetCreateForm();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Не вдалося створити термінал', 'error');
    } finally {
      createForm.setIsSubmitting(false);
    }
  };

  const rotateKey = async (row: KioskTerminal) => {
    try {
      const response = await apiClient.rotateKioskTerminalKey(row.id);
      setItems((prev) => prev.map((item) => (item.id === row.id ? response.terminal : item)));
      showToast('Ключ авторизації оновлено', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Не вдалося оновити ключ', 'error');
    }
  };

  const openEdit = (row: KioskTerminal) => {
    setEditing(row);
    editForm.setData({
      name: row.name,
      branchId: row.branchId,
      description: row.description ?? '',
      status: row.status,
    });
    editForm.clearErrors();
    setIsEditOpen(true);
  };

  const updateTerminal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !editForm.validate()) return;

    try {
      editForm.setIsSubmitting(true);
      const response = await apiClient.updateKioskTerminal(editing.id, {
        name: editForm.data.name.trim(),
        branchId: editForm.data.branchId,
        description: editForm.data.description.trim() || undefined,
        status: editForm.data.status,
      });
      setItems((prev) => prev.map((item) => (item.id === editing.id ? response.terminal : item)));
      showToast('Термінал оновлено', 'success');
      setIsEditOpen(false);
      setEditing(null);
      editForm.reset();
      editForm.clearErrors();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Не вдалося оновити термінал', 'error');
    } finally {
      editForm.setIsSubmitting(false);
    }
  };

  const toggleStatus = async (row: KioskTerminal) => {
    try {
      const response = await apiClient.updateKioskTerminal(row.id, {
        status: row.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
      });
      setItems((prev) => prev.map((item) => (item.id === row.id ? response.terminal : item)));
      showToast('Статус термінала змінено', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Не вдалося змінити статус', 'error');
    }
  };

  const deleteTerminal = async () => {
    try {
      await deleteAction.execute();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Не вдалося видалити термінал', 'error');
    }
  };

  const columns: DataTableColumn<KioskTerminal>[] = [
    { key: 'name', label: 'Термінал', sortable: true },
    { key: 'branchName', label: 'Філія', sortable: true },
    {
      key: 'apiKey',
      label: 'Ключ авторизації',
      render: (value: string) => <span className="font-mono text-xs">{value}</span>,
    },
    {
      key: 'status',
      label: 'Статус',
      render: (value: string) => (
        <span className={`badge ${value === 'ACTIVE' ? 'badge-success' : 'badge-danger'}`}>
          {value === 'ACTIVE' ? 'Активний' : 'Неактивний'}
        </span>
      ),
    },
    {
      key: 'updatedAt',
      label: 'Оновлено',
      render: (value: string) => formatDateTime(value),
    },
  ];

  return (
    <>
      <Head>
        <title>Термінали - SoftTurn</title>
      </Head>

      <div className="space-y-6">
        <PageHeader
          title="Термінали"
          subtitle="Керування кіосками та ключами авторизації"
          actions={(
            <button
              onClick={() => {
                resetCreateForm();
                if (branches.length > 0) {
                  createForm.setField('branchId', branches[0].id);
                }
                setIsCreateOpen(true);
              }}
              className="btn btn-primary"
            >
              Додати термінал
            </button>
          )}
        />

        <div className="card">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              className="form-input"
              placeholder="Пошук за назвою, філією, ключем"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select className="form-select" value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
              <option value="ALL">Всі філії</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
            <select className="form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')}>
              <option value="ALL">Всі статуси</option>
              <option value="ACTIVE">Активні</option>
              <option value="INACTIVE">Неактивні</option>
            </select>
            <button className="btn btn-secondary" onClick={() => void load()}>Оновити</button>
          </div>
        </div>

        <div className="card">
          <DataTable
            columns={columns}
            data={filtered}
            rowKey="id"
            loading={loading}
            emptyMessage="Терміналів не знайдено"
            actions={(row) => (
              <div className="flex items-center gap-1">
                <button
                  className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                  title="Редагувати"
                  aria-label="Редагувати"
                  onClick={() => { openEdit(row); }}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                  </svg>
                </button>
                <button
                  className="p-1.5 rounded-md text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                  title="Ротація ключа"
                  aria-label="Ротація ключа"
                  onClick={() => { void rotateKey(row); }}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10" />
                    <polyline points="1 20 1 14 7 14" />
                    <path d="M3.51 9a9 9 0 0 1 14.13-3.36L23 10" />
                    <path d="M20.49 15a9 9 0 0 1-14.13 3.36L1 14" />
                  </svg>
                </button>
                <button
                  className="p-1.5 rounded-md text-amber-600 hover:text-amber-800 hover:bg-amber-50"
                  title={row.status === 'ACTIVE' ? 'Деактивувати' : 'Активувати'}
                  aria-label={row.status === 'ACTIVE' ? 'Деактивувати' : 'Активувати'}
                  onClick={() => { void toggleStatus(row); }}
                >
                  {row.status === 'ACTIVE' ? (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  )}
                </button>
                <button
                  className="p-1.5 rounded-md text-red-600 hover:text-red-800 hover:bg-red-50"
                  title="Видалити"
                  aria-label="Видалити"
                  onClick={() => deleteAction.setDeleteConfirm(row)}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14H6L5 6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                    <path d="M9 6V4h6v2" />
                  </svg>
                </button>
              </div>
            )}
          />
        </div>
      </div>

      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Новий термінал" size="md">
        <form onSubmit={createTerminal} className="space-y-4">
          <div>
            <label className="form-label">Назва</label>
            <input className={`form-input ${createForm.errors.name ? 'border-red-500' : ''}`} value={createForm.data.name} onChange={(e) => createForm.setField('name', e.target.value)} />
            {createForm.errors.name && <p className="text-red-500 text-sm mt-1">{createForm.errors.name}</p>}
          </div>
          <div>
            <label className="form-label">Філія</label>
            <select className={`form-select ${createForm.errors.branchId ? 'border-red-500' : ''}`} value={createForm.data.branchId} onChange={(e) => createForm.setField('branchId', e.target.value)}>
              <option value="">Оберіть філію</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
            {createForm.errors.branchId && <p className="text-red-500 text-sm mt-1">{createForm.errors.branchId}</p>}
          </div>
          <div>
            <label className="form-label">Опис</label>
            <input className="form-input" value={createForm.data.description} onChange={(e) => createForm.setField('description', e.target.value)} />
          </div>
          <div>
            <label className="form-label">Статус</label>
            <select className="form-select" value={createForm.data.status} onChange={(e) => createForm.setField('status', e.target.value as 'ACTIVE' | 'INACTIVE')}>
              <option value="ACTIVE">Активний</option>
              <option value="INACTIVE">Неактивний</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn btn-secondary" onClick={() => setIsCreateOpen(false)}>Скасувати</button>
            <button type="submit" className="btn btn-primary" disabled={createForm.isSubmitting}>Зберегти</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isEditOpen} onClose={() => { setIsEditOpen(false); setEditing(null); }} title="Редагувати термінал" size="md">
        <form onSubmit={updateTerminal} className="space-y-4">
          <div>
            <label className="form-label">Назва</label>
            <input className={`form-input ${editForm.errors.name ? 'border-red-500' : ''}`} value={editForm.data.name} onChange={(e) => editForm.setField('name', e.target.value)} />
            {editForm.errors.name && <p className="text-red-500 text-sm mt-1">{editForm.errors.name}</p>}
          </div>
          <div>
            <label className="form-label">Філія</label>
            <select className={`form-select ${editForm.errors.branchId ? 'border-red-500' : ''}`} value={editForm.data.branchId} onChange={(e) => editForm.setField('branchId', e.target.value)}>
              <option value="">Оберіть філію</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
            {editForm.errors.branchId && <p className="text-red-500 text-sm mt-1">{editForm.errors.branchId}</p>}
          </div>
          <div>
            <label className="form-label">Опис</label>
            <input className="form-input" value={editForm.data.description} onChange={(e) => editForm.setField('description', e.target.value)} />
          </div>
          <div>
            <label className="form-label">Статус</label>
            <select className="form-select" value={editForm.data.status} onChange={(e) => editForm.setField('status', e.target.value as 'ACTIVE' | 'INACTIVE')}>
              <option value="ACTIVE">Активний</option>
              <option value="INACTIVE">Неактивний</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn btn-secondary" onClick={() => { setIsEditOpen(false); setEditing(null); }}>Скасувати</button>
            <button type="submit" className="btn btn-primary" disabled={editForm.isSubmitting}>Зберегти</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteAction.deleteConfirm}
        title="Видалити термінал"
        message={`Підтвердіть видалення термінала ${deleteAction.deleteConfirm?.name ?? ''}`}
        onConfirm={() => void deleteTerminal()}
        onCancel={() => deleteAction.setDeleteConfirm(null)}
        isDangerous
        isLoading={deleteAction.isDeleting}
      />
    </>
  );
}

export default withDashboard(TerminalsPage);
