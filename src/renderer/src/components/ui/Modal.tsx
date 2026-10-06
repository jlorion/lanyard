import { useEffect, useRef, type FormEvent, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

export interface ModalProps {
  title: ReactNode;
  icon?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  /** Render the body as a form; Enter submits. */
  onSubmit?: () => void;
}

export function Modal({ title, icon, onClose, children, footer, wide, onSubmit }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  // Runs once per mount: parents usually pass an inline onClose, and re-running
  // this on every render would steal focus back to the first field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
    };
    window.addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLElement>('input:not([type=checkbox]):not([type=radio]), textarea, select')?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit?.();
  };

  const content = (
    <>
      <div className="modal-header">
        {icon}
        <h2>{title}</h2>
        <span className="spacer" />
        <Button variant="ghost" size="sm" iconOnly title="Close" icon={<X size={16} />} onClick={onClose} />
      </div>
      <div className="modal-body">{children}</div>
      {footer && <div className="modal-footer">{footer}</div>}
    </>
  );

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true">
        {onSubmit ? <form onSubmit={submit} style={{ display: 'contents' }}>{content}</form> : content}
      </div>
    </div>
  );
}
