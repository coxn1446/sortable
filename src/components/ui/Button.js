import React from 'react';

const VARIANT_CLASSES = {
  primary:
    'bg-sortable-gradient text-white shadow-glow hover:scale-102 active:scale-105',
  secondary:
    'bg-sortable-card text-sortable-text-primary border border-white/10 hover:bg-white/5',
  ghost:
    'bg-transparent text-sortable-text-secondary hover:text-sortable-text-primary hover:bg-white/5',
  danger:
    'bg-sortable-danger text-white hover:opacity-90',
};

const SIZE_CLASSES = {
  sm: 'px-3 py-1.5 text-sm rounded-xl',
  md: 'px-5 py-2.5 text-sm rounded-2xl',
  lg: 'px-6 py-3 text-base rounded-2xl',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  children,
  ...rest
}) {
  const classes = [
    'inline-flex items-center justify-center gap-2 font-medium',
    'transition-transform duration-200 ease-smooth',
    'disabled:opacity-50 disabled:pointer-events-none',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sortable-highlight',
    VARIANT_CLASSES[variant] || VARIANT_CLASSES.primary,
    SIZE_CLASSES[size] || SIZE_CLASSES.md,
    className,
  ].join(' ');

  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}
