import { FormEvent, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { AsYouType, parsePhoneNumberFromString } from 'libphonenumber-js';
import { createPublicTicket, getBranchName, getPublicServicesForBranch, resolveTerminal } from '@/lib/api';
import type { ServiceType, Ticket } from '@/types/public';

const configuredBranchId = (process.env.NEXT_PUBLIC_KIOSK_BRANCH_ID || '').trim();
const terminalApiKey = (
  process.env.NEXT_PUBLIC_KIOSK_API_KEY ||
  process.env.NEXT_PUBLIC_TERMINAL_API_KEY ||
  ''
).trim();
const PHONE_EXAMPLE = '+380 67 123 45 67';

type Screen = 'services' | 'form' | 'ticket' | 'error';

function formatPhoneInput(value: string): string {
  const sanitized = value.replace(/[^\d+]/g, '');
  const normalized = sanitized.startsWith('+')
    ? `+${sanitized.slice(1).replace(/\+/g, '')}`
    : sanitized.replace(/\+/g, '');

  return new AsYouType('UA').input(normalized);
}

function normalizePhoneNumber(value: string): string | null {
  const trimmed = value.trim();
  const localOrUa = parsePhoneNumberFromString(trimmed, 'UA');
  if (localOrUa?.isValid()) {
    return localOrUa.number;
  }

  const digitsOnly = trimmed.replace(/[^\d]/g, '');
  if (!digitsOnly) {
    return null;
  }

  const international = parsePhoneNumberFromString(
    trimmed.startsWith('+') ? trimmed : `+${digitsOnly}`,
  );

  return international?.isValid() ? international.number : null;
}

export default function KioskApp() {
  const [branchId, setBranchId] = useState('');
  const [branchName, setBranchName] = useState('');
  const [services, setServices] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<Screen>('services');
  const [fatalError, setFatalError] = useState<string | null>(null);

  const [selectedService, setSelectedService] = useState<ServiceType | null>(null);
  const [phone, setPhone] = useState('');
  const [clientName, setClientName] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [createdTicket, setCreatedTicket] = useState<Ticket | null>(null);

  useEffect(() => {
    if (!terminalApiKey && !configuredBranchId) {
      setFatalError(
        'Кіоск не налаштовано. Встановіть NEXT_PUBLIC_KIOSK_API_KEY (рекомендовано) або NEXT_PUBLIC_KIOSK_BRANCH_ID у .env',
      );
      setLoading(false);
      setScreen('error');
      return;
    }

    const load = async () => {
      try {
        let effectiveBranchId = configuredBranchId;
        if (terminalApiKey) {
          const terminal = await resolveTerminal(terminalApiKey);
          effectiveBranchId = terminal.branchId;
        }

        if (!effectiveBranchId) {
          throw new Error('Не вдалося визначити філію для кіоску');
        }

        const [name, svcs] = await Promise.all([
          getBranchName(effectiveBranchId),
          getPublicServicesForBranch(effectiveBranchId),
        ]);

        setBranchId(effectiveBranchId);
        setBranchName(name);
        setServices(svcs.data);
      } catch {
        setFatalError('Ключ термінала недійсний або сервер недоступний');
        setScreen('error');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const selectedServiceName = useMemo(
    () => selectedService?.name ?? '',
    [selectedService],
  );

  const handleSelectService = (svc: ServiceType) => {
    setSelectedService(svc);
    setPhone('');
    setClientName('');
    setPhoneError('');
    setSubmitError('');
    setScreen('form');
  };

  const handleBack = () => {
    setScreen('services');
    setSelectedService(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const normalizedPhone = normalizePhoneNumber(phone);
    if (!normalizedPhone) {
      setPhoneError('Введіть коректний номер у міжнародному форматі');
      return;
    }
    if (!selectedService) return;
    if (!branchId) {
      setSubmitError('Не визначено філію термінала');
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError('');
      const res = await createPublicTicket({
        branchId,
        serviceTypeId: selectedService.id,
        phone: normalizedPhone,
        clientName: clientName.trim() || undefined,
      });
      setCreatedTicket(res.ticket);
      setScreen('ticket');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Помилка. Спробуйте ще раз.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleNewTicket = () => {
    setCreatedTicket(null);
    setSelectedService(null);
    setPhone('');
    setClientName('');
    setPhoneError('');
    setSubmitError('');
    setScreen('services');
  };

  return (
    <>
      <Head>
        <title>Електронна черга — {branchName || 'Кіоск'}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </Head>

      <div className="kiosk-shell">
        {/* ── Header ── */}
        <header className="kiosk-header">
          <img src="/logo.png" alt="SoftTurn" className="kiosk-logo" />
          <div className="kiosk-header-text">
            <div className="kiosk-brand">Електронна черга</div>
            {branchName && <div className="kiosk-branch">{branchName}</div>}
          </div>
        </header>

        {/* ── Content ── */}
        <main className="kiosk-main">

          {/* Loading */}
          {loading && (
            <div className="kiosk-center">
              <div className="kiosk-spinner" />
              <div className="kiosk-loading-text">Завантаження...</div>
            </div>
          )}

          {/* Fatal error */}
          {!loading && screen === 'error' && (
            <div className="kiosk-center">
              <div className="kiosk-error-icon">⚠</div>
              <div className="kiosk-error-text">{fatalError}</div>
            </div>
          )}

          {/* Services list */}
          {!loading && screen === 'services' && (
            <div className="kiosk-services-screen">
              <div className="kiosk-screen-title">Оберіть послугу</div>
              {services.length === 0 ? (
                <div className="kiosk-no-services">Послуги тимчасово недоступні</div>
              ) : (
                <div className="kiosk-services-list">
                  {services.map((svc) => (
                    <button
                      key={svc.id}
                      type="button"
                      className="kiosk-service-btn"
                      onClick={() => handleSelectService(svc)}
                    >
                      <span className="kiosk-service-name">{svc.name}</span>
                      <span className="kiosk-service-arrow">→</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Form */}
          {!loading && screen === 'form' && selectedService && (
            <div className="kiosk-form-screen">
              <button type="button" className="kiosk-back-btn" onClick={handleBack}>
                ← Назад
              </button>
              <div className="kiosk-screen-title">Введіть дані</div>
              <div className="kiosk-selected-service">{selectedService.name}</div>

              <form onSubmit={handleSubmit} className="kiosk-form">
                <div className="kiosk-field">
                  <label className="kiosk-label">Номер телефону</label>
                  <input
                    type="tel"
                    inputMode="tel"
                    className={`kiosk-input${phoneError ? ' kiosk-input--error' : ''}`}
                    value={phone}
                    onChange={(e) => {
                      setPhone(formatPhoneInput(e.target.value));
                      setPhoneError('');
                    }}
                    placeholder={PHONE_EXAMPLE}
                    autoComplete="tel"
                    maxLength={24}
                  />
                  {phoneError
                    ? <div className="kiosk-field-error">{phoneError}</div>
                    : <div className="kiosk-input-hint">Для інших країн вводьте номер з кодом країни, наприклад: +48..., +49..., +1...</div>
                  }
                </div>

                <div className="kiosk-field">
                  <label className="kiosk-label">Ім'я <span className="kiosk-optional">(необов'язково)</span></label>
                  <input
                    type="text"
                    inputMode="text"
                    className="kiosk-input"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Ваше ім'я"
                    autoComplete="name"
                  />
                </div>

                {submitError && <div className="kiosk-submit-error">{submitError}</div>}

                <button
                  type="submit"
                  className="kiosk-submit-btn"
                  disabled={submitting}
                >
                  {submitting ? 'Формуємо...' : 'Отримати талон'}
                </button>
              </form>
            </div>
          )}

          {/* Ticket success */}
          {!loading && screen === 'ticket' && createdTicket && (
            <div className="kiosk-ticket-screen">
              <div className="kiosk-ticket-card">
                <div className="kiosk-ticket-label">Ваш талон</div>
                <div className="kiosk-ticket-number">{createdTicket.number}</div>
                {selectedServiceName && (
                  <div className="kiosk-ticket-service">{selectedServiceName}</div>
                )}
                <div className="kiosk-ticket-hint">Очікуйте виклику на табло</div>
              </div>
              <button
                type="button"
                className="kiosk-new-btn"
                onClick={handleNewTicket}
              >
                Отримати ще один талон
              </button>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
