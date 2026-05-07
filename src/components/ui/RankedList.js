import React, { useEffect, useRef } from 'react';

/**
 * Renders an ordered list of ranked items.
 * - On rank changes, animates each row to its new position using the FLIP technique
 *   (capture First/Last positions, then play the inverse transform).
 * - On the *first* render with `revealOnMount`, items fade/slide in one-by-one.
 *
 * `items` must be an ordered array; each item needs an `id` and a `label`.
 */
export default function RankedList({
  items,
  revealOnMount = false,
  emphasizeTop = 3,
  className = '',
  renderTrailing,
}) {
  const containerRef = useRef(null);
  const positionsRef = useRef(new Map());
  const hasMountedRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const rowEls = Array.from(container.querySelectorAll('[data-rank-row]'));

    // First mount: optional staggered reveal.
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      rowEls.forEach((el) => {
        positionsRef.current.set(el.dataset.itemId, el.getBoundingClientRect().top);
      });
      if (revealOnMount) {
        rowEls.forEach((el, idx) => {
          el.animate(
            [
              { opacity: 0, transform: 'translateY(8px)' },
              { opacity: 1, transform: 'translateY(0)' },
            ],
            { duration: 220, delay: idx * 40, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'backwards' }
          );
        });
      }
      return;
    }

    // Subsequent updates: FLIP for any row whose top changed.
    rowEls.forEach((el) => {
      const id = el.dataset.itemId;
      const prevTop = positionsRef.current.get(id);
      const nextTop = el.getBoundingClientRect().top;
      if (prevTop !== undefined && prevTop !== nextTop) {
        const delta = prevTop - nextTop;
        el.animate(
          [
            { transform: `translateY(${delta}px)` },
            { transform: 'translateY(0)' },
          ],
          { duration: 250, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' }
        );
      }
      positionsRef.current.set(id, nextTop);
    });
  }, [items, revealOnMount]);

  if (!items || items.length === 0) return null;

  return (
    <ol ref={containerRef} className={['flex flex-col gap-2', className].join(' ')}>
      {items.map((item, idx) => {
        const rank = idx + 1;
        const isTop = rank <= emphasizeTop;
        return (
          <li
            key={item.id}
            data-rank-row
            data-item-id={item.id}
            className={[
              'flex items-center gap-4 rounded-2xl px-4 py-3 border border-white/5',
              isTop ? 'bg-sortable-card shadow-soft' : 'bg-sortable-surface',
            ].join(' ')}
          >
            <span
              className={[
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-display text-lg font-semibold',
                isTop ? 'bg-sortable-gradient text-white' : 'bg-white/5 text-sortable-text-secondary',
              ].join(' ')}
              aria-hidden
            >
              {rank}
            </span>
            <span className="flex-1 truncate text-sortable-text-primary">{item.label}</span>
            {renderTrailing ? renderTrailing(item, rank) : null}
          </li>
        );
      })}
    </ol>
  );
}
