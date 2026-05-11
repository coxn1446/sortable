import React, { useCallback, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import Button from '../ui/Button';
import ChoiceCard from '../ui/ChoiceCard';
import { IconCreate } from '../icons/SortableIcons';

const SELECT_FLASH_MS = 150;

const HERO_REGISTER = { item_id: 'register', label: 'Register' };
const HERO_SIGN_IN = { item_id: 'login', label: 'Sign In' };

function GuestHeroAuthPicker() {
  const navigate = useNavigate();
  const decidingRef = useRef(false);
  const [selection, setSelection] = useState(null);

  const pick = useCallback((side) => {
    if (decidingRef.current) return;
    decidingRef.current = true;
    setSelection(side);
    setTimeout(() => {
      navigate(side === 'register' ? '/register' : '/login');
    }, SELECT_FLASH_MS);
  }, [navigate]);

  return (
    <div className="w-full max-w-2xl">
      <div className="grid grid-cols-2 gap-2 sm:gap-4">
        <ChoiceCard
          compact
          elevatedSurface
          item={HERO_REGISTER}
          selected={selection === 'register'}
          disabled={selection !== null}
          onSelect={() => pick('register')}
        />
        <ChoiceCard
          compact
          elevatedSurface
          item={HERO_SIGN_IN}
          selected={selection === 'login'}
          disabled={selection !== null}
          onSelect={() => pick('login')}
        />
      </div>
    </div>
  );
}

/**
 * Marketing header for Home — explains Sortable and routing to create a list (Discover stays below).
 * When splash is true (guest landing), hero is centered with compact pairwise preview (Register vs Sign in).
 */
export default function HomeHero({ isAuthenticated, splash = false }) {
  const layout = splash
    ? 'items-center text-center sm:gap-5 sm:p-8'
    : 'items-start sm:p-10';
  const titleClass =
    'font-display text-4xl font-semibold leading-tight text-sortable-text-primary sm:text-5xl';
  const leadClass = 'max-w-2xl text-base text-sortable-text-secondary sm:text-lg';
  const stackGap = splash ? 'gap-4' : 'gap-5';

  return (
    <section
      className={`flex flex-col ${stackGap} rounded-3xl border border-white/5 bg-sortable-card p-6 shadow-soft ${layout}`}
    >
      <span className="text-xs uppercase tracking-[0.2em] text-sortable-highlight">
        Clarity through choice
      </span>
      <h1 className={titleClass}>Make hard decisions feel easy.</h1>
      <p className={leadClass}>
        Sortable turns big lists of options into clear rankings, one this-or-that decision at a time.
      </p>
      {isAuthenticated ? (
        <div className={`flex flex-wrap gap-3 ${splash ? 'justify-center' : ''}`}>
          <Link to="/lists/new">
            <Button size="lg">
              <IconCreate className="h-5 w-5 shrink-0 text-white" />
              Create List
            </Button>
          </Link>
        </div>
      ) : splash ? (
        <GuestHeroAuthPicker />
      ) : (
        <div className="flex flex-wrap gap-3">
          <Link to="/register">
            <Button size="lg">Get started</Button>
          </Link>
          <Link to="/login">
            <Button size="lg" variant="secondary">
              Sign in
            </Button>
          </Link>
        </div>
      )}
    </section>
  );
}
