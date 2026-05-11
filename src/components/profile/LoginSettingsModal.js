import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import toast from 'react-hot-toast';

import { setUser } from '../../store/auth.reducer';
import { changePassword, unlinkOAuth } from '../../helpers/userHelpers';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import GoogleButton from '../Auth/GoogleButton';
import AppleButton from '../Auth/AppleButton';

const fieldClass =
  'w-full rounded-xl border border-white/10 bg-sortable-surface px-3 py-2 text-sm text-sortable-text-primary placeholder:text-sortable-text-secondary focus:border-sortable-highlight focus:outline-none focus:ring-1 focus:ring-sortable-highlight';

const MIN_PW = 8;

const sectionLabelClass =
  'text-xs font-medium uppercase tracking-wide text-sortable-text-secondary';

/**
 * @param {{ open: boolean; onClose: () => void; user: Record<string, unknown> | null | undefined }} props
 */
export default function LoginSettingsModal({ open, onClose, user }) {
  const dispatch = useDispatch();

  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setPwCurrent('');
      setPwNew('');
      setPwConfirm('');
    }
  }, [open]);

  const canUnlinkGoogle = Boolean(user?.has_password || user?.has_apple);
  const canUnlinkApple = Boolean(user?.has_password || user?.has_google);

  const googleIdpLine = user?.google_email
    ? `Connected · ${user.google_email}`
    : 'Connected';
  const appleIdpLine = user?.apple_email
    ? `Connected · ${user.apple_email}`
    : 'Connected';

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (pwNew.length < MIN_PW) {
      toast.error(`Password must be at least ${MIN_PW} characters`);
      return;
    }
    if (pwNew !== pwConfirm) {
      toast.error('New passwords do not match');
      return;
    }
    setPwSaving(true);
    try {
      const payload = {
        new_password: pwNew,
        ...(user?.has_password ? { current_password: pwCurrent } : {}),
      };
      const next = await changePassword(payload);
      dispatch(setUser(next));
      setPwCurrent('');
      setPwNew('');
      setPwConfirm('');
      toast.success(user?.has_password ? 'Password updated' : 'Password set');
    } catch (err) {
      toast.error(err.message || 'Could not update password');
    } finally {
      setPwSaving(false);
    }
  };

  const handleUnlink = async (provider) => {
    try {
      const next = await unlinkOAuth(provider);
      dispatch(setUser(next));
      toast.success(provider === 'google' ? 'Google sign-in removed' : 'Apple sign-in removed');
    } catch (err) {
      toast.error(err.message || 'Could not remove sign-in');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Log in Settings"
      className="max-w-lg"
      footer={
        <Button type="button" variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="flex flex-col gap-8">
        <div>
          <h3 className={sectionLabelClass}>Password</h3>
          <form onSubmit={handlePasswordSubmit} className="mt-3 flex flex-col gap-3">
            {user?.has_password ? (
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-sortable-text-secondary">Current password</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={pwCurrent}
                  onChange={(e) => setPwCurrent(e.target.value)}
                  className={fieldClass}
                />
              </label>
            ) : null}
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-sortable-text-secondary">New password</span>
              <input
                type="password"
                autoComplete="new-password"
                value={pwNew}
                onChange={(e) => setPwNew(e.target.value)}
                minLength={MIN_PW}
                className={fieldClass}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-sortable-text-secondary">Confirm new password</span>
              <input
                type="password"
                autoComplete="new-password"
                value={pwConfirm}
                onChange={(e) => setPwConfirm(e.target.value)}
                minLength={MIN_PW}
                className={fieldClass}
              />
            </label>
            <Button type="submit" disabled={pwSaving || pwNew.length < MIN_PW}>
              {pwSaving ? 'Saving…' : user?.has_password ? 'Update password' : 'Set password'}
            </Button>
          </form>
        </div>

        <div className="border-t border-white/10 pt-6">
          <h3 className={sectionLabelClass}>Google</h3>
          {user?.has_google ? (
            <div className="mt-3 space-y-2">
              <p className="text-sm text-sortable-text-primary">{googleIdpLine}</p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={!canUnlinkGoogle}
                title={!canUnlinkGoogle ? 'Add another sign-in method first' : undefined}
                onClick={() => canUnlinkGoogle && handleUnlink('google')}
              >
                Remove Google sign-in
              </Button>
            </div>
          ) : (
            <div className="mt-3">
              <GoogleButton mode="signIn" linkAccount className="w-full" />
            </div>
          )}
        </div>

        <div className="border-t border-white/10 pt-6">
          <h3 className={sectionLabelClass}>Apple</h3>
          {user?.has_apple ? (
            <div className="mt-3 space-y-2">
              <p className="text-sm text-sortable-text-primary">{appleIdpLine}</p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={!canUnlinkApple}
                title={!canUnlinkApple ? 'Add another sign-in method first' : undefined}
                onClick={() => canUnlinkApple && handleUnlink('apple')}
              >
                Remove Apple sign-in
              </Button>
            </div>
          ) : (
            <div className="mt-3">
              <AppleButton mode="signIn" linkAccount className="w-full" />
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
