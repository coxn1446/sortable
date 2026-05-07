import React, { forwardRef } from 'react';

import Button from './Button';

/**
 * The core tap target: two side-by-side columns (compact on small screens).
 * and the user picks the winner.
 *
 * - hover lifts to scale-102
 * - active (tap) snaps to scale-105
 * - selected adds a green ring + scale-105 to confirm the choice for ~150ms
 */
const ChoiceCard = forwardRef(function ChoiceCard(
  {
    item,
    onSelect,
    selected = false,
    disabled = false,
    excludeLabel = 'Remove',
    onExclude,
    excludeDisabled = false,
    className = '',
  },
  ref
) {
  const hasImage = Boolean(item?.image_url);

  const shellClasses = [
    'group relative w-full min-w-0 flex flex-col overflow-hidden',
    'min-h-[min(42vw,160px)] sm:min-h-[280px] md:min-h-[360px]',
    'bg-sortable-card rounded-2xl sm:rounded-3xl shadow-soft border border-white/5',
    className,
  ].join(' ');

  const pickClasses = [
    'flex flex-1 flex-col w-full min-h-0',
    hasImage ? 'items-stretch' : 'items-center justify-center p-3 sm:p-8',
    'transition-transform duration-200 ease-smooth',
    'hover:scale-102 active:scale-105',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sortable-highlight rounded-b-none rounded-t-2xl sm:rounded-t-3xl',
    selected ? 'ring-2 ring-sortable-accent scale-105' : '',
    disabled ? 'pointer-events-none opacity-60' : 'cursor-pointer',
  ].join(' ');

  const titleTextClass =
    'font-display text-base leading-snug text-sortable-text-primary text-center break-words sm:text-2xl md:text-3xl';

  return (
    <div className={shellClasses}>
      <button
        ref={ref}
        type="button"
        onClick={() => !disabled && onSelect?.(item)}
        disabled={disabled}
        className={pickClasses}
        aria-pressed={selected}
        aria-label={`Choose ${item?.label || ''}`}
      >
        {hasImage ? (
          <>
            <div className="shrink-0 px-3 pt-3 pb-2 text-center sm:px-8 sm:pt-8 sm:pb-4">
              <span className={titleTextClass}>{item?.label}</span>
            </div>
            <div className="flex min-h-0 flex-1 px-3 pb-3 sm:px-8 sm:pb-8">
              <img
                src={item.image_url}
                alt=""
                className="min-h-0 w-full flex-1 rounded-xl object-cover sm:rounded-2xl"
              />
            </div>
          </>
        ) : (
          <span className={titleTextClass}>{item?.label}</span>
        )}
      </button>

      {typeof onExclude === 'function' ? (
        <div className="border-t border-white/5 px-2 py-2 sm:px-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full shrink-0 text-xs"
            disabled={excludeDisabled || disabled}
            onClick={(ev) => {
              ev.stopPropagation();
              onExclude(item);
            }}
          >
            {excludeLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
});

export default ChoiceCard;
