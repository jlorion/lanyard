/** Small presentational pieces: badges, callouts, empty states, page headers. */

import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';

export function Badge({ tone = 'default', children, title }: {
  tone?: 'default' | 'accent' | 'success' | 'danger' | 'warning';
  children: ReactNode;
  title?: string;
}) {
  return <span className={`badge${tone !== 'default' ? ` badge-${tone}` : ''}`} title={title}>{children}</span>;
}

const CALLOUT_ICONS = {
  info: Info,
  warning: AlertTriangle,
  danger: XCircle,
  success: CheckCircle2,
};

export function Callout({ tone = 'info', children }: { tone?: keyof typeof CALLOUT_ICONS; children: ReactNode }) {
  const Icon = CALLOUT_ICONS[tone];
  return (
    <div className={`callout${tone !== 'info' ? ` callout-${tone}` : ''}`}>
      <Icon size={15} />
      <div className="selectable">{children}</div>
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      {icon}
      <h3>{title}</h3>
      {children && <p style={{ maxWidth: 440 }}>{children}</p>}
      {action}
    </div>
  );
}

export function PageHeader({ title, description, actions }: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function CodeBlock({ children, maxHeight }: { children: ReactNode; maxHeight?: number }) {
  return <pre className="code-block" style={{ maxHeight }}>{children}</pre>;
}
