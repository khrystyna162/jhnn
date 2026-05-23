import { useState, useEffect } from 'react';
import { User, Role, ScopeLevel, Country, City, District, Branch } from '@/types';
import apiClient from '@/services/api';
import { validatePhoneNumber, validateEmail } from '@/utils/formatters';

interface UserFormProps {
  initialData?: User;
  onSubmit: (data: {
    email: string;
    firstName: string;
    lastName: string;
    phoneNumber: string;
    roleId: string;
    scopeLevel: ScopeLevel;
    countryId?: string;
    cityId?: string;
    districtId?: string;
    branchId?: string;
  }) => Promise<void>;
  isLoading?: boolean;
  isEditMode?: boolean;
}

export function UserForm({ initialData, onSubmit, isLoading = false, isEditMode = false }: UserFormProps) {
  const [formData, setFormData] = useState({
    email: initialData?.email || '',
    firstName: initialData?.firstName || '',
    lastName: initialData?.lastName || '',
    phoneNumber: initialData?.phoneNumber || '',
    roleId: initialData?.roleId || '',
    scopeLevel: initialData?.scopeLevel || ScopeLevel.BRANCH,
    countryId: initialData?.countryId || '',
    cityId: initialData?.cityId || '',
    districtId: initialData?.districtId || '',
    branchId: initialData?.branchId || '',
  });

  const [countries, setCountries] = useState<Country[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadingData, setLoadingData] = useState(true);

  // Roles for select
  const roles = [
    { id: 'operator', name: 'Оператор', value: Role.OPERATOR },
    { id: 'admin', name: 'Адміністратор', value: Role.ADMIN },
    { id: 'sysadmin', name: 'Системний адміністратор', value: Role.SYSADMIN },
  ];

  const scopeLevels = [
    { value: ScopeLevel.COUNTRY, label: 'Країна' },
    { value: ScopeLevel.CITY, label: 'Місто' },
    { value: ScopeLevel.DISTRICT, label: 'Район' },
    { value: ScopeLevel.BRANCH, label: 'Філія' },
  ];

  useEffect(() => {
    const loadData = async () => {
      try {
        const countriesData = await apiClient.getCountries();
        setCountries(countriesData);

        // Load cities if country selected
        if (formData.countryId) {
          const citiesData = await apiClient.getCities(formData.countryId);
          setCities(citiesData);
        }

        // Load districts if city selected
        if (formData.cityId) {
          const districtsData = await apiClient.getDistricts(formData.cityId);
          setDistricts(districtsData);
        }

        // Load branches if district selected
        if (formData.districtId) {
          const branchesData = await apiClient.getBranches(formData.districtId);
          setBranches(branchesData);
        }
      } catch (err) {
        console.error('Failed to load form data:', err);
      } finally {
        setLoadingData(false);
      }
    };

    loadData();
  }, [formData.countryId, formData.cityId, formData.districtId]);

  const handleCountryChange = async (countryId: string) => {
    setFormData((prev) => ({
      ...prev,
      countryId,
      cityId: '',
      districtId: '',
      branchId: '',
    }));

    if (countryId) {
      const citiesData = await apiClient.getCities(countryId);
      setCities(citiesData);
    } else {
      setCities([]);
    }
  };

  const handleCityChange = async (cityId: string) => {
    setFormData((prev) => ({
      ...prev,
      cityId,
      districtId: '',
      branchId: '',
    }));

    if (cityId) {
      const districtsData = await apiClient.getDistricts(cityId);
      setDistricts(districtsData);
    } else {
      setDistricts([]);
    }
  };

  const handleDistrictChange = async (districtId: string) => {
    setFormData((prev) => ({
      ...prev,
      districtId,
      branchId: '',
    }));

    if (districtId) {
      const branchesData = await apiClient.getBranches(districtId);
      setBranches(branchesData);
    } else {
      setBranches([]);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Email обов\'язковий';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Некоректний email';
    }

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'Ім\'я обов\'язкове';
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Прізвище обов\'язкове';
    }

    if (!formData.phoneNumber.trim()) {
      newErrors.phoneNumber = 'Телефон обов\'язковий';
    } else if (!validatePhoneNumber(formData.phoneNumber)) {
      newErrors.phoneNumber = 'Некоректний номер телефону';
    }

    if (!formData.roleId) {
      newErrors.roleId = 'Роль обов\'язкова';
    }

    // Scope validation
    if (formData.scopeLevel === ScopeLevel.COUNTRY && !formData.countryId) {
      newErrors.countryId = 'Країна обов\'язкова';
    }
    if (formData.scopeLevel === ScopeLevel.CITY && !formData.cityId) {
      newErrors.cityId = 'Місто обов\'язкове';
    }
    if (formData.scopeLevel === ScopeLevel.DISTRICT && !formData.districtId) {
      newErrors.districtId = 'Район обов\'язковий';
    }
    if (formData.scopeLevel === ScopeLevel.BRANCH && !formData.branchId) {
      newErrors.branchId = 'Філія обов\'язкова';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      await onSubmit(formData);
    } catch (err) {
      console.error('Form submission error:', err);
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Email */}
      <div className="form-group">
        <label className="form-label">Email *</label>
        <input
          type="email"
          className={`form-input ${errors.email ? 'border-red-500' : ''}`}
          placeholder="user@example.com"
          value={formData.email}
          onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
          disabled={isLoading || isEditMode}
        />
        {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
      </div>

      {/* First Name */}
      <div className="form-group">
        <label className="form-label">Ім&apos;я *</label>
        <input
          type="text"
          className={`form-input ${errors.firstName ? 'border-red-500' : ''}`}
          placeholder="Іван"
          value={formData.firstName}
          onChange={(e) => setFormData((prev) => ({ ...prev, firstName: e.target.value }))}
          disabled={isLoading}
        />
        {errors.firstName && <p className="text-red-500 text-sm mt-1">{errors.firstName}</p>}
      </div>

      {/* Last Name */}
      <div className="form-group">
        <label className="form-label">Прізвище *</label>
        <input
          type="text"
          className={`form-input ${errors.lastName ? 'border-red-500' : ''}`}
          placeholder="Петренко"
          value={formData.lastName}
          onChange={(e) => setFormData((prev) => ({ ...prev, lastName: e.target.value }))}
          disabled={isLoading}
        />
        {errors.lastName && <p className="text-red-500 text-sm mt-1">{errors.lastName}</p>}
      </div>

      {/* Phone Number */}
      <div className="form-group">
        <label className="form-label">Телефон *</label>
        <input
          type="tel"
          className={`form-input ${errors.phoneNumber ? 'border-red-500' : ''}`}
          placeholder="+380XXXXXXXXX"
          value={formData.phoneNumber}
          onChange={(e) => setFormData((prev) => ({ ...prev, phoneNumber: e.target.value }))}
          disabled={isLoading}
        />
        {errors.phoneNumber && <p className="text-red-500 text-sm mt-1">{errors.phoneNumber}</p>}
      </div>

      {/* Role */}
      <div className="form-group">
        <label className="form-label">Роль *</label>
        <select
          className={`form-select ${errors.roleId ? 'border-red-500' : ''}`}
          value={formData.roleId}
          onChange={(e) => setFormData((prev) => ({ ...prev, roleId: e.target.value }))}
          disabled={isLoading}
        >
          <option value="">Виберіть роль...</option>
          {roles.map((role) => (
            <option key={role.id} value={role.value}>
              {role.name}
            </option>
          ))}
        </select>
        {errors.roleId && <p className="text-red-500 text-sm mt-1">{errors.roleId}</p>}
      </div>

      {/* Scope Level */}
      <div className="form-group">
        <label className="form-label">Рівень доступу *</label>
        <select
          className="form-select"
          value={formData.scopeLevel}
          onChange={(e) => setFormData((prev) => ({ ...prev, scopeLevel: e.target.value as any }))}
          disabled={isLoading}
        >
          {scopeLevels.map((level) => (
            <option key={level.value} value={level.value}>
              {level.label}
            </option>
          ))}
        </select>
      </div>

      {/* Country */}
      {[ScopeLevel.COUNTRY, ScopeLevel.CITY, ScopeLevel.DISTRICT, ScopeLevel.BRANCH].includes(
        formData.scopeLevel
      ) && (
        <div className="form-group">
          <label className="form-label">Країна *</label>
          <select
            className={`form-select ${errors.countryId ? 'border-red-500' : ''}`}
            value={formData.countryId}
            onChange={(e) => handleCountryChange(e.target.value)}
            disabled={isLoading}
          >
            <option value="">Виберіть країну...</option>
            {countries.map((country) => (
              <option key={country.id} value={country.id}>
                {country.name}
              </option>
            ))}
          </select>
          {errors.countryId && <p className="text-red-500 text-sm mt-1">{errors.countryId}</p>}
        </div>
      )}

      {/* City */}
      {[ScopeLevel.CITY, ScopeLevel.DISTRICT, ScopeLevel.BRANCH].includes(
        formData.scopeLevel
      ) && (
        <div className="form-group">
          <label className="form-label">Місто *</label>
          <select
            className={`form-select ${errors.cityId ? 'border-red-500' : ''}`}
            value={formData.cityId}
            onChange={(e) => handleCityChange(e.target.value)}
            disabled={isLoading || !formData.countryId}
          >
            <option value="">Виберіть місто...</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>
          {errors.cityId && <p className="text-red-500 text-sm mt-1">{errors.cityId}</p>}
        </div>
      )}

      {/* District */}
      {[ScopeLevel.DISTRICT, ScopeLevel.BRANCH].includes(formData.scopeLevel) && (
        <div className="form-group">
          <label className="form-label">Район *</label>
          <select
            className={`form-select ${errors.districtId ? 'border-red-500' : ''}`}
            value={formData.districtId}
            onChange={(e) => handleDistrictChange(e.target.value)}
            disabled={isLoading || !formData.cityId}
          >
            <option value="">Виберіть район...</option>
            {districts.map((district) => (
              <option key={district.id} value={district.id}>
                {district.name}
              </option>
            ))}
          </select>
          {errors.districtId && <p className="text-red-500 text-sm mt-1">{errors.districtId}</p>}
        </div>
      )}

      {/* Branch */}
      {formData.scopeLevel === ScopeLevel.BRANCH && (
        <div className="form-group">
          <label className="form-label">Філія *</label>
          <select
            className={`form-select ${errors.branchId ? 'border-red-500' : ''}`}
            value={formData.branchId}
            onChange={(e) => setFormData((prev) => ({ ...prev, branchId: e.target.value }))}
            disabled={isLoading || !formData.districtId}
          >
            <option value="">Виберіть філію...</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
          {errors.branchId && <p className="text-red-500 text-sm mt-1">{errors.branchId}</p>}
        </div>
      )}

      {/* Submit Button */}
      <div className="flex gap-3 justify-end pt-4">
        <button type="submit" className="btn btn-primary" disabled={isLoading}>
          {isLoading ? (
            <>
              <span className="spinner inline-block mr-2 h-4 w-4"></span>
              Зберігаю...
            </>
          ) : isEditMode ? (
            'Оновити користувача'
          ) : (
            'Створити користувача'
          )}
        </button>
      </div>
    </form>
  );
}
