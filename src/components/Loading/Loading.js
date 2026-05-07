import React from 'react';

export default function Loading({ label = 'Loading' }) {
  return (
    <div className="flex h-full min-h-[200px] w-full items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div
          className="h-12 w-12 rounded-2xl bg-sortable-gradient opacity-90 shadow-glow"
          style={{ animation: 'pulse 1.6s ease-in-out infinite' }}
          aria-label="loading"
        />
        <div className="text-sm font-medium text-sortable-text-secondary">{label}</div>
      </div>
    </div>
  );
}
