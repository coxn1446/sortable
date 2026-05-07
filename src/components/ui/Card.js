import React from 'react';

export default function Card({ as: Tag = 'div', className = '', children, ...rest }) {
  return (
    <Tag
      className={[
        'bg-sortable-card rounded-2xl shadow-soft border border-white/5',
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
    </Tag>
  );
}
