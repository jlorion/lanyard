import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Spinner } from './Spinner';

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
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button type={type} className={classes} disabled={disabled || loading} aria-label={iconOnly ? rest.title : undefined} {...rest}>
      {loading ? <Spinner size={14} /> : icon}
      {children}
    </button>
  );
}
