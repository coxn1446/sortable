import React from 'react';

/** Logo + wordmark (no link) — parent supplies layout (e.g. flex + gap). */
export default function SortableBrandMark() {
  return (
    <>
      <img
        src="/sortable-logo.png"
        alt=""
        width={36}
        height={36}
        className="h-9 w-9 shrink-0 rounded-xl border border-white/25 bg-white/[0.07] object-contain p-0.5 shadow-glow ring-2 ring-sortable-highlight/30"
      />
      <span className="text-sortable-text-secondary select-none px-0.5" aria-hidden>
        |
      </span>
      <span className="font-display text-lg font-semibold text-sortable-text-primary">Sortable</span>
    </>
  );
}
