import React from 'react';

/** Native `<select>` styled for Sortable — hides OS chrome and shows a brand chevron. */
export default function SortableNativeSelect({ className = '', children, ...rest }) {
  return (
    <div className={['relative', className].filter(Boolean).join(' ')}>
      <select
        className="w-full appearance-none rounded-xl border border-white/10 bg-sortable-card py-2.5 pl-3 pr-10 text-sm text-sortable-text-primary shadow-soft transition-colors hover:border-white/15 focus:border-sortable-highlight focus:outline-none focus:ring-1 focus:ring-sortable-highlight"
        {...rest}
      >
        {children}
      </select>
      <span
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sortable-highlight"
        aria-hidden
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M6 9l6 6 6-6"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </div>
  );
}
