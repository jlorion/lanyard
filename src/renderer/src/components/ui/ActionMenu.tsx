import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';
import { Spinner } from './Spinner';

export interface ActionItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
  /** Draw a divider above this item. */
  separated?: boolean;
}

/**
 * A single "⋯" button that opens a row's actions. The menu is portalled to
 * <body> with fixed positioning so table clipping can't cut it off, and flips
 * upward when there is no room below.
 */
export function ActionMenu({
  items,
  busy,
  label = 'Actions',
  trigger,
  triggerClassName,
}: {
  items: ActionItem[];
  /** Show a spinner on the button while one of the actions runs. */
  busy?: boolean;
  label?: string;
  /** Custom button content (defaults to a "..." icon). */
  trigger?: ReactNode;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  // Position next to the button once the menu has a measurable height.
  useLayoutEffect(() => {
    if (!open || !buttonRef.current || !menuRef.current) return;
    const b = buttonRef.current.getBoundingClientRect();
    const { offsetHeight: h, offsetWidth: w } = menuRef.current; // sized to its longest label
    const below = b.bottom + 4 + h <= window.innerHeight - 8;
    setPos({
      top: below ? b.bottom + 4 : Math.max(8, b.top - 4 - h),
      left: Math.max(8, Math.min(b.right - w, window.innerWidth - w - 8)),
    });
    menuRef.current.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !buttonRef.current?.contains(t)) setOpen(false);
    };
    const onScroll = () => setOpen(false);
    window.addEventListener('mousedown', onPointer);
    window.addEventListener('resize', onScroll);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('mousedown', onPointer);
      window.removeEventListener('resize', onScroll);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  const onMenuKey = (e: React.KeyboardEvent) => {
    const buttons = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])];
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      buttons[(i + 1) % buttons.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      buttons[(i - 1 + buttons.length) % buttons.length]?.focus();
    } else if (e.key === 'Tab') setOpen(false);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`${triggerClassName ?? 'btn btn-ghost btn-sm btn-icon'} action-menu-trigger${open ? ' open' : ''}`}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setPos(null);
          setOpen((o) => !o);
        }}
      >
        {busy ? <Spinner size={15} label="Working" /> : (trigger ?? <MoreHorizontal size={16} />)}
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="action-menu"
            role="menu"
            style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
            onKeyDown={onMenuKey}
          >
            {items.map((item) => (
              <div key={item.label}>
                {item.separated && <div className="action-menu-sep" role="separator" />}
                <button
                  type="button"
                  role="menuitem"
                  className={`action-menu-item${item.danger ? ' danger' : ''}`}
                  disabled={item.disabled}
                  onClick={() => {
                    setOpen(false);
                    item.onSelect();
                  }}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
