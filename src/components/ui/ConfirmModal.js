import React from 'react';

import Button from './Button';
import Modal from './Modal';

/**
 * Standard confirmation dialog — use for destructive or irreversible actions.
 *
 * @param {{
 *   open: boolean;
 *   onClose: () => void;
 *   onConfirm: () => void | Promise<void>;
 *   title: string;
 *   description: React.ReactNode;
 *   confirmLabel?: string;
 *   cancelLabel?: string;
 *   confirmVariant?: 'primary' | 'danger';
 *   busy?: boolean;
 * }} props
 */
export default function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'danger',
  busy = false,
}) {
  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      disableBackdropClose={busy}
      title={title}
      footer={
        <>
          <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button type="button" variant={confirmVariant} disabled={busy} onClick={() => onConfirm()}>
            {busy ? 'Please wait…' : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm leading-relaxed text-sortable-text-secondary">{description}</div>
    </Modal>
  );
}
