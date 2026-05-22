import { useState, useEffect } from 'react';
import { Ticket, Workplace, ServiceType } from '@/types';
import apiClient from '@/services/api';
import { validatePhoneNumber } from '@/utils/formatters';

interface TicketFormProps {
  initialData?: Ticket;
  onSubmit: (data: {
    phone: string;
    serviceTypeId: string;
    branchId: string;
  }) => Promise<void>;
  isLoading?: boolean;
}

export function TicketForm({ initialData, onSubmit, isLoading = false }: TicketFormProps) {
  const [formData, setFormData] = useState({
    clientPhone: initialData?.clientPhone || '',
    serviceId: initialData?.serviceId || '',
    workplaceId: initialData?.workplaceId || '',
  });

  const [services, setServices] = useState<ServiceType[]>([]);
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [servicesData, workplacesData] = await Promise.all([
          apiClient.getServices(),
          apiClient.getMyAvailableWorkplaces(),
        ]);
        setServices(servicesData);
        setWorkplaces(workplacesData);
        setLoadingError(null);
      } catch (err) {
        setLoadingError(
          err instanceof Error ? err.message : 'Не вдалося завантажити довідники форми',
        );
      } finally {
        setLoadingData(false);
      }
    };

    loadData();
  }, []);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.clientPhone.trim()) {
      newErrors.clientPhone = 'Номер телефону обов\'язковий';
    } else if (!validatePhoneNumber(formData.clientPhone)) {
      newErrors.clientPhone = 'Некоректний номер телефону';
    }

    if (!formData.serviceId) {
      newErrors.serviceId = 'Послуга обов\'язкова';
    }

    if (!formData.workplaceId) {
      newErrors.workplaceId = 'Робоче місце обов\'язкове';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    const selectedWorkplace = workplaces.find(
      (workplace) => workplace.id === formData.workplaceId,
    );
    if (!selectedWorkplace?.branchId) {
      setSubmitError('Не вдалося визначити філію для обраного робочого місця');
      return;
    }

    try {
      setSubmitError(null);
      await onSubmit({
        phone: formData.clientPhone.trim(),
        serviceTypeId: formData.serviceId,
        branchId: selectedWorkplace.branchId,
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Не вдалося створити талон');
    }
  };

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="spinner"></div>
        <span className="ml-3 text-gray-600">Завантаження даних форми...</span>
      </div>
    );
  }

  if (loadingError) {
    return (
      <div className="space-y-3">
        <div className="alert alert-error">
          <p>{loadingError}</p>
        </div>
        <button type="button" onClick={() => window.location.reload()} className="btn btn-secondary">
          Перезавантажити сторінку
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {submitError && (
        <div className="alert alert-error">
          <p>{submitError}</p>
        </div>
      )}

      {/* Client Phone */}
      <div className="form-group">
        <label className="form-label">Номер телефону клієнта *</label>
        <input
          type="tel"
          className={`form-input ${errors.clientPhone ? 'border-red-500' : ''}`}
          placeholder="+380XXXXXXXXX"
          value={formData.clientPhone}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, clientPhone: e.target.value }))
          }
          disabled={isLoading}
        />
        {errors.clientPhone && (
          <p className="text-red-500 text-sm mt-1">{errors.clientPhone}</p>
        )}
      </div>

      {/* Service */}
      <div className="form-group">
        <label className="form-label">Послуга *</label>
        <select
          className={`form-select ${errors.serviceId ? 'border-red-500' : ''}`}
          value={formData.serviceId}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, serviceId: e.target.value }))
          }
          disabled={isLoading}
        >
          <option value="">Виберіть послугу...</option>
          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {service.name}
            </option>
          ))}
        </select>
        {errors.serviceId && (
          <p className="text-red-500 text-sm mt-1">{errors.serviceId}</p>
        )}
      </div>

      {/* Workplace */}
      <div className="form-group">
        <label className="form-label">Робоче місце *</label>
        <select
          className={`form-select ${errors.workplaceId ? 'border-red-500' : ''}`}
          value={formData.workplaceId}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, workplaceId: e.target.value }))
          }
          disabled={isLoading}
        >
          <option value="">Виберіть робоче місце...</option>
          {workplaces.map((workplace) => (
            <option key={workplace.id} value={workplace.id}>
              {workplace.number}
            </option>
          ))}
        </select>
        {errors.workplaceId && (
          <p className="text-red-500 text-sm mt-1">{errors.workplaceId}</p>
        )}
      </div>

      {/* Submit Button */}
      <div className="flex gap-3 justify-end pt-4">
        <button type="submit" className="btn btn-primary" disabled={isLoading}>
          {isLoading ? (
            <>
              <span className="spinner inline-block mr-2 h-4 w-4"></span>
              Зберігаю...
            </>
          ) : (
            'Створити талон'
          )}
        </button>
      </div>
    </form>
  );
}
