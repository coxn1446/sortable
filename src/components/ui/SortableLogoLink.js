import React from 'react';
import { NavLink } from 'react-router-dom';

import SortableBrandMark from './SortableBrandMark';

export default function SortableLogoLink({ className = '' }) {
  return (
    <NavLink
      to="/"
      className={`flex shrink-0 items-center gap-2 ${className}`}
      aria-label="Sortable home"
    >
      <SortableBrandMark />
    </NavLink>
  );
}
