import { cloneElement, isValidElement, type InputHTMLAttributes, type ReactElement, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

/** Red asterisk after a label; the field can't be submitted without a value. */
export function RequiredMark() {
  return <span className="field-required" title="Required" aria-hidden>*</span>;
}

/**
 * Labelled form control. `required` adds a red asterisk to the label (and
 * aria-required to the control); `error` replaces the hint and marks the
 * field invalid.
 */
export function Field({ label, hint, error, required, children, className = '' }: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  // aria-required belongs on the control itself, not on wrapper elements like <div>.
  const isControl = isValidElement(children)
    && (typeof children.type !== 'string' || ['input', 'select', 'textarea'].includes(children.type));
  const control = required && isControl
    ? cloneElement(children as ReactElement<{ 'aria-required'?: boolean }>, { 'aria-required': true })
    : children;
  return (
    <label className={`field${error ? ' invalid' : ''} ${className}`}>
      {label && <span className="field-label">{label}{required && <RequiredMark />}</span>}
      {control}
      {error
        ? <span className="field-hint field-error" role="alert">{error}</span>
        : hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Input({ mono, className = '', ...rest }: InputHTMLAttributes<HTMLInputElement> & { mono?: boolean }) {
  return <input className={`input${mono ? ' mono' : ''} ${className}`} spellCheck={false} {...rest} />;
}

export function Select({ className = '', children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`select ${className}`} {...rest}>{children}</select>;
}

export function Textarea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`textarea ${className}`} spellCheck={false} {...rest} />;
}

export function Checkbox({ checked, onChange, label, hint }: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <label className="checkbox">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        {label}
        {hint && <div className="field-hint">{hint}</div>}
      </span>
    </label>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          className={o.value === value ? 'active' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
