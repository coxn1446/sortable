import React from 'react';
import { appleLoginUrl } from '../../helpers/authHelpers';

export default function AppleButton({ label = 'Continue with Apple' }) {
  return (
    <a
      href={appleLoginUrl()}
      className="flex items-center justify-center gap-2 rounded-2xl bg-black px-4 py-2.5 text-sm font-medium text-white transition-transform duration-200 ease-smooth hover:scale-102 hover:opacity-95"
    >
      {label}
    </a>
  );
}
