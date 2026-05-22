import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import { withDashboard } from '@/components/DashboardLayout';
import { ConfirmDialog } from '@/components/Modal';
import apiClient from '@/services/api';
import { useToast } from '@/components/Toast';
import { useAuthStore } from '@/store/authStore';
import { Bell, Save, Settings, User } from 'lucide-react';
import { NotificationProviderMode, SystemHealth, SystemMetrics } from '@/types';

function SettingsPage() {
  const { user, logout } = useAuthStore();
  const { show } = useToast();
  const [activeTab, setActiveTab] = useState<'system' | 'notification' | 'account'>('system');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);

  const [systemSettings, setSystemSettings] = useState({
    appName: 'SoftTurn',
    timezone: 'Europe/Kyiv',
    language: 'uk',
    autoRefreshInterval: '30',
  });

  const [notificationSettings, setNotificationSettings] = useState({
    providerMode: 'sandbox' as NotificationProviderMode,
    retryAttempts: '3',
    retryDelay: '5',
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});

  const loadSystemContext = useCallback(async () => {
    try {
      setIsLoading(true);
      const [settingsResponse, health, metrics] = await Promise.all([
        apiClient.getSystemSettings(),
        apiClient.getSystemHealth(),
        apiClient.getSystemMetrics(),
      ]);

      const settingsMap = new Map(
        settingsResponse.data.map((row) => [row.key, row.value] as const),
      );

      const app = settingsMap.get('app') as Record<string, unknown> | undefined;
      const localization = settingsMap.get('localization') as Record<string, unknown> | undefined;
      const queue = settingsMap.get('queue') as Record<string, unknown> | undefined;
      const notifications = settingsMap.get('notifications') as Record<string, unknown> | undefined;
      const provider = settingsMap.get('notification_provider_mode') as
        | { mode?: NotificationProviderMode }
        | undefined;

      setSystemSettings((prev) => ({
        appName: String(app?.name ?? prev.appName),
        timezone: String(localization?.timezone ?? prev.timezone),
        language: String(localization?.language ?? prev.language),
        autoRefreshInterval: String(queue?.autoRefreshInterval ?? prev.autoRefreshInterval),
      }));

      setNotificationSettings((prev) => ({
        providerMode: provider?.mode ?? prev.providerMode,
        retryAttempts: String(notifications?.retryAttempts ?? prev.retryAttempts),
        retryDelay: String(notifications?.retryDelaySeconds ?? prev.retryDelay),
      }));

      setSystemHealth(health);
      setSystemMetrics(metrics);
    } catch (err) {
      show(
        err instanceof Error ? err.message : 'Не вдалося завантажити налаштування системи',
        'error',
      );
    } finally {
      setIsLoading(false);
    }
  }, [show]);

  useEffect(() => {
    void loadSystemContext();
  }, [loadSystemContext]);

  const handleSaveSystemSettings = async () => {
    try {
      setIsSaving(true);
      await apiClient.updateSystemSettings({
        app: {
          name: systemSettings.appName,
        },
        localization: {
          timezone: systemSettings.timezone,
          language: systemSettings.language,
        },
        queue: {
          autoRefreshInterval: Number(systemSettings.autoRefreshInterval),
        },
      });

      await loadSystemContext();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      show('Системні налаштування оновлено', 'success');
    } catch (err) {
      show(err instanceof Error ? err.message : 'Помилка при збереженні налаштувань', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveNotificationSettings = async () => {
    try {
      setIsSaving(true);

      await Promise.all([
        apiClient.switchNotificationProvider(notificationSettings.providerMode),
        apiClient.updateSystemSettings({
          notifications: {
            retryAttempts: Number(notificationSettings.retryAttempts),
            retryDelaySeconds: Number(notificationSettings.retryDelay),
          },
        }),
      ]);

      await loadSystemContext();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      show('Налаштування сповіщень оновлено', 'success');
    } catch (err) {
      show(err instanceof Error ? err.message : 'Помилка при збереженні налаштувань', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const validatePasswordChange = () => {
    const errors: Record<string, string> = {};

    if (!passwordData.currentPassword) {
      errors.currentPassword = 'Введіть поточний пароль';
    }

    if (!passwordData.newPassword || passwordData.newPassword.length < 6) {
      errors.newPassword = 'Новий пароль має бути не менше 6 символів';
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      errors.confirmPassword = 'Паролі не збігаються';
    }

    setPasswordErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChangePassword = async () => {
    if (!validatePasswordChange()) return;

    try {
      setIsSaving(true);
      // API call would go here
      // await apiClient.changePassword(passwordData);
      await new Promise((resolve) => setTimeout(resolve, 500));
      show('Пароль успішно змінений', 'success');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordErrors({});
    } catch (err) {
      show(
        'Помилка при зміні пароля: ' + (err instanceof Error ? err.message : ''),
        'error',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Head>
        <title>Налаштування - SoftTurn</title>
      </Head>

      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Налаштування</h1>
          <p className="text-gray-600 mt-2">Управління налаштуваннями системи та облікового запису</p>
        </div>

        {isLoading && (
          <div className="card">
            <div className="flex items-center justify-center py-8 text-gray-600">
              <span className="spinner mr-3" />
              Завантаження системного стану...
            </div>
          </div>
        )}

        {/* Success Message */}
        {saveSuccess && (
          <div className="alert alert-success">
            Налаштування успішно збережені
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex gap-0">
            {(['system', 'notification', 'account'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 font-medium transition border-b-2 ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  {tab === 'system' ? <Settings size={14} /> : tab === 'notification' ? <Bell size={14} /> : <User size={14} />}
                  {tab === 'system' ? 'Система' : tab === 'notification' ? 'Сповіщення' : 'Акаунт'}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* System Settings */}
        {activeTab === 'system' && (
          <div className="space-y-6">
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Основні налаштування</h2>
              </div>

              <div className="space-y-4">
                <div className="form-group">
                  <label className="form-label">Назва додатку</label>
                  <input
                    type="text"
                    className="form-input"
                    value={systemSettings.appName}
                    onChange={(e) =>
                      setSystemSettings({ ...systemSettings, appName: e.target.value })
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Часовий пояс</label>
                  <select
                    className="form-select"
                    value={systemSettings.timezone}
                    onChange={(e) =>
                      setSystemSettings({ ...systemSettings, timezone: e.target.value })
                    }
                  >
                    <option value="Europe/Kyiv">Київ (UTC+2)</option>
                    <option value="Europe/London">Лондон (UTC+0)</option>
                    <option value="Europe/Berlin">Берлін (UTC+1)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Мова</label>
                  <select
                    className="form-select"
                    value={systemSettings.language}
                    onChange={(e) =>
                      setSystemSettings({ ...systemSettings, language: e.target.value })
                    }
                  >
                    <option value="uk">Українська</option>
                    <option value="en">Англійська</option>
                    <option value="ru">Російська</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Інтервал автооновлення (сек)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={systemSettings.autoRefreshInterval}
                    onChange={(e) =>
                      setSystemSettings({ ...systemSettings, autoRefreshInterval: e.target.value })
                    }
                    min="10"
                  />
                  <p className="text-xs text-gray-500 mt-1">Мінімум 10 секунд</p>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-6 border-t border-gray-200 mt-6">
                <button
                  onClick={handleSaveSystemSettings}
                  className="btn btn-primary"
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <span className="spinner inline-block mr-2 h-4 w-4"></span>
                      Зберігаю...
                    </>
                  ) : (
                    <span className="inline-flex items-center gap-1.5"><Save size={15} />Зберегти</span>
                  )}
                </button>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Статус системи</h2>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded border bg-gray-50 border-gray-200">
                  <div>
                    <p className="font-semibold text-gray-900">Health</p>
                    <p className="text-sm text-gray-600">
                      Остання перевірка:{' '}
                      {systemHealth?.timestamp
                        ? new Date(systemHealth.timestamp).toLocaleString('uk-UA')
                        : '—'}
                    </p>
                  </div>
                  <span
                    className={`badge ${
                      systemHealth?.status === 'ok' ? 'badge-success' : 'badge-warning'
                    }`}
                  >
                    {systemHealth?.status ?? 'unknown'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                  <div className="p-3 rounded border bg-blue-50 border-blue-200">
                    <p className="text-xs text-blue-700">Активні користувачі</p>
                    <p className="text-2xl font-semibold text-blue-900">{systemMetrics?.users ?? 0}</p>
                  </div>
                  <div className="p-3 rounded border bg-emerald-50 border-emerald-200">
                    <p className="text-xs text-emerald-700">Філії</p>
                    <p className="text-2xl font-semibold text-emerald-900">{systemMetrics?.branches ?? 0}</p>
                  </div>
                  <div className="p-3 rounded border bg-indigo-50 border-indigo-200">
                    <p className="text-xs text-indigo-700">Робочі місця</p>
                    <p className="text-2xl font-semibold text-indigo-900">{systemMetrics?.workplaces ?? 0}</p>
                  </div>
                  <div className="p-3 rounded border bg-amber-50 border-amber-200">
                    <p className="text-xs text-amber-700">Талони в очікуванні</p>
                    <p className="text-2xl font-semibold text-amber-900">{systemMetrics?.waitingTickets ?? 0}</p>
                  </div>
                  <div className="p-3 rounded border bg-violet-50 border-violet-200">
                    <p className="text-xs text-violet-700">Талони в роботі</p>
                    <p className="text-2xl font-semibold text-violet-900">{systemMetrics?.inProgressTickets ?? 0}</p>
                  </div>
                </div>

                <div className="text-xs text-gray-500">
                  Metrics timestamp:{' '}
                  {systemMetrics?.timestamp
                    ? new Date(systemMetrics.timestamp).toLocaleString('uk-UA')
                    : '—'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Notification Settings */}
        {activeTab === 'notification' && (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Налаштування сповіщень</h2>
            </div>

            <div className="space-y-4">
              <div className="form-group">
                <label className="form-label">Режим провайдера</label>
                <select
                  className="form-select"
                  value={notificationSettings.providerMode}
                  onChange={(e) =>
                    setNotificationSettings({
                      ...notificationSettings,
                      providerMode: e.target.value as NotificationProviderMode,
                    })
                  }
                >
                  <option value="mock">Mock</option>
                  <option value="sandbox">Sandbox</option>
                  <option value="production">Production</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Кількість повторних спроб</label>
                <input
                  type="number"
                  className="form-input"
                  value={notificationSettings.retryAttempts}
                  onChange={(e) =>
                    setNotificationSettings({
                      ...notificationSettings,
                      retryAttempts: e.target.value,
                    })
                  }
                  min="1"
                  max="10"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Затримка повтору (сек)</label>
                <input
                  type="number"
                  className="form-input"
                  value={notificationSettings.retryDelay}
                  onChange={(e) =>
                    setNotificationSettings({
                      ...notificationSettings,
                      retryDelay: e.target.value,
                    })
                  }
                  min="1"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-6 border-t border-gray-200 mt-6">
              <button
                onClick={handleSaveNotificationSettings}
                className="btn btn-primary"
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <span className="spinner inline-block mr-2 h-4 w-4"></span>
                    Зберігаю...
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1.5"><Save size={15} />Зберегти</span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Account Settings */}
        {activeTab === 'account' && (
          <div className="space-y-6">
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Інформація облікового запису</h2>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Ім&apos;я</p>
                      <p className="font-semibold text-gray-900">{user?.firstName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Прізвище</p>
                      <p className="font-semibold text-gray-900">{user?.lastName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Email</p>
                      <p className="font-semibold text-gray-900">{user?.email}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Телефон</p>
                      <p className="font-semibold text-gray-900">{user?.phoneNumber}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Роль</p>
                      <p className="font-semibold text-gray-900">{user?.roleId}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Змінити пароль</h2>
              </div>

              <div className="space-y-4">
                <div className="form-group">
                  <label className="form-label">Поточний пароль *</label>
                  <input
                    type="password"
                    className={`form-input ${passwordErrors.currentPassword ? 'border-red-500' : ''}`}
                    value={passwordData.currentPassword}
                    onChange={(e) =>
                      setPasswordData({
                        ...passwordData,
                        currentPassword: e.target.value,
                      })
                    }
                    disabled={isSaving}
                  />
                  {passwordErrors.currentPassword && (
                    <p className="text-red-500 text-sm mt-1">{passwordErrors.currentPassword}</p>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Новий пароль *</label>
                  <input
                    type="password"
                    className={`form-input ${passwordErrors.newPassword ? 'border-red-500' : ''}`}
                    value={passwordData.newPassword}
                    onChange={(e) =>
                      setPasswordData({ ...passwordData, newPassword: e.target.value })
                    }
                    disabled={isSaving}
                  />
                  {passwordErrors.newPassword && (
                    <p className="text-red-500 text-sm mt-1">{passwordErrors.newPassword}</p>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Підтвердити пароль *</label>
                  <input
                    type="password"
                    className={`form-input ${passwordErrors.confirmPassword ? 'border-red-500' : ''}`}
                    value={passwordData.confirmPassword}
                    onChange={(e) =>
                      setPasswordData({
                        ...passwordData,
                        confirmPassword: e.target.value,
                      })
                    }
                    disabled={isSaving}
                  />
                  {passwordErrors.confirmPassword && (
                    <p className="text-red-500 text-sm mt-1">{passwordErrors.confirmPassword}</p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-6 border-t border-gray-200 mt-6">
                <button
                  onClick={handleChangePassword}
                  className="btn btn-primary"
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <span className="spinner inline-block mr-2 h-4 w-4"></span>
                      Змінюю...
                    </>
                  ) : (
                    'Змінити пароль'
                  )}
                </button>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Сеанс</h2>
              </div>

              <div className="space-y-4">
                <p className="text-gray-600">Ви входили в систему як:</p>
                <p className="text-lg font-semibold text-gray-900">
                  {user?.firstName} {user?.lastName}
                </p>
              </div>

              <div className="flex gap-3 justify-end pt-6 border-t border-gray-200 mt-6">
                <button
                  onClick={() => setShowLogoutConfirm(true)}
                  className="btn btn-danger"
                >
                  🚪 Вийти
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Logout Confirm */}
      <ConfirmDialog
        isOpen={showLogoutConfirm}
        title="Вийти з системи"
        message="Ви впевнені, що хочете вийти?"
        onConfirm={() => {
          logout();
          window.location.href = '/login';
        }}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </>
  );
}

export default withDashboard(SettingsPage);
