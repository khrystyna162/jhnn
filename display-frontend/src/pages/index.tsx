import { useCallback, useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import { BellRing, ClipboardList, Smartphone, Zap } from 'lucide-react';
import { getPublicDisplayData, resolveTerminal } from '@/lib/api';
import type { PublicDisplayData, PublicTicket, PublicWorkplace } from '@/types/public';

const POLL_INTERVAL_MS = 2000;
const configuredBranchId = (process.env.NEXT_PUBLIC_DISPLAY_BRANCH_ID || '').trim();
const terminalApiKey = (
  process.env.NEXT_PUBLIC_DISPLAY_API_KEY ||
  process.env.NEXT_PUBLIC_TERMINAL_API_KEY ||
  ''
).trim();
const videoUrl = (process.env.NEXT_PUBLIC_DISPLAY_VIDEO_URL || 'https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=1&mute=1&loop=1&playlist=jfKfPfyJRdk').trim();

const AD_SLIDES = [
  { Icon: ClipboardList, title: 'Запишіться онлайн', desc: 'Забронюйте зручний час через мобільний застосунок SoftTurn' },
  { Icon: Zap, title: 'Швидке обслуговування', desc: 'Середній час очікування у нашому відділенні — менше 5 хвилин' },
  { Icon: Smartphone, title: 'Отримайте талон онлайн', desc: 'Зайдіть на кіоск або відскануйте QR-код на вході' },
  { Icon: BellRing, title: 'Слідкуйте за чергою', desc: 'Ваш талон буде викликано на цьому екрані та голосово' },
];

const TICKER_ITEMS = [
  'Ласкаво просимо до нашого відділення',
  'Дякуємо за вибір наших послуг',
  'Ваша зручність — наш пріоритет',
  'Будь ласка, очікуйте свого виклику',
  'Наш персонал завжди готовий вам допомогти',
  'Отримайте талон на кіоску самообслуговування',
];

/** Compute how many columns the workplace grid should have */
function gridCols(count: number): number {
  if (count <= 3) return count;
  if (count <= 6) return 3;
  if (count <= 8) return 4;
  return 5;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function pickUkrainianVoice(
  voices: SpeechSynthesisVoice[],
  preferredName?: string,
): SpeechSynthesisVoice | undefined {
  if (!voices.length) return undefined;
  if (preferredName) {
    const exact = voices.find((voice) => voice.name === preferredName);
    if (exact) return exact;
  }
  return voices.find((voice) => voice.default) ?? voices[0];
}

function speak(
  text: string,
  settings?: {
    ttsEnabled?: boolean;
    ttsVoice?: string;
    ttsRate?: number;
    ttsVolume?: number;
  },
) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  if (settings?.ttsEnabled === false) return;

  const ukVoices = window.speechSynthesis
    .getVoices()
    .filter((voice) => voice.lang.toLowerCase().startsWith('uk'));
  const selectedVoice = pickUkrainianVoice(ukVoices, settings?.ttsVoice);

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = selectedVoice?.lang ?? 'uk-UA';
  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }
  utterance.rate = clamp(settings?.ttsRate ?? 0.9, 0.5, 2);
  utterance.volume = clamp(settings?.ttsVolume ?? 1, 0, 1);
  utterance.pitch = 1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function buildAnnouncement(ticket: PublicTicket): string {
  const wpPart = ticket.workplaceNumber ? `, пройдіть до вікна ${ticket.workplaceNumber}` : '';
  return `Клієнт, талон ${ticket.number}${wpPart}`;
}

// ─── Logo ───────────────────────────────────────────────────────────────
function Logo({ branchName }: { branchName: string }) {
  return (
    <div className="mi-display-logo">
      <img src="/logo.png" alt="SoftTurn" className="mi-display-logo-img" />
      <div className="mi-display-logo-text">
        <div className="mi-display-logo-brand">Електронна черга</div>
        <div className="mi-display-logo-branch">{branchName || '—'}</div>
      </div>
    </div>
  );
}

// ─── Clock ───────────────────────────────────────────────────────────────
function Clock() {
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setDate(now.toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="text-right">
      <div className="mi-display-clock-time">{time}</div>
      <div className="mi-display-clock-date capitalize">{date}</div>
    </div>
  );
}

// ─── Video Panel ─────────────────────────────────────────────────────────
function VideoPanel() {
  if (!videoUrl) {
    return (
      <div className="mi-video-placeholder">
        <div className="mi-video-placeholder-icon">▶</div>
        <div className="mi-video-placeholder-text">
          Встановіть <code>NEXT_PUBLIC_DISPLAY_VIDEO_URL</code> для відео
        </div>
      </div>
    );
  }

  const isYoutube = videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be');

  if (isYoutube) {
    const embedUrl = videoUrl.includes('/embed/')
      ? videoUrl
      : videoUrl.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/');
    const sep = embedUrl.includes('?') ? '&' : '?';
    return (
      <iframe
        className="mi-video-frame"
        src={`${embedUrl}${sep}autoplay=1&mute=1&loop=1&controls=0&modestbranding=1`}
        allow="autoplay; encrypted-media"
        allowFullScreen
        title="Відео"
      />
    );
  }

  return (
    <video
      className="mi-video-frame"
      src={videoUrl}
      autoPlay
      muted
      loop
      playsInline
    />
  );
}

// ─── Stats bar ───────────────────────────────────────────────────────────
function StatsBar({ workplaces }: { workplaces: PublicWorkplace[] }) {
  const busy = workplaces.filter((w) => w.status === 'ACTIVE' && w.currentTicketNumber).length;
  const free = workplaces.filter((w) => w.status === 'ACTIVE' && !w.currentTicketNumber).length;
  const closed = workplaces.filter((w) => w.status !== 'ACTIVE').length;
  const total = workplaces.length;

  return (
    <div className="mi-stats-bar">
      <div className="mi-stat mi-stat-busy">
        <span className="mi-stat-dot" />
        <span className="mi-stat-val">{busy}</span>
        <span className="mi-stat-lbl">Обслуговує</span>
      </div>
      <div className="mi-stat mi-stat-free">
        <span className="mi-stat-dot" />
        <span className="mi-stat-val">{free}</span>
        <span className="mi-stat-lbl">Вільне</span>
      </div>
      <div className="mi-stat mi-stat-closed">
        <span className="mi-stat-dot" />
        <span className="mi-stat-val">{closed}</span>
        <span className="mi-stat-lbl">Зачинено</span>
      </div>
      <div className="mi-stat-total">Вікон: {total}</div>
    </div>
  );
}

// ─── Workplace Card ───────────────────────────────────────────────────────
function WorkplaceCard({ wp, isNew }: { wp: PublicWorkplace; isNew: boolean }) {
  const isActive = wp.status === 'ACTIVE';
  const hasTicket = isActive && !!wp.currentTicketNumber;

  const statusClass = hasTicket ? 'status-busy' : isActive ? 'status-free' : 'status-closed';

  return (
    <div className={`mi-wp-card ${statusClass}${isNew ? ' is-new' : ''}`}>
      <div className="mi-wp-stripe" />
      <div className="mi-wp-body">
        <div className="mi-wp-header">
          <span className="mi-wp-label">ВІКНО {wp.number}</span>
          <span className="mi-wp-badge">
            {hasTicket ? 'Обслуговується' : isActive ? 'Вільне' : 'Зачинено'}
          </span>
        </div>
        {hasTicket ? (
          <div className="mi-wp-ticket-area">
            <div className="mi-wp-number">{wp.currentTicketNumber}</div>
            {wp.serviceName && <div className="mi-wp-service">{wp.serviceName}</div>}
          </div>
        ) : (
          <div className="mi-wp-idle">
            {isActive ? (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M18.36 6.64A9 9 0 1 1 5.64 19.36"/>
                <path d="M2 2l20 20"/>
              </svg>
            )}
            <div className="mi-wp-idle-label">{isActive ? 'Очікує' : 'Зачинено'}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Ad Banner ───────────────────────────────────────────────────────────
function AdBanner() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setCurrent((c) => (c + 1) % AD_SLIDES.length), 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="mi-ad-banner">
      {AD_SLIDES.map((slide, i) => (
        <div key={i} className={`mi-ad-slide ${i === current ? 'visible' : ''}`}>
          <div className="mi-ad-slide-icon"><slide.Icon size={28} strokeWidth={1.8} /></div>
          <div className="mi-ad-slide-title">{slide.title}</div>
          <div className="mi-ad-slide-desc">{slide.desc}</div>
        </div>
      ))}
      <div className="mi-ad-dots">
        {AD_SLIDES.map((_, i) => (
          <div key={i} className={`mi-ad-dot ${i === current ? 'active' : ''}`} />
        ))}
      </div>
    </div>
  );
}

// ─── Ticker ──────────────────────────────────────────────────────────────
function Ticker({ branchName }: { branchName: string }) {
  const parts = branchName ? [`Відділення: ${branchName}`, ...TICKER_ITEMS] : TICKER_ITEMS;
  const text = parts.join('  ·  ');

  return (
    <div className="mi-ticker-wrap">
      <div className="mi-ticker-label">Інфо</div>
      <div className="mi-ticker-track">
        <span className="mi-ticker-content">{text}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{text}</span>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────
export default function DisplayApp() {
  const [branchId, setBranchId] = useState('');
  const [data, setData] = useState<PublicDisplayData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newTicketNumbers, setNewTicketNumbers] = useState<Set<string>>(new Set());
  const prevActiveRef = useRef<Map<string, string>>(new Map());

  const processData = useCallback((fresh: PublicDisplayData) => {
    const prevActive = prevActiveRef.current;
    const freshMap = new Map<string, string>();
    const newNums = new Set<string>();

    for (const t of fresh.activeTickets) {
      freshMap.set(t.number, t.workplaceNumber ?? '');
      if (!prevActive.has(t.number)) {
        speak(buildAnnouncement(t), fresh.displaySettings);
        newNums.add(t.number);
      }
    }

    prevActiveRef.current = freshMap;
    setData(fresh);

    if (newNums.size > 0) {
      setNewTicketNumbers(newNums);
      setTimeout(() => setNewTicketNumbers(new Set()), 6000);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const resolveBranch = async (): Promise<string> => {
      if (terminalApiKey) {
        const terminal = await resolveTerminal(terminalApiKey);
        return terminal.branchId;
      }

      if (configuredBranchId) {
        return configuredBranchId;
      }

      throw new Error(
        'DISPLAY is not configured. Set NEXT_PUBLIC_DISPLAY_API_KEY (recommended) or NEXT_PUBLIC_DISPLAY_BRANCH_ID.',
      );
    };

    const poll = async () => {
      try {
        const resolvedBranchId = branchId || (await resolveBranch());
        if (!cancelled && resolvedBranchId !== branchId) {
          setBranchId(resolvedBranchId);
        }

        const fresh = await getPublicDisplayData(resolvedBranchId);
        if (!cancelled) {
          processData(fresh);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Помилка з\'єднання. Повторна спроба...');
        }
      }
    };

    void poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [branchId, processData]);

  if (!data && !error) {
    return (
      <div className="mi-display-loading">
        <div className="mi-display-loading-spinner" />
        <div>Завантаження...</div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="mi-display-loading">
        <div style={{ color: '#fca5a5', fontSize: 20 }}>{error}</div>
      </div>
    );
  }

  const allWorkplaces = data?.workplaces ?? [];
  const activeTickets = data?.activeTickets ?? [];
  const waitingTickets = data?.waitingTickets ?? [];
  const completedNums = data?.completedTicketNumbers ?? [];
  const cols = gridCols(allWorkplaces.length);

  return (
    <>
      <Head>
        <title>SoftTurn Display - {data?.branchName}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </Head>

      <div className="mi-display-shell">
        {/* Header */}
        <header className="mi-display-header">
          <Logo branchName={data?.branchName ?? ''} />
          <Clock />
        </header>

        {/* Body */}
        <div className="mi-display-body">
          {/* Main: stats + workplaces */}
          <main className="mi-display-main">
            {/* Stats */}
            <StatsBar workplaces={allWorkplaces} />

            {/* Workplace grid — fully dynamic */}
            <div
              className="mi-display-workplaces"
              style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
            >
              {allWorkplaces.map((wp) => (
                <WorkplaceCard
                  key={wp.id}
                  wp={wp}
                  isNew={!!wp.currentTicketNumber && newTicketNumbers.has(wp.currentTicketNumber)}
                />
              ))}
            </div>
          </main>

          {/* Sidebar */}
          <aside className="mi-display-sidebar">
            <div className="mi-video-wrap">
              <VideoPanel />
            </div>

            <div className="mi-queue-section">
              <div className="mi-queue-label">У черзі</div>
              {waitingTickets.length === 0 ? (
                <div className="mi-queue-empty">Очікування немає</div>
              ) : (
                waitingTickets.map((t) => (
                  <div key={t.number} className="mi-queue-ticket">
                    <span>{t.number}</span>
                    {t.serviceName && (
                      <span className="mi-queue-ticket-window">{t.serviceName}</span>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="mi-queue-section">
              <div className="mi-queue-label">Зараз обслуговуються</div>
              {activeTickets.length === 0 ? (
                <div className="mi-queue-empty">Черга порожня</div>
              ) : (
                activeTickets.map((t) => (
                  <div
                    key={t.number}
                    className={`mi-queue-ticket ${newTicketNumbers.has(t.number) ? 'is-new' : ''}`}
                  >
                    <span>{t.number}</span>
                    {t.workplaceNumber && (
                      <span className="mi-queue-ticket-window">Вікно {t.workplaceNumber}</span>
                    )}
                  </div>
                ))
              )}
            </div>

            {completedNums.length > 0 && (
              <div className="mi-queue-section" style={{ flex: '0 0 auto', maxHeight: 180 }}>
                <div className="mi-queue-label">Обслуговані</div>
                <div className="mi-completed-grid">
                  {completedNums.slice(0, 12).map((num) => (
                    <div key={num} className="mi-completed-chip">{num}</div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>

        {/* Ticker */}
        <Ticker branchName={data?.branchName ?? ''} />
      </div>
    </>
  );
}

