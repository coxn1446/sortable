import React, { forwardRef } from 'react';

import Button from './Button';

/**
 * The core tap target: two side-by-side columns (compact on small screens).
 * and the user picks the winner.
 *
 * - hover lifts to scale-102
 * - active (tap) snaps to scale-105
 * - selected adds a green ring + scale-105 to confirm the choice for ~150ms
 *
 * @param {boolean} [compact=false] Use shorter min-heights and smaller titles (text-only layouts).
 * @param {boolean} [elevatedSurface=false] Lighter card fill for contrast on `bg-sortable-card` shells.
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
    /** Smaller vertical footprint — e.g. marketing hero pairwise preview */
    compact = false,
    elevatedSurface = false,
  },
  ref
) {
  const hasImage = Boolean(item?.image_url);

  const shellMin = compact
    ? 'min-h-28 sm:min-h-32 md:min-h-36'
    : 'min-h-[min(42vw,160px)] sm:min-h-[280px] md:min-h-[360px]';

  const shellBg = elevatedSurface ? 'bg-sortable-cardRaised' : 'bg-sortable-card';

  const shellClasses = [
    'group relative w-full min-w-0 flex flex-col overflow-hidden',
    shellMin,
    shellBg,
    'rounded-2xl sm:rounded-3xl shadow-soft border border-white/5',
    className,
  ].join(' ');

  const textOnlyPad = compact ? 'items-center justify-center p-2 sm:p-4' : 'items-center justify-center p-3 sm:p-8';

  const pickClasses = [
    'flex flex-1 flex-col w-full min-h-0',
    hasImage ? 'items-stretch' : textOnlyPad,
    'transition-transform duration-200 ease-smooth',
    'hover:scale-102 active:scale-105',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sortable-highlight rounded-b-none rounded-t-2xl sm:rounded-t-3xl',
    selected ? 'ring-2 ring-sortable-accent scale-105' : '',
    disabled ? 'pointer-events-none opacity-60' : 'cursor-pointer',
  ].join(' ');

  const titleTextClass = compact
    ? 'font-display text-sm leading-snug text-sortable-text-primary text-center break-words sm:text-lg md:text-xl'
    : 'font-display text-base leading-snug text-sortable-text-primary text-center break-words sm:text-2xl md:text-3xl';

  const imageTitleWrap = compact ? 'sm:px-4 sm:pt-4 sm:pb-2' : 'sm:px-8 sm:pt-8 sm:pb-4';

  const imageBodyWrap = compact ? 'sm:px-4 sm:pb-4' : 'sm:px-8 sm:pb-8';

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
            <div className={`shrink-0 px-3 pt-3 pb-2 text-center ${imageTitleWrap}`}>
              <span className={titleTextClass}>{item?.label}</span>
            </div>
            <div className={`flex min-h-0 flex-1 px-3 pb-3 ${imageBodyWrap}`}>
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
