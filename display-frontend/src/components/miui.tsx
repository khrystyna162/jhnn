import { ReactNode } from 'react';

export function MiuiDisplayShell({ children }: { children: ReactNode }) {
  return <div className="min-h-screen mi-display-shell text-white flex flex-col select-none overflow-hidden">{children}</div>;
}

export function MiuiDisplayHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle: string;
  right: ReactNode;
}) {
  return (
    <header className="mi-display-header">
      <div>
        <div className="mi-display-subtitle">{subtitle}</div>
        <div className="mi-display-title">{title}</div>
      </div>
      {right}
    </header>
  );
}

export function MiuiDisplaySectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mi-display-section-title">{children}</h2>;
}
