import React from 'react';

export default function EmptyState({
  title,
  description,
  action,
  className = '',
}) {
  return (
    <div
      className={[
        'flex flex-col items-center justify-center text-center',
        'rounded-2xl border border-white/5 bg-sortable-surface px-6 py-12',
        className,
      ].join(' ')}
    >
      <div
        className="mb-4 h-14 w-14 rounded-2xl bg-sortable-gradient opacity-90 shadow-glow"
        aria-hidden
      />
      <h3 className="font-display text-xl font-semibold text-sortable-text-primary">
        {title}
      </h3>
      {description ? (
        <p className="mt-2 max-w-md text-sm text-sortable-text-secondary">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
