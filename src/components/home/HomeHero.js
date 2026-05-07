import React from 'react';
import { Link } from 'react-router-dom';

import Button from '../ui/Button';
import { IconCreate } from '../icons/SortableIcons';

/**
 * Marketing header for Home — explains Sortable and routing to create a list (Discover stays below).
 */
export default function HomeHero({ isAuthenticated }) {
  return (
    <section className="flex flex-col items-start gap-5 rounded-3xl border border-white/5 bg-sortable-card p-6 shadow-soft sm:p-10">
      <span className="text-xs uppercase tracking-[0.2em] text-sortable-highlight">
        Clarity through choice
      </span>
      <h1 className="font-display text-4xl font-semibold leading-tight text-sortable-text-primary sm:text-5xl">
        Make hard decisions feel easy.
      </h1>
      <p className="max-w-2xl text-base text-sortable-text-secondary sm:text-lg">
        Sortable turns big lists of options into clear rankings, one this-or-that decision at a time.
      </p>
      <div className="flex flex-wrap gap-3">
        {isAuthenticated ? (
          <Link to="/lists/new">
            <Button size="lg">
              <IconCreate className="h-5 w-5 shrink-0 text-white" />
              Create List
            </Button>
          </Link>
        ) : (
          <>
            <Link to="/register">
              <Button size="lg">Get started</Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="secondary">
                Sign in
              </Button>
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
