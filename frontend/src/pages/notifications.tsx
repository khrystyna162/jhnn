import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { withDashboard } from '@/components/DashboardLayout';
import { DataTable, DataTableColumn } from '@/components/DataTable';
import { Modal, ConfirmDialog } from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { FileText, ListChecks, PencilLine, Trash2, Send } from 'lucide-react';
import apiClient from '@/services/api';
import { useFormState, useDeleteAction } from '@/hooks';
import { DeliveryStatus, Notification, NotificationTemplate } from '@/types';
import { formatDateTime } from '@/utils/formatters';
import { readEnumQueryParam, replaceShallowQuery } from '@/utils/urlQuery';
import { URL_QUERY_KEYS } from '@/utils/urlQueryKeys';

function NotificationsPage() {
  const router = useRouter();
  const { show: showToast } = useToast();
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUrlReady, setIsUrlReady] = useState(false);
  const [channelFilter, setChannelFilter] = useState<string>('ALL');

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [testPhoneNumber, setTestPhoneNumber] = useState('');
  const [isTestSending, setIsTestSending] = useState(false);

  // Delivery log
  type DeliveryLogItem = Notification & { ticket?: { number: string } };
  const [activeView, setActiveView] = useState<'templates' | 'delivery-log'>('templates');
  const [deliveryLog, setDeliveryLog] = useState<DeliveryLogItem[]>([]);
  const [deliveryLogLoading, setDeliveryLogLoading] = useState(false);
  const [deliveryLogTotal, setDeliveryLogTotal] = useState(0);
  const [deliveryLogPage, setDeliveryLogPage] = useState(1);

  const form = useFormState({
    initialData: {
      code: '',
      channel: 'SMS',
      text: '',
      description: '',
    },
    validator: (data) => {
      const errors: Record<string, string> = {};

      if (!data.code.trim()) {
        errors.code = 'Код обов\'язковий';
      }

      if (!data.text.trim()) {
        errors.text = 'Текст повідомлення обов\'язковий';
      }

      if (!data.channel) {
        errors.channel = 'Канал обов\'язковий';
      }

      return errors;
    },
  });

  const [totalTemplates, setTotalTemplates] = useState(0);

  const loadDeliveryLog = useCallback(async (page = deliveryLogPage) => {
    try {
      setDeliveryLogLoading(true);
      const response = await apiClient.getNotificationDeliveryLog({ page, limit: 25 });
      setDeliveryLog(response.data as DeliveryLogItem[]);
      setDeliveryLogTotal(response.total);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Помилка при завантаженні журналу', 'error');
    } finally {
      setDeliveryLogLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveryLogPage, showToast]);

  // Load templates
  const loadTemplates = useCallback(async () => {
    if (!isUrlReady) return;

    try {
      setLoading(true);
      const response = await apiClient.getNotificationTemplates();
      const filtered =
        channelFilter === 'ALL'
          ? response
          : response.filter((t) => t.channel === channelFilter);
      setTemplates(filtered);
      setTotalTemplates(filtered.length);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Помилка при завантаженні шаблонів', 'error');
    } finally {
      setLoading(false);
    }
  }, [channelFilter, isUrlReady, showToast]);

  const deleteAction = useDeleteAction<NotificationTemplate>({
    onDelete: (template) => apiClient.deleteNotificationTemplate(template.id),
    onSuccess: async () => {
      showToast('Шаблон видалено', 'success');
      await loadTemplates();
    },
  });

  useEffect(() => {
    if (!router.isReady) return;

    const nextChannel = readEnumQueryParam(router.query, URL_QUERY_KEYS.channel, ['ALL', 'SMS', 'VIBER'] as const, 'ALL');
    const nextView = readEnumQueryParam(router.query, URL_QUERY_KEYS.tab, ['templates', 'delivery-log'] as const, 'templates');
    setChannelFilter(nextChannel);
    setActiveView(nextView);
    setIsUrlReady(true);
  }, [router.isReady, router.query]);

  useEffect(() => {
    if (!router.isReady || !isUrlReady) return;

    const nextQuery: Record<string, string> = {};
    if (channelFilter !== 'ALL') {
      nextQuery[URL_QUERY_KEYS.channel] = channelFilter;
    }
    if (activeView !== 'templates') {
      nextQuery[URL_QUERY_KEYS.tab] = activeView;
    }

    void replaceShallowQuery(router, nextQuery);
  }, [activeView, channelFilter, isUrlReady, router]);

  useEffect(() => {
    if (isUrlReady && activeView === 'delivery-log') {
      void loadDeliveryLog(1);
    }
  }, [activeView, isUrlReady, loadDeliveryLog]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.validate()) return;

    try {
      form.setIsSubmitting(true);
      await apiClient.createNotificationTemplate({
        code: form.data.code,
        channel: form.data.channel,
        text: form.data.text,
        description: form.data.description || undefined,
      });
      showToast('Шаблон створено', 'success');
      await loadTemplates();
      form.reset();
      setIsCreateModalOpen(false);
    } catch (err) {
      showToast(`Помилка при створенні шаблону: ${err instanceof Error ? err.message : ''}`, 'error');
    } finally {
      form.setIsSubmitting(false);
    }
  };

  const handleUpdateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingTemplate || !form.validate()) return;

    try {
      form.setIsSubmitting(true);
      await apiClient.updateNotificationTemplate(editingTemplate.id, {
        text: form.data.text,
      });
      showToast('Шаблон оновлено', 'success');
      await loadTemplates();
      setIsEditModalOpen(false);
      setEditingTemplate(null);
      form.reset();
      form.clearErrors();
    } catch (err) {
      showToast(`Помилка при оновленні шаблону: ${err instanceof Error ? err.message : ''}`, 'error');
    } finally {
      form.setIsSubmitting(false);
    }
  };

  const handleTestSend = async (templateId: string) => {
    if (!testPhoneNumber.trim()) {
      showToast('Введіть номер телефону', 'error');
      return;
    }

    try {
      setIsTestSending(true);
      await apiClient.testSendNotification({
        templateId,
        phone: testPhoneNumber,
      });
      showToast('Тестове повідомлення відправлено!', 'success');
      setTestPhoneNumber('');
    } catch (err) {
      showToast(`Помилка при відправленні: ${err instanceof Error ? err.message : ''}`, 'error');
    } finally {
      setIsTestSending(false);
    }
  };

  const handleDeleteTemplate = async () => {
    try {
      await deleteAction.execute();
    } catch (err) {
      showToast(`Помилка при видаленні шаблону: ${err instanceof Error ? err.message : ''}`, 'error');
    }
  };

  const resetForm = () => {
    form.reset();
    form.clearErrors();
  };

  const columns: DataTableColumn<NotificationTemplate>[] = [
    {
      key: 'code',
      label: 'Код шаблону',
      sortable: true,
    },
    {
      key: 'channel',
      label: 'Канал',
      width: '100px',
      render: (channel) => (
        <span className={`badge ${channel === 'SMS' ? 'badge-info' : 'badge-success'}`}>
          {channel}
        </span>
      ),
    },
    {
      key: 'text',
      label: 'Текст',
      render: (text) => (
        <div className="max-w-xs truncate text-gray-600">{text}</div>
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
        <title>Сповіщення - SoftTurn</title>
      </Head>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Сповіщення</h1>
            <p className="text-gray-600 mt-2">Управління шаблонами SMS та Viber</p>
          </div>
          {activeView === 'templates' && (
            <button
              onClick={() => {
                resetForm();
                setEditingTemplate(null);
                setIsEditModalOpen(false);
                setIsCreateModalOpen(true);
              }}
              className="btn btn-primary"
            >
              + Новий шаблон
            </button>
          )}
        </div>

        {/* View Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex gap-1">
            {([
              { id: 'templates', label: 'Шаблони', Icon: FileText },
              { id: 'delivery-log', label: 'Журнал доставки', Icon: ListChecks },
            ] as const).map((view) => (
              <button
                key={view.id}
                onClick={() => setActiveView(view.id)}
                className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors inline-flex items-center gap-1.5 ${
                  activeView === view.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <view.Icon size={14} />
                {view.label}
              </button>
            ))}
          </nav>
        </div>

        {activeView === 'templates' && (
          <>
        {/* Filters */}
        <div className="card">
          <div className="flex gap-4 flex-wrap">
            <div>
              <label className="text-sm font-semibold text-gray-700">Канал</label>
              <select
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
                className="form-select mt-2"
              >
                <option value="ALL">Усі канали</option>
                <option value="SMS">SMS</option>
                <option value="VIBER">Viber</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700">Разом шаблонів</label>
              <p className="text-2xl font-bold text-blue-600 mt-2">{totalTemplates}</p>
            </div>
          </div>
        </div>

        {/* Templates Table */}
        <div className="card">
          <DataTable<NotificationTemplate>
            columns={columns}
            data={templates}
            rowKey="id"
            loading={loading}
            emptyMessage="Немає шаблонів"
            actions={(template) => (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setEditingTemplate(template);
                    form.setData({
                      code: template.code,
                      channel: template.channel,
                      text: template.text,
                      description: template.description || '',
                    });
                    form.clearErrors();
                    setIsCreateModalOpen(false);
                    setIsEditModalOpen(true);
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  title="Редагувати"
                  aria-label="Редагувати"
                >
                  <PencilLine size={16} />
                </button>
                <button
                  onClick={() => {
                    setEditingTemplate(template);
                    setTestPhoneNumber('');
                    setIsCreateModalOpen(false);
                    setIsEditModalOpen(false);
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md text-green-600 hover:bg-green-50 hover:text-green-900"
                  title="Тест"
                  aria-label="Тест"
                >
                  <Send size={16} />
                </button>
                <button
                  onClick={() => deleteAction.setDeleteConfirm(template)}
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
          </>
        )}

        {activeView === 'delivery-log' && (
          <div className="card">
            <DataTable<Notification & { ticket?: { number: string } }>
              columns={[
                {
                  key: 'createdAt',
                  label: 'Дата',
                  width: '180px',
                  render: (value) => formatDateTime(new Date(value)),
                },
                {
                  key: 'channel',
                  label: 'Канал',
                  width: '90px',
                  render: (channel) => (
                    <span className={`badge ${channel === 'SMS' ? 'badge-info' : 'badge-success'}`}>
                      {channel}
                    </span>
                  ),
                },
                {
                  key: 'status',
                  label: 'Статус',
                  width: '110px',
                  render: (status) => (
                    <span
                      className={`badge ${
                        status === DeliveryStatus.SENT
                          ? 'badge-success'
                          : status === DeliveryStatus.FAILED
                          ? 'badge-danger'
                          : 'badge-warning'
                      }`}
                    >
                      {status === DeliveryStatus.SENT
                        ? 'Надіслано'
                        : status === DeliveryStatus.FAILED
                        ? 'Помилка'
                        : 'Не надіслано'}
                    </span>
                  ),
                },
                {
                  key: 'templateCode',
                  label: 'Шаблон',
                  width: '150px',
                  render: (code) => code ? <span className="font-mono text-xs text-gray-600">{code}</span> : '—',
                },
                {
                  key: 'providerName',
                  label: 'Провайдер',
                  width: '100px',
                  render: (name) => name || '—',
                },
                {
                  key: 'errorMessage',
                  label: 'Причина помилки',
                  render: (reason) =>
                    reason ? (
                      <span className="text-red-600 text-xs">{String(reason)}</span>
                    ) : null,
                },
              ]}
              data={deliveryLog}
              rowKey="id"
              loading={deliveryLogLoading}
              emptyMessage="Журнал доставки порожній"
              pagination={{
                total: deliveryLogTotal,
                pageSize: 25,
                currentPage: deliveryLogPage,
                onPageChange: (page) => {
                  setDeliveryLogPage(page);
                  void loadDeliveryLog(page);
                },
              }}
            />
          </div>
        )}
      </div>

      {/* Create/Edit Template Modal */}
      <Modal
        isOpen={isCreateModalOpen || isEditModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setIsEditModalOpen(false);
          setEditingTemplate(null);
          resetForm();
        }}
        title={editingTemplate ? `Редагувати шаблон: ${editingTemplate.code}` : 'Створити новий шаблон'}
        size="lg"
      >
        <form onSubmit={editingTemplate ? handleUpdateTemplate : handleCreateTemplate} className="space-y-4">
          <div className="form-group">
            <label className="form-label">{editingTemplate ? 'Код шаблону (лише перегляд)' : 'Код шаблону *'}</label>
            <input
              type="text"
              className={`form-input ${form.errors.code ? 'border-red-500' : ''} ${editingTemplate ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
              placeholder="TICKET_CREATED"
              value={editingTemplate ? editingTemplate.code : form.data.code}
              onChange={(e) => !editingTemplate && form.setField('code', e.target.value)}
              disabled={form.isSubmitting || !!editingTemplate}
              readOnly={!!editingTemplate}
            />
            {form.errors.code && <p className="text-red-500 text-sm mt-1">{form.errors.code}</p>}
            {!editingTemplate && <p className="text-xs text-gray-500 mt-1">Системний ключ шаблону (A-Z, підкреслення). Напр.: TICKET_CREATED</p>}
          </div>

          <div className="form-group">
            <label className="form-label">Канал *</label>
            <select
              className={`form-select ${form.errors.channel ? 'border-red-500' : ''} ${editingTemplate ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
              value={editingTemplate ? editingTemplate.channel : form.data.channel}
              onChange={(e) => !editingTemplate && form.setField('channel', e.target.value)}
              disabled={form.isSubmitting || !!editingTemplate}
            >
              <option value="SMS">SMS</option>
              <option value="VIBER">Viber</option>
            </select>
            {form.errors.channel && (
              <p className="text-red-500 text-sm mt-1">{form.errors.channel}</p>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Текст повідомлення *</label>
            <textarea
              className={`form-textarea ${form.errors.text ? 'border-red-500' : ''}`}
              placeholder="Ваш талон: {{ticketNumber}}. Послуга: {{serviceName}}. Відділення: {{branchName}}. Орієнтовний час: {{expectedTime}}"
              rows={4}
              value={form.data.text}
              onChange={(e) => form.setField('text', e.target.value)}
              disabled={form.isSubmitting}
            />
            {form.errors.text && (
              <p className="text-red-500 text-sm mt-1">{form.errors.text}</p>
            )}
            <p className="text-xs text-gray-500 mt-2">
              {'Доступні змінні: {{ticketNumber}}, {{serviceName}}, {{branchName}}, {{expectedTime}}'}
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">Опис (необов&apos;язково)</label>
            <input
              type="text"
              className="form-input"
              placeholder="Короткий опис призначення шаблону"
              value={form.data.description}
              onChange={(e) => form.setField('description', e.target.value)}
              disabled={form.isSubmitting}
            />
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <button
              type="button"
              onClick={() => {
                setIsCreateModalOpen(false);
                setIsEditModalOpen(false);
                setEditingTemplate(null);
                resetForm();
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
              ) : editingTemplate ? (
                'Оновити'
              ) : (
                'Створити'
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Test Send Modal */}
      {editingTemplate && (
        <Modal
          isOpen={!!editingTemplate && !isCreateModalOpen && !isEditModalOpen}
          onClose={() => {
            setEditingTemplate(null);
            setTestPhoneNumber('');
          }}
          title={`Тест: ${editingTemplate.code}`}
          size="md"
          onConfirm={() => handleTestSend(editingTemplate.id)}
          confirmText={isTestSending ? 'Відправляю...' : 'Відправити'}
          isLoading={isTestSending}
        >
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Попередній перегляд:</h3>
              <div className="bg-gray-50 p-4 rounded border border-gray-200 text-sm text-gray-700 whitespace-pre-wrap">
                {editingTemplate.text}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Номер телефону для тесту *</label>
              <input
                type="tel"
                className="form-input"
                placeholder="+380XXXXXXXXX"
                value={testPhoneNumber}
                onChange={(e) => setTestPhoneNumber(e.target.value)}
                disabled={isTestSending}
                autoFocus
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!deleteAction.deleteConfirm}
        title="Видалити шаблон"
        message={`Ви впевнені, що хочете видалити шаблон "${deleteAction.deleteConfirm?.code}"?`}
        onConfirm={() => void handleDeleteTemplate()}
        onCancel={() => deleteAction.setDeleteConfirm(null)}
        isDangerous
        isLoading={deleteAction.isDeleting}
      />
    </>
  );
}

export default withDashboard(NotificationsPage);
