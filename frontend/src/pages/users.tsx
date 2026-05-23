import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { withDashboard } from '@/components/DashboardLayout';
import { DataTable, DataTableColumn } from '@/components/DataTable';
import { Modal, ConfirmDialog } from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { UserForm } from '@/components/UserForm';
import apiClient from '@/services/api';
import { usePagination, useDeleteAction } from '@/hooks';
import {
  ChevronDown,
  Download,
  KeyRound,
  LockKeyhole,
  PencilLine,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  User,
  Role,
  ScopeLevel,
  Permission,
  ServiceType,
  Country,
  City,
  District,
  Branch,
  UserScopeInput,
} from '@/types';
import { formatDateTime } from '@/utils/formatters';
import { readEnumQueryParam, readPositiveIntQueryParam, readQueryParam, replaceShallowQuery } from '@/utils/urlQuery';
import { URL_QUERY_KEYS } from '@/utils/urlQueryKeys';

function UsersPage() {
  const router = useRouter();
  const { show } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUrlReady, setIsUrlReady] = useState(false);
  const [roleFilter, setRoleFilter] = useState<Role | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const [isAccessModalOpen, setIsAccessModalOpen] = useState(false);
  const [selectedAccessUser, setSelectedAccessUser] = useState<User | null>(null);
  const [isAccessLoading, setIsAccessLoading] = useState(false);
  const [isAccessSaving, setIsAccessSaving] = useState(false);

  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [services, setServices] = useState<ServiceType[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [scopeInput, setScopeInput] = useState<UserScopeInput>({ level: ScopeLevel.ALL });

  const [totalUsers, setTotalUsers] = useState(0);
  const pagination = usePagination(totalUsers, 10);
  const { currentPage, goToPage } = pagination;

  const getUserDisplayName = (user: User) =>
    [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || (user as { fullName?: string }).fullName || user.email;

  // Load users
  const loadUsers = useCallback(async () => {
    if (!isUrlReady) return;

    try {
      setLoading(true);
      const params = {
        page: currentPage,
        limit: 10,
        ...(roleFilter !== 'ALL' && { role: roleFilter }),
        ...(statusFilter !== 'ALL' && { status: statusFilter }),
        ...(searchQuery.trim() && { search: searchQuery.trim() }),
      };
      const response = await apiClient.getUsers(params);
      setUsers(response.data);
      setTotalUsers(response.total);
    } catch (err) {
      show(err instanceof Error ? err.message : 'Помилка при завантаженні користувачів', 'error');
    } finally {
      setLoading(false);
    }
  }, [currentPage, isUrlReady, roleFilter, searchQuery, show, statusFilter]);

  const deleteAction = useDeleteAction<User>({
    onDelete: (user) => apiClient.deactivateUser(user.id),
    onSuccess: async () => {
      show('Користувача деактивовано', 'success');
      await loadUsers();
    },
  });

  useEffect(() => {
    if (!router.isReady) return;

    const nextSearch = readQueryParam(router.query, URL_QUERY_KEYS.search, '');
    const nextRole = readEnumQueryParam(router.query, URL_QUERY_KEYS.role, ['ALL', Role.OPERATOR, Role.ADMIN, Role.SYSADMIN] as const, 'ALL');
    const nextStatus = readEnumQueryParam(router.query, URL_QUERY_KEYS.status, ['ALL', 'ACTIVE', 'INACTIVE'] as const, 'ALL');
    const nextPage = readPositiveIntQueryParam(router.query, URL_QUERY_KEYS.page, 1);

    setSearchQuery(nextSearch);
    setRoleFilter(nextRole);
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
    if (roleFilter !== 'ALL') {
      nextQuery[URL_QUERY_KEYS.role] = roleFilter;
    }
    if (statusFilter !== 'ALL') {
      nextQuery[URL_QUERY_KEYS.status] = statusFilter;
    }
    if (currentPage > 1) {
      nextQuery[URL_QUERY_KEYS.page] = String(currentPage);
    }

    void replaceShallowQuery(router, nextQuery);
  }, [currentPage, isUrlReady, roleFilter, router, searchQuery, statusFilter]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    const loadAccessRefs = async () => {
      try {
        const [permissionsRes, servicesRes, countriesRes, citiesRes, districtsRes, branchesRes] = await Promise.all([
          apiClient.getPermissions({ limit: 100 }),
          apiClient.getServices(),
          apiClient.getCountries(),
          apiClient.getCities(),
          apiClient.getDistricts(),
          apiClient.getBranches(),
        ]);

        setPermissions(permissionsRes.data);
        setServices(servicesRes);
        setCountries(countriesRes);
        setCities(citiesRes);
        setDistricts(districtsRes);
        setBranches(branchesRes);
      } catch {
        // Keep page usable even if access refs fail to load.
      }
    };

    loadAccessRefs();
  }, []);

  const handleCreateUser = async (data: any) => {
    try {
      const fullName = [data.firstName, data.lastName].filter(Boolean).join(' ').trim();
      const newUser = await apiClient.createUser({
        fullName,
        email: data.email,
        phone: data.phoneNumber,
        role: data.roleId,
      });
      setUsers([newUser, ...users]);
      setTotalUsers(totalUsers + 1);
      setIsCreateModalOpen(false);
      show('Користувача створено', 'success');
    } catch (err) {
      show(`Помилка при створенні користувача: ${err instanceof Error ? err.message : ''}`, 'error');
    }
  };

  const handleUpdateUser = async (data: any) => {
    if (!editingUser) return;

    try {
      const fullName = [data.firstName, data.lastName].filter(Boolean).join(' ').trim();
      const updated = await apiClient.updateUser(editingUser.id, {
        fullName,
        email: data.email,
        phone: data.phoneNumber,
      });
      setUsers(users.map((u) => (u.id === updated.id ? updated : u)));
      setIsEditModalOpen(false);
      setEditingUser(null);
      show('Користувача оновлено', 'success');
    } catch (err) {
      show(`Помилка при оновленні користувача: ${err instanceof Error ? err.message : ''}`, 'error');
    }
  };

  const handleDeleteUser = async () => {
    try {
      await deleteAction.execute();
    } catch (err) {
      show(`Помилка при видаленні користувача: ${err instanceof Error ? err.message : ''}`, 'error');
    }
  };

  const handleResetPassword = async (userId: string) => {
    try {
      const result = await apiClient.resetUserPassword(userId);
      if (result.passwordEmailSent) {
        show('Пароль відновлено і надіслано на email користувача.', 'success');
      } else if (result.newPassword) {
        show(`Пароль відновлено. Тимчасовий пароль: ${result.newPassword}`, 'success');
      } else {
        show('Пароль відновлено, але email не налаштовано.', 'warning');
      }
    } catch (err) {
      show(`Помилка при відновленні пароля: ${err instanceof Error ? err.message : ''}`, 'error');
    }
  };

  const openAccessModal = async (user: User) => {
    setSelectedAccessUser(user);
    setIsAccessModalOpen(true);
    setIsAccessLoading(true);

    // Initial fallback from user profile while snapshot is loading.
    setScopeInput({
      level: user.scopeLevel,
      countryId: user.countryId,
      cityId: user.cityId,
      districtId: user.districtId,
      branchId: user.branchId,
    });
    setSelectedPermissions([]);
    setSelectedServiceIds([]);

    try {
      const snapshot = await apiClient.getUserAccess(user.id);
      setSelectedPermissions(snapshot.permissions ?? []);
      setSelectedServiceIds(snapshot.serviceIds ?? []);
      if (snapshot.scopes && snapshot.scopes.length > 0) {
        setScopeInput(snapshot.scopes[0]);
      }
    } catch (err) {
      show(err instanceof Error ? err.message : 'Не вдалося завантажити поточні доступи', 'error');
    } finally {
      setIsAccessLoading(false);
    }
  };

  const handleSaveAccess = async () => {
    if (!selectedAccessUser) return;

    if (selectedPermissions.length === 0) {
      show('Оберіть хоча б один permission', 'warning');
      return;
    }

    if (selectedServiceIds.length === 0) {
      show('Оберіть хоча б одну послугу для доступу', 'warning');
      return;
    }

    try {
      setIsAccessSaving(true);
      await Promise.all([
        apiClient.updateUserPermissions(selectedAccessUser.id, selectedPermissions),
        apiClient.updateUserScopes(selectedAccessUser.id, [scopeInput]),
        apiClient.updateUserServiceAccess(selectedAccessUser.id, selectedServiceIds),
      ]);
      show('Доступи користувача оновлено', 'success');
      setIsAccessModalOpen(false);
      setSelectedAccessUser(null);
    } catch (err) {
      show(err instanceof Error ? err.message : 'Помилка при оновленні доступів', 'error');
    } finally {
      setIsAccessSaving(false);
    }
  };

  const togglePermission = (code: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(code) ? prev.filter((p) => p !== code) : [...prev, code],
    );
  };

  const toggleService = (serviceId: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(serviceId) ? prev.filter((id) => id !== serviceId) : [...prev, serviceId],
    );
  };

  const getRoleLabel = (role: Role) => {
    const roleMap: Record<Role, string> = {
      [Role.OPERATOR]: 'Оператор',
      [Role.ADMIN]: 'Адміністратор',
      [Role.SYSADMIN]: 'Сист. адмін',
    };
    return roleMap[role];
  };

  const getScopeLevelLabel = (level: ScopeLevel) => {
    const levelMap: Record<ScopeLevel, string> = {
      [ScopeLevel.ALL]: 'Всі рівні',
      [ScopeLevel.COUNTRY]: 'Країна',
      [ScopeLevel.CITY]: 'Місто',
      [ScopeLevel.DISTRICT]: 'Район',
      [ScopeLevel.BRANCH]: 'Філія',
    };
    return levelMap[level];
  };

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

  const handleExportUsers = async () => {
    try {
      setIsExporting(true);

      const requestParams = {
        limit: 100,
        ...(roleFilter !== 'ALL' && { role: roleFilter }),
        ...(statusFilter !== 'ALL' && { status: statusFilter }),
        ...(searchQuery.trim() && { search: searchQuery.trim() }),
      };

      const firstPage = await apiClient.getUsers({ ...requestParams, page: 1 });
      const exportUsers = [...firstPage.data];
      const totalPages = Math.max(1, Math.ceil(firstPage.total / 100));

      for (let page = 2; page <= totalPages; page += 1) {
        const response = await apiClient.getUsers({ ...requestParams, page });
        exportUsers.push(...response.data);
      }

      const rows = [
        ['Ім\'я', 'Email', 'Телефон', 'Роль', 'Статус', 'Дозвіл', 'Створений'].map(csvEscape).join(';'),
        ...exportUsers.map((user) => [
          getUserDisplayName(user),
          user.email,
          user.phoneNumber ?? '',
          getRoleLabel(user.roleId),
          user.isActive ? 'Активний' : 'Неактивний',
          getScopeLevelLabel(user.scopeLevel),
          formatDateTime(user.createdAt),
        ].map(csvEscape).join(';')),
      ];

      const suffix = [roleFilter !== 'ALL' ? roleFilter : null, statusFilter !== 'ALL' ? statusFilter : null, searchQuery.trim() ? 'search' : null]
        .filter(Boolean)
        .join('_');
      const filename = `users${suffix ? `_${suffix}` : ''}.csv`;
      downloadCsv(filename, rows);

      show(`Експортовано ${exportUsers.length} користувачів`, 'success');
    } catch (err) {
      show(err instanceof Error ? err.message : 'Не вдалося експортувати користувачів', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const actionButtonClass =
    'inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2';

  const clearFilters = () => {
    setRoleFilter('ALL');
    setStatusFilter('ALL');
    setSearchQuery('');
    goToPage(1);
  };

  const columns: DataTableColumn<User>[] = [
    {
      key: 'firstName',
      label: "Ім'я",
      width: '150px',
      render: (_, user) => getUserDisplayName(user),
    },
    {
      key: 'email',
      label: 'Email',
    },
    {
      key: 'phoneNumber',
      label: 'Телефон',
      width: '150px',
    },
    {
      key: 'roleId',
      label: 'Роль',
      width: '150px',
      render: (roleId) => <span className="badge badge-info">{getRoleLabel(roleId as Role)}</span>,
    },
    {
      key: 'scopeLevel',
      label: 'Дозвіл',
      width: '120px',
      render: (level) => <span className="badge badge-secondary">{getScopeLevelLabel(level as ScopeLevel)}</span>,
    },
    {
      key: 'isActive',
      label: 'Статус',
      width: '100px',
      render: (isActive) => (
        <span className={`badge ${isActive ? 'badge-success' : 'badge-danger'}`}>
          {isActive ? 'Активний' : 'Неактивний'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Створений',
      width: '180px',
      render: (value) => formatDateTime(new Date(value)),
    },
  ];

  return (
    <>
      <Head>
        <title>Користувачі - SoftTurn</title>
      </Head>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Користувачі</h1>
            <p className="text-gray-600 mt-2">Управління користувачами та їхніми правами</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportUsers}
              className="btn btn-white"
              disabled={isExporting || loading}
            >
              {isExporting ? (
                <>
                  <span className="spinner inline-block mr-2 h-4 w-4"></span>
                  Експорт...
                </>
              ) : (
                <>
                  <Download size={16} className="mr-2" />
                  CSV експорт
                </>
              )}
            </button>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="btn btn-primary"
            >
              + Новий користувач
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="card">
          <div className="grid gap-4 md:grid-cols-4">
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
                  placeholder="Ім'я, email або телефон"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">Роль</label>
              <div className="relative mt-2">
                <select
                  value={roleFilter}
                  onChange={(e) => {
                    setRoleFilter(e.target.value as Role | 'ALL');
                    goToPage(1);
                  }}
                  className="form-select pr-10 appearance-none"
                >
                  <option value="ALL">Всі ролі</option>
                  <option value={Role.OPERATOR}>Оператор</option>
                  <option value={Role.ADMIN}>Адміністратор</option>
                  <option value={Role.SYSADMIN}>Системний адміністратор</option>
                </select>
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
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
                  <option value="ALL">Всі статуси</option>
                  <option value="ACTIVE">Активні</option>
                  <option value="INACTIVE">Неактивні</option>
                </select>
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
              </div>
            </div>

            <div className="md:col-span-4 flex justify-end">
              <button type="button" onClick={clearFilters} className="btn btn-white btn-small">
                <X size={16} className="mr-2" />
                Скинути фільтри
              </button>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700">Разом користувачів</label>
              <p className="text-2xl font-bold text-blue-600 mt-2">{totalUsers}</p>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="card">
          <DataTable<User>
            columns={columns}
            data={users}
            rowKey="id"
            loading={loading}
            emptyMessage="Немає користувачів"
            pagination={{
              total: totalUsers,
              pageSize: 10,
              currentPage: pagination.currentPage,
              onPageChange: (page) => pagination.goToPage(page),
            }}
            actions={(user) => (
              <div className="flex items-center gap-1 flex-wrap">
                <button
                  onClick={() => {
                    setEditingUser(user);
                    setIsEditModalOpen(true);
                  }}
                  className={`${actionButtonClass} text-blue-600 hover:bg-blue-50 hover:text-blue-800`}
                  title="Редагувати"
                  aria-label="Редагувати"
                >
                  <PencilLine size={16} />
                </button>
                <button
                  onClick={() => handleResetPassword(user.id)}
                  className={`${actionButtonClass} text-orange-600 hover:bg-orange-50 hover:text-orange-800`}
                  title="Скинути пароль"
                  aria-label="Скинути пароль"
                >
                  <KeyRound size={16} />
                </button>
                <button
                  onClick={() => openAccessModal(user)}
                  className={`${actionButtonClass} text-indigo-600 hover:bg-indigo-50 hover:text-indigo-800`}
                  title="Доступи"
                  aria-label="Доступи"
                >
                  <LockKeyhole size={16} />
                </button>
                {user.isActive && (
                  <button
                    onClick={() => deleteAction.setDeleteConfirm(user)}
                    className={`${actionButtonClass} text-red-600 hover:bg-red-50 hover:text-red-800`}
                    title="Деактивувати"
                    aria-label="Деактивувати"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            )}
          />
        </div>
      </div>

      {/* Create User Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Створити нового користувача"
        size="lg"
      >
        <UserForm
          onSubmit={handleCreateUser}
          isLoading={false}
        />
      </Modal>

      {/* Edit User Modal */}
      {editingUser && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingUser(null);
          }}
          title={`Редагувати ${getUserDisplayName(editingUser)}`}
          size="lg"
        >
          <UserForm
            initialData={editingUser}
            onSubmit={handleUpdateUser}
            isLoading={false}
            isEditMode
          />
        </Modal>
      )}

      {selectedAccessUser && (
        <Modal
          isOpen={isAccessModalOpen}
          onClose={() => {
            setIsAccessModalOpen(false);
            setSelectedAccessUser(null);
          }}
          title={`Доступи: ${getUserDisplayName(selectedAccessUser)}`}
          size="lg"
        >
          <div className="space-y-6">
            {isAccessLoading && (
              <div className="alert alert-info">
                <span className="spinner inline-block mr-2 h-4 w-4"></span>
                Завантаження поточних доступів...
              </div>
            )}

            <div className="alert alert-warning">
              Тут налаштовується, які послуги може виконувати цей користувач. Це персональні доступи користувача, а не створення нових послуг.
            </div>

            <div className="alert alert-info">
              Оновлення замінює поточні призначення. Якщо залишити список порожнім, бекенд відхилить запит.
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Права доступу (Permissions)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-56 overflow-y-auto border rounded p-3">
                {permissions.map((perm) => (
                  <label key={perm.id} className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedPermissions.includes(perm.code)}
                      onChange={() => togglePermission(perm.code)}
                      disabled={isAccessLoading || isAccessSaving}
                    />
                    <span>
                      <span className="font-medium text-gray-900">{perm.code}</span>
                      {perm.description && (
                        <span className="text-gray-500 block">{perm.description}</span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Рівень видимості (Scope)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="form-group md:col-span-2">
                  <label className="form-label">Рівень scope</label>
                  <select
                    className="form-select"
                    value={scopeInput.level}
                    onChange={(e) => {
                      const level = e.target.value as ScopeLevel;
                      setScopeInput({ level });
                    }}
                    disabled={isAccessLoading || isAccessSaving}
                  >
                    <option value={ScopeLevel.ALL}>ALL</option>
                    <option value={ScopeLevel.COUNTRY}>COUNTRY</option>
                    <option value={ScopeLevel.CITY}>CITY</option>
                    <option value={ScopeLevel.DISTRICT}>DISTRICT</option>
                    <option value={ScopeLevel.BRANCH}>BRANCH</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Країна</label>
                  <select
                    className="form-select"
                    value={scopeInput.countryId ?? ''}
                    onChange={(e) => setScopeInput((prev) => ({ ...prev, countryId: e.target.value || undefined }))}
                    disabled={isAccessLoading || isAccessSaving || scopeInput.level === ScopeLevel.ALL}
                  >
                    <option value="">—</option>
                    {countries.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Місто</label>
                  <select
                    className="form-select"
                    value={scopeInput.cityId ?? ''}
                    onChange={(e) => setScopeInput((prev) => ({ ...prev, cityId: e.target.value || undefined }))}
                    disabled={
                      isAccessLoading ||
                      isAccessSaving ||
                      scopeInput.level === ScopeLevel.ALL ||
                      scopeInput.level === ScopeLevel.COUNTRY
                    }
                  >
                    <option value="">—</option>
                    {cities.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Район</label>
                  <select
                    className="form-select"
                    value={scopeInput.districtId ?? ''}
                    onChange={(e) => setScopeInput((prev) => ({ ...prev, districtId: e.target.value || undefined }))}
                    disabled={
                      isAccessLoading ||
                      isAccessSaving ||
                      scopeInput.level === ScopeLevel.ALL ||
                      scopeInput.level === ScopeLevel.COUNTRY ||
                      scopeInput.level === ScopeLevel.CITY
                    }
                  >
                    <option value="">—</option>
                    {districts.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Філія</label>
                  <select
                    className="form-select"
                    value={scopeInput.branchId ?? ''}
                    onChange={(e) => setScopeInput((prev) => ({ ...prev, branchId: e.target.value || undefined }))}
                    disabled={
                      isAccessLoading ||
                      isAccessSaving ||
                      scopeInput.level !== ScopeLevel.BRANCH
                    }
                  >
                    <option value="">—</option>
                    {branches.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h3 className="text-sm font-semibold text-gray-700">Призначення послуг оператору</h3>
                <span className="badge badge-info">
                  Обрано {selectedServiceIds.length} з {services.length}
                </span>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Позначте послуги, які цей оператор або адміністратор може виконувати у роботі.
              </p>
              <div className="flex flex-wrap gap-2 mb-3">
                <button
                  type="button"
                  className="btn btn-small btn-secondary"
                  onClick={() => setSelectedServiceIds(services.map((service) => service.id))}
                  disabled={isAccessLoading || isAccessSaving || services.length === 0}
                >
                  Обрати всі
                </button>
                <button
                  type="button"
                  className="btn btn-small btn-white"
                  onClick={() => setSelectedServiceIds([])}
                  disabled={isAccessLoading || isAccessSaving || selectedServiceIds.length === 0}
                >
                  Очистити вибір
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-56 overflow-y-auto border rounded p-3">
                {services.map((service) => (
                  <label key={service.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedServiceIds.includes(service.id)}
                      onChange={() => toggleService(service.id)}
                      disabled={isAccessLoading || isAccessSaving}
                    />
                    <span>{service.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                className="btn btn-white"
                onClick={() => {
                  setIsAccessModalOpen(false);
                  setSelectedAccessUser(null);
                }}
                disabled={isAccessSaving || isAccessLoading}
              >
                Скасувати
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveAccess}
                disabled={isAccessSaving || isAccessLoading}
              >
                {isAccessSaving ? (
                  <>
                    <span className="spinner inline-block mr-2 h-4 w-4"></span>
                    Зберігаю...
                  </>
                ) : (
                  <>
                    <Save size={16} className="mr-2" />
                    Зберегти доступи
                  </>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!deleteAction.deleteConfirm}
        title="Деактивувати користувача"
        message={`Ви впевнені, що хочете деактивувати користувача ${deleteAction.deleteConfirm?.email}? Це не видалить дані, але користувач не зможе входити.`}
        onConfirm={() => void handleDeleteUser()}
        onCancel={() => deleteAction.setDeleteConfirm(null)}
        isDangerous
        isLoading={deleteAction.isDeleting}
      />
    </>
  );
}

export default withDashboard(UsersPage);
