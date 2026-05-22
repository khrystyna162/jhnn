import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="crm-page-header">
      <div>
        <h1 className="crm-page-title">{title}</h1>
        {subtitle && <p className="crm-page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="crm-page-actions">{actions}</div>}
    </div>
  );
}
