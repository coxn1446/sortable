import React, { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';

/**
 * Full-screen overlay dialog. Portal’d to `document.body`.
 * Reusable shell — pair with `ConfirmModal` or custom footers.
 *
 * @param {{
 *   open: boolean;
 *   onClose: () => void;
 *   title: string;
 *   children?: React.ReactNode;
 *   footer?: React.ReactNode;
 *   className?: string;
 *   overlayClassName?: string;
 *   disableBackdropClose?: boolean;
 *   elevated?: boolean
 * }} props
 */
export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  className = '',
  overlayClassName = '',
  disableBackdropClose = false,
  elevated = false,
}) {
  const titleId = useId();

  /* elevated: second stacked dialog (e.g. policy reader above consent modal). */

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open || disableBackdropClose) return;
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose, disableBackdropClose]);

  if (!open || typeof document === 'undefined') return null;

  const overlayZ = elevated ? 'z-[230]' : 'z-[200]';

  return createPortal(
    <div
      className={`fixed inset-0 ${overlayZ} flex items-center justify-center p-4 sm:p-6`}
      role="presentation"
    >
      <div
        className={`absolute inset-0 bg-black/55 backdrop-blur-[2px] ${overlayClassName}`}
        aria-hidden="true"
        onClick={() => {
          if (!disableBackdropClose) onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative z-10 max-h-[min(90vh,720px)] w-full max-w-md overflow-y-auto rounded-3xl border border-white/10 bg-sortable-card p-6 shadow-soft ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="font-display text-xl font-semibold text-sortable-text-primary">
          {title}
        </h2>
        {children != null ? <div className="mt-3">{children}</div> : null}
        {footer != null ? <div className="mt-6 flex flex-wrap justify-end gap-3">{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}
