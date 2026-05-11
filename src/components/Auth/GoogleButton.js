import React from 'react';
import { googleLoginUrl } from '../../helpers/authHelpers';

const MODE_LABEL = {
  continue: 'Continue with Google',
  signIn: 'Sign in with Google',
  signUp: 'Sign up with Google',
};

function GoogleLogoMark({ className }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden>
      <path
        className="fill-sortable-oauth-googleBlue"
        d="M43.611 20.083H42V20H24v8h11.303C33.958 32.684 29.283 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.962 3.038l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        className="fill-sortable-oauth-googleGreen"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.962 3.038l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        className="fill-sortable-oauth-googleYellow"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.263 0-9.907-3.024-12.16-7.454l-6.556 5.045C9.314 39.556 16.227 44 24 44z"
      />
      <path
        className="fill-sortable-oauth-googleRed"
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}

export default function GoogleButton({ mode = 'continue', linkAccount = false, className = '' }) {
  const label = MODE_LABEL[mode] || MODE_LABEL.continue;
  return (
    <a
      href={googleLoginUrl({ linkAccount })}
      className={`flex min-h-10 items-center justify-center gap-3 rounded-2xl border border-sortable-oauth-googleButtonBorder bg-sortable-oauth-googleButtonBg px-4 py-2.5 text-sm font-medium text-sortable-oauth-googleButtonText transition-transform duration-200 ease-smooth hover:scale-102 ${className}`}
    >
      <GoogleLogoMark className="h-5 w-5 shrink-0" />
      <span>{label}</span>
    </a>
  );
}
