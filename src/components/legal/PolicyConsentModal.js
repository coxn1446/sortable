import React, { useEffect, useState } from 'react';

import Button from '../ui/Button';
import Modal from '../ui/Modal';
import {
  LEGAL_BOILERPLATE_EFFECTIVE_NOTICE,
  PrivacyPolicySections,
  TermsPolicySections,
} from '../../legal/policyDocuments';

/** @typedef {null | 'privacy' | 'terms'} ReaderOverlay */

const linkButtonClass =
  'inline rounded font-semibold text-sortable-highlight underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sortable-highlight';

/**
 * Shown after login when ops reset `privacy_policy_agreed` and/or `terms_agreed` until the user acknowledges.
 *
 * @param {{
 *   open: boolean;
 *   needsPrivacy: boolean;
 *   needsTerms: boolean;
 *   onAgree: () => Promise<void>;
 *   onSignOut: () => Promise<void>;
 * }} props
 */
export default function PolicyConsentModal({
  open,
  needsPrivacy,
  needsTerms,
  onAgree,
  onSignOut,
}) {
  const [busy, setBusy] = useState(false);
  const [reader, setReader] = useState(/** @type {ReaderOverlay} */ (null));

  useEffect(() => {
    if (!open) setReader(null);
  }, [open]);

  async function submitAgree() {
    if (busy) return;
    setBusy(true);
    try {
      await onAgree();
    } finally {
      setBusy(false);
    }
  }

  async function submitSignOut() {
    if (busy) return;
    setBusy(true);
    try {
      await onSignOut();
    } finally {
      setBusy(false);
    }
  }

  function closeReader() {
    setReader(null);
  }

  return (
    <>
      <Modal
        open={open}
        onClose={() => {}}
        disableBackdropClose
        className="max-w-lg"
        title="Policy update"
        footer={
          <>
            <Button type="button" variant="ghost" disabled={busy} onClick={submitSignOut}>
              Sign out
            </Button>
            <Button type="button" variant="primary" disabled={busy} onClick={submitAgree}>
              {busy ? 'Saving…' : 'I agree and want to continue'}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-sortable-text-secondary">
          We have updated our legal documents. Review the policies below and agree before continuing to use
          Sortable.
        </p>
        {(needsPrivacy || needsTerms) && (
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-sortable-text-primary">
            {needsPrivacy ? (
              <li>
                <button type="button" className={linkButtonClass} onClick={() => setReader('privacy')}>
                  Privacy Policy
                </button>
              </li>
            ) : null}
            {needsTerms ? (
              <li>
                <button type="button" className={linkButtonClass} onClick={() => setReader('terms')}>
                  Terms &amp; Conditions
                </button>
              </li>
            ) : null}
          </ul>
        )}
      </Modal>

      <Modal
        elevated
        open={reader === 'privacy'}
        onClose={closeReader}
        title="Privacy Policy"
        className="max-w-3xl"
        footer={
          <Button type="button" variant="ghost" onClick={closeReader}>
            Close
          </Button>
        }
      >
        <p className="text-sm leading-relaxed text-sortable-text-secondary">{LEGAL_BOILERPLATE_EFFECTIVE_NOTICE}</p>
        <div className="mt-6">
          <PrivacyPolicySections />
        </div>
      </Modal>

      <Modal
        elevated
        open={reader === 'terms'}
        onClose={closeReader}
        title="Terms & Conditions"
        className="max-w-3xl"
        footer={
          <Button type="button" variant="ghost" onClick={closeReader}>
            Close
          </Button>
        }
      >
        <p className="text-sm leading-relaxed text-sortable-text-secondary">{LEGAL_BOILERPLATE_EFFECTIVE_NOTICE}</p>
        <div className="mt-6">
          <TermsPolicySections />
        </div>
      </Modal>
    </>
  );
}
