import { ReactNode } from 'react';

type ButtonType = 'button' | 'submit';

export function MiuiHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle: string;
  right?: ReactNode;
}) {
  return (
    <div className="mi-row-between mi-gap-16">
      <div className="mi-header-logo-row">
        <img src="/logo.png" alt="SoftTurn" className="mi-header-logo" />
        <div>
          <h1 className="mi-title">{title}</h1>
          <p className="mi-subtitle mi-mt-8">{subtitle}</p>
        </div>
      </div>
      {right}
    </div>
  );
}

export function MiuiPanel({ children }: { children: ReactNode }) {
  return <div className="mi-panel mi-p-24 sm:mi-p-40">{children}</div>;
}

export function MiuiField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mi-field">
      <label className="form-label">{label}</label>
      {children}
    </div>
  );
}

export function MiuiPrimaryButton({
  children,
  disabled,
  type = 'button',
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  type?: ButtonType;
  onClick?: () => void;
}) {
  return (
    <button type={type} className="btn btn-primary w-full mi-text-lg" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

export function MiuiSecondaryButton({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button type="button" className="btn btn-secondary" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}
