import React, { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';

import SortableBrandMark from '../ui/SortableBrandMark';
import ProfileAvatar from '../ui/ProfileAvatar';
import {
  IconActivity,
  IconCreate,
  IconDiscover,
  IconHome,
  IconList,
  IconProfile,
} from '../icons/SortableIcons';
import { clearUser, selectIsAuthenticated, selectUser } from '../../store/auth.reducer';
import { logout } from '../../helpers/authHelpers';

const MAIN_NAV = [
  { to: '/lists/new', label: 'Make New List', Icon: IconCreate, end: false },
  { to: '/', label: 'Home', Icon: IconHome, end: true },
  { to: '/discover', label: 'Discover', Icon: IconDiscover, end: false },
  { to: '/lists', label: 'Lists', Icon: IconList, end: true },
  { to: '/activity', label: 'Activity', Icon: IconActivity, end: false },
];

const PROFILE_NAV = { to: '/profile', label: 'Profile', Icon: IconProfile, end: false };

const GUEST_MAIN_PATHS = new Set(['/', '/discover']);

export function navItemClass({ isActive }) {
  return [
    'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors duration-200 ease-smooth',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sortable-highlight',
    isActive
      ? 'bg-white/10 text-sortable-text-primary'
      : 'text-sortable-text-secondary hover:bg-white/5 hover:text-sortable-text-primary',
  ].join(' ');
}

function MainNavLinks({ onNavigate, isAuthenticated }) {
  const mainItems = isAuthenticated
    ? MAIN_NAV
    : MAIN_NAV.filter((item) => GUEST_MAIN_PATHS.has(item.to));
  const items = isAuthenticated ? [...mainItems, PROFILE_NAV] : mainItems;
  return (
    <div className="flex flex-col gap-1 px-2 py-3">
      {items.map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={navItemClass}
          onClick={onNavigate}
        >
          <Icon className="h-5 w-5 shrink-0 text-sortable-primary-start" />
          <span>{label}</span>
        </NavLink>
      ))}
    </div>
  );
}

export default function Nav() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const user = useSelector(selectUser);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') setMobileOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  const closeMobile = () => setMobileOpen(false);

  const handleLogout = async () => {
    closeMobile();
    try {
      await logout();
    } catch (error) {
      // best-effort logout; we still clear the local session below
    }
    dispatch(clearUser());
    toast.success('Signed out');
    navigate('/login');
  };

  const footerAuth = (
    <div className="border-t border-white/10 p-3">
      <button
        type="button"
        onClick={handleLogout}
        className="w-full rounded-xl border border-white/10 bg-sortable-card px-3 py-2.5 text-sm font-medium text-sortable-text-primary transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sortable-highlight"
      >
        Log out
      </button>
    </div>
  );

  const footerGuest = (
    <div className="border-t border-white/10 p-3">
      <NavLink
        to="/register"
        className="flex w-full items-center justify-center rounded-xl bg-sortable-gradient px-3 py-2.5 text-sm font-medium text-white shadow-glow transition-transform duration-200 ease-smooth hover:scale-102 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sortable-highlight"
        onClick={closeMobile}
      >
        Sign up
      </NavLink>
    </div>
  );

  return (
    <>
      {/* Mobile: top bar + dropdown */}
      <div className="relative z-50 shrink-0 lg:hidden">
        <div className="flex items-center border-b border-white/10 bg-sortable-bg/95 backdrop-blur">
          <button
            type="button"
            className="flex min-w-0 items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sortable-highlight"
            aria-expanded={mobileOpen}
            aria-controls="sortable-mobile-nav"
            aria-haspopup="true"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMobileOpen((o) => !o)}
          >
            <span className="flex min-w-0 items-center gap-2">
              <SortableBrandMark />
            </span>
            <svg
              width={18}
              height={18}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`shrink-0 text-sortable-text-secondary transition-transform duration-200 ease-smooth ${mobileOpen ? 'rotate-180' : ''}`}
              aria-hidden
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {isAuthenticated && user ? (
            <NavLink
              to="/profile"
              className="ml-auto flex min-w-0 max-w-[55%] shrink items-center gap-2 px-4 py-3 text-right transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sortable-highlight"
              aria-label="Profile"
            >
              <span className="min-w-0 truncate text-sm font-medium text-sortable-text-primary">
                {user.username || 'Profile'}
              </span>
              <span className="text-sortable-text-secondary select-none" aria-hidden>
                |
              </span>
              <ProfileAvatar
                userId={user.user_id}
                username={user.username}
                profilePicture={user.profile_picture}
                size="sm"
                className="shrink-0"
              />
            </NavLink>
          ) : null}
        </div>

        {mobileOpen ? (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 bg-black/50"
              aria-label="Close menu"
              onClick={closeMobile}
            />
            <div
              id="sortable-mobile-nav"
              className="absolute left-0 right-0 top-full z-50 max-h-[min(70vh,calc(100vh-4rem))] overflow-y-auto border-b border-white/10 bg-sortable-bg shadow-soft"
              role="menu"
            >
              <MainNavLinks onNavigate={closeMobile} isAuthenticated={isAuthenticated} />
              {isAuthenticated ? footerAuth : footerGuest}
            </div>
          </>
        ) : null}
      </div>

      {/* Desktop: left sidebar */}
      <aside className="hidden min-h-0 w-56 shrink-0 flex-col border-r border-white/10 bg-sortable-bg lg:flex lg:h-screen">
        <div className="shrink-0 border-b border-white/10 px-4 py-4">
          <NavLink
            to="/"
            className="flex min-w-0 items-center gap-2 rounded-xl outline-none ring-sortable-highlight transition-colors hover:bg-white/5 focus-visible:ring-2"
            aria-label="Sortable home"
          >
            <SortableBrandMark />
          </NavLink>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto" aria-label="Main">
          <MainNavLinks isAuthenticated={isAuthenticated} />
        </nav>

        {isAuthenticated ? footerAuth : footerGuest}
      </aside>
    </>
  );
}
