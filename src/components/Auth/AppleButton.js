import React from 'react';
import toast from 'react-hot-toast';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import {
  appleLoginUrl,
  fetchNativeAppleLinkBootstrapUrl,
  openSystemBrowserForOAuthStart,
} from '../../helpers/authHelpers';

const MODE_LABEL = {
  continue: 'Continue with Apple',
  signIn: 'Sign in with Apple',
  signUp: 'Sign up with Apple',
};

function AppleLogoMark({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.029 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
      />
    </svg>
  );
}

export default function AppleButton({ mode = 'continue', linkAccount = false, className = '' }) {
  const label = linkAccount
    ? 'Link Apple account'
    : MODE_LABEL[mode] || MODE_LABEL.continue;
  const href = appleLoginUrl({ linkAccount });

  async function onClick(e) {
    if (linkAccount && Capacitor.isNativePlatform()) {
      e.preventDefault();
      try {
        const url = await fetchNativeAppleLinkBootstrapUrl();
        await Browser.open({ url });
      } catch (err) {
        console.error('[oauth-native-client] Apple link bootstrap failed', { message: err?.message });
        toast.error(err?.message || 'Could not open Apple link');
      }
      return;
    }
    if (!Capacitor.isNativePlatform()) return;
    e.preventDefault();
    openSystemBrowserForOAuthStart(href, { linkAccount }).catch((e) => {
      console.error('[oauth-native-client] Browser.open failed', { message: e?.message });
    });
  }

  return (
    <a
      href={href}
      onClick={onClick}
      className={`flex min-h-10 items-center justify-center gap-3 rounded-2xl bg-sortable-oauth-appleButtonBg px-4 py-2.5 text-sm font-medium text-sortable-oauth-appleButtonText transition-transform duration-200 ease-smooth hover:scale-102 hover:opacity-95 ${className}`}
    >
      <AppleLogoMark className="h-5 w-5 shrink-0" />
      <span>{label}</span>
    </a>
  );
}
