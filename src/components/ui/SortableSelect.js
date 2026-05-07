import React, { useEffect, useId, useRef, useState } from 'react';

const buttonBaseClass =
  'flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-sortable-card py-2.5 pl-3 pr-3 text-left text-sm text-sortable-text-primary shadow-soft transition-colors hover:border-white/15 focus:border-sortable-highlight focus:outline-none focus:ring-1 focus:ring-sortable-highlight disabled:cursor-not-allowed disabled:opacity-50';

const listClass =
  'absolute left-0 right-0 top-full z-40 mt-1 max-h-60 overflow-auto rounded-xl border border-white/10 bg-sortable-bg/98 py-1 shadow-soft ring-1 ring-sortable-highlight/20 backdrop-blur-xl';

const optionClass =
  'flex w-full items-center px-3 py-2 text-left text-sm text-sortable-text-secondary transition-colors hover:bg-white/[0.07] hover:text-sortable-text-primary';
const optionSelectedClass = 'bg-sortable-highlight/12 text-sortable-text-primary';

function optionAriaLabel(opt) {
  if (opt.optionAriaLabel != null && opt.optionAriaLabel !== '') return opt.optionAriaLabel;
  if (typeof opt.label === 'string') return opt.label;
  return 'Option';
}

/**
 * Custom listbox-style control — replaces native `<select>` where a bespoke menu is required.
 * `options[].label` may be a React node; set `options[].optionAriaLabel` for accessibility when it is not plain text.
 * @param {{ value: string, onChange: (v: string) => void, options: { value: string, label: import('react').ReactNode, optionAriaLabel?: string }[], className?: string, id?: string, ariaLabel?: string, ariaLabelledBy?: string, disabled?: boolean }} props
 */
export default function SortableSelect({
  value,
  onChange,
  options,
  className = '',
  id,
  ariaLabel,
  ariaLabelledBy,
  disabled,
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const listId = useId();
  const selected = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    function onDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className={['relative', className].filter(Boolean).join(' ')}>
      <button
        type="button"
        id={id}
        role="combobox"
        disabled={disabled}
        className={buttonBaseClass}
        aria-label={ariaLabelledBy ? undefined : ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => !disabled && setOpen((o) => !o)}
      >
        <span className="min-w-0 flex-1 overflow-hidden">{selected?.label ?? '—'}</span>
        <svg
          width={14}
          height={14}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`shrink-0 text-sortable-highlight transition-transform duration-200 ease-smooth ${open ? 'rotate-180' : ''}`}
          aria-hidden
        >
          <path
            d="M6 9l6 6 6-6"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open ? (
        <ul id={listId} role="listbox" className={listClass} aria-activedescendant={value}>
          {options.map((opt) => (
            <li key={opt.value} role="presentation">
              <button
                type="button"
                role="option"
                aria-label={optionAriaLabel(opt)}
                aria-selected={opt.value === value}
                className={[optionClass, opt.value === value ? optionSelectedClass : ''].filter(Boolean).join(' ')}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                {opt.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
