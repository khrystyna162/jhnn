import React, { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuthStore } from '@/store/authStore';
import { Role } from '@/types';

interface LayoutProps {
  children: ReactNode;
}

const NAVIGATION_ITEMS = [
  { href: '/dashboard',        label: 'Дашборд',                icon: 'grid',        roles: [Role.OPERATOR, Role.ADMIN, Role.SYSADMIN] },
  { href: '/operator',         label: 'Моє вікно',              icon: 'monitor',     roles: [Role.OPERATOR] },
  { href: '/tickets',          label: 'Талони',                 icon: 'ticket',      roles: [Role.OPERATOR, Role.ADMIN, Role.SYSADMIN] },
  { href: '/workplaces',       label: 'Робочі місця',           icon: 'building',    roles: [Role.ADMIN, Role.SYSADMIN] },
  { href: '/users',            label: 'Користувачі',            icon: 'users',       roles: [Role.ADMIN, Role.SYSADMIN] },
  { href: '/services',         label: 'Послуги',                icon: 'list',        roles: [Role.ADMIN, Role.SYSADMIN] },
  { href: '/org-structure',    label: 'Орг. структура',         icon: 'sitemap',     roles: [Role.ADMIN, Role.SYSADMIN] },
  { href: '/analytics',        label: 'Аналітика',              icon: 'chart',       roles: [Role.ADMIN, Role.SYSADMIN] },
  { href: '/notifications',    label: 'Сповіщення',             icon: 'bell',        roles: [Role.ADMIN, Role.SYSADMIN] },
  { href: '/display-settings', label: 'Налаштування табло',     icon: 'tv',          roles: [Role.ADMIN, Role.SYSADMIN] },
  { href: '/terminals',        label: 'Термінали',              icon: 'key',         roles: [Role.ADMIN, Role.SYSADMIN] },
  { href: '/audit',            label: 'Журнал аудиту',          icon: 'shield',      roles: [Role.SYSADMIN] },
  { href: '/settings',         label: 'Налаштування',           icon: 'settings',    roles: [Role.SYSADMIN] },
];

const ICONS: Record<string, JSX.Element> = {
  grid:     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  monitor:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>,
  ticket:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 5v2M15 11v2M15 17v2M5 5h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V7a2 2 0 0 1 2-2z"/></svg>,
  building: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4"/></svg>,
  users:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  list:     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  sitemap:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="2" width="6" height="4" rx="1"/><rect x="1" y="18" width="6" height="4" rx="1"/><rect x="9" y="18" width="6" height="4" rx="1"/><rect x="17" y="18" width="6" height="4" rx="1"/><path d="M12 6v4M4 18v-4h16v4M12 10v4"/></svg>,
  chart:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  bell:     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  tv:       <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/></svg>,
  key:      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="7.5" cy="15.5" r="4.5"/><path d="M21 2l-9.6 9.6M15 8l3 3M17 6l3 3"/></svg>,
  shield:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  settings: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
};

export function DashboardLayout({ children }: LayoutProps) {
  const router = useRouter();
  const { user, logout, hasRole } = useAuthStore();
  const [collapsed, setCollapsed] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const displayName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || (user as { fullName?: string }).fullName || user.email || 'Користувач'
    : 'Користувач';
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase() || '?';
  const roleLabel = (user as { roleId?: string; role?: string } | null)?.roleId
    ?? (user as { role?: string } | null)?.role
    ?? 'UNKNOWN';

  const handleLogout = async () => {
    try { await logout(); router.push('/login'); } catch { /* noop */ }
  };

  const visibleItems = NAVIGATION_ITEMS.filter((item) =>
    item.roles.some((role) => hasRole(role)),
  );

  React.useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (mobile) {
        setCollapsed(true);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="adm-shell">
      {isMobile && isMobileMenuOpen && (
        <button
          type="button"
          className="adm-mobile-overlay"
          aria-label="Закрити меню"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`adm-sidebar${collapsed ? ' adm-sidebar--collapsed' : ''}${
          isMobileMenuOpen ? ' adm-sidebar--mobile-open' : ''
        }`}
      >
        {/* Logo area */}
        <div className="adm-sidebar-logo">
          <img src="/logo.png" alt="SoftTurn" className="adm-sidebar-logo-img" />
          {!collapsed && <span className="adm-sidebar-logo-text">SoftTurn</span>}
          <button
            className="adm-sidebar-toggle"
            onClick={() => {
              if (isMobile) {
                setIsMobileMenuOpen((prev) => !prev);
                return;
              }
              setCollapsed(!collapsed);
            }}
            title={collapsed ? 'Розгорнути' : 'Згорнути'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              {collapsed
                ? <polyline points="9 18 15 12 9 6" />
                : <polyline points="15 18 9 12 15 6" />}
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav className="adm-nav">
          {visibleItems.map((item) => {
            const active = router.pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`adm-nav-item${active ? ' adm-nav-item--active' : ''}`}
                title={collapsed ? item.label : undefined}
                onClick={() => {
                  if (isMobile) setIsMobileMenuOpen(false);
                }}
              >
                <span className="adm-nav-icon">{ICONS[item.icon]}</span>
                {!collapsed && <span className="adm-nav-label">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="adm-sidebar-user">
          <div className="adm-user-avatar">{initials}</div>
          {!collapsed && (
            <div className="adm-user-info">
              <div className="adm-user-name">{displayName}</div>
              <div className="adm-user-role">{roleLabel}</div>
            </div>
          )}
          <button
            className="adm-logout-btn"
            onClick={handleLogout}
            title="Вийти"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </aside>

      {/* ── Content ── */}
      <div className="adm-content">
        {isMobile && (
          <div className="adm-mobile-topbar">
            <button
              type="button"
              className="adm-mobile-menu-btn"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Відкрити меню"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          </div>
        )}
        <main className="adm-page">
          {children}
        </main>
      </div>
    </div>
  );
}

export function withDashboard<P extends object>(Component: React.ComponentType<P>) {
  return function DashboardComponent(props: P) {
    const { user, accessToken, refreshToken, setTokens } = useAuthStore();
    const router = useRouter();

    // Sync tokens with API client on mount and when they change
    React.useEffect(() => {
      if (accessToken && refreshToken) {
        setTokens(accessToken, refreshToken);
      }
    }, [accessToken, refreshToken, setTokens]);

    React.useEffect(() => {
      if (!accessToken || !user) router.push('/login');
    }, [accessToken, user, router]);

    if (!accessToken || !user) {
      return (
        <div className="adm-auth-gate">
          <div className="adm-spinner" />
        </div>
      );
    }

    return (
      <DashboardLayout>
        <Component {...props} />
      </DashboardLayout>
    );
  };
}
