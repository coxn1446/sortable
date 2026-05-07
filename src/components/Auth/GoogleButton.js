import React from 'react';
import { googleLoginUrl } from '../../helpers/authHelpers';

export default function GoogleButton({ label = 'Continue with Google' }) {
  return (
    <a
      href={googleLoginUrl()}
      className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-sortable-card px-4 py-2.5 text-sm font-medium text-sortable-text-primary transition-transform duration-200 ease-smooth hover:scale-102 hover:bg-white/5"
    >
      {label}
    </a>
  );
}
