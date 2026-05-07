import React from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-20 text-center">
      <div className="h-14 w-14 rounded-2xl bg-sortable-gradient shadow-glow" aria-hidden />
      <h1 className="font-display text-3xl font-semibold">Not found</h1>
      <p className="text-sm text-sortable-text-secondary">
        We couldn&apos;t find what you&apos;re looking for.
      </p>
      <Link to="/">
        <Button>Go home</Button>
      </Link>
    </div>
  );
}
