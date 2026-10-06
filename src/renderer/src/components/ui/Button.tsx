import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';

type Variant = 'default' | 'primary' | 'danger' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'md' | 'sm';
  icon?: ReactNode;
  loading?: boolean;
  /** Square icon-only button; `title` becomes its accessible label. */
  iconOnly?: boolean;
  danger?: boolean;
}

export function Button({
  variant = 'default',
  size = 'md',
  icon,
  loading,
  iconOnly,
  danger,
  className = '',
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = [
    'btn',
    variant !== 'default' && `btn-${variant}`,
    size === 'sm' && 'btn-sm',
    iconOnly && 'btn-icon',
    danger && 'danger',
    className,
  ].filter(Boolean).join(' ');
  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-label={iconOnly ? rest.title : undefined}
      {...rest}
    >
      {loading ? <LoaderCircle size={14} className="spin" /> : icon}
      {children}
    </button>
  );
}
