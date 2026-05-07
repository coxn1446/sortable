import React, { useEffect, useRef, useState } from 'react';

import EmptyState from '../components/ui/EmptyState';
import Loading from '../components/Loading/Loading';
import Button from '../components/ui/Button';
import { fetchActivity } from '../helpers/listHelpers';
import ActivityComparisonCard from '../components/lists/ActivityComparisonCard';

export default function Activity() {
  const [searchRaw, setSearchRaw] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [items, setItems] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [pending, setPending] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const qRef = useRef(debouncedQ);

  qRef.current = debouncedQ;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchRaw.trim()), 350);
    return () => clearTimeout(t);
  }, [searchRaw]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPending(true);
      setError(null);
      try {
        const { comparisons, has_more } = await fetchActivity({
          limit: 20,
          offset: 0,
          q: debouncedQ,
        });
        if (cancelled) return;
        setItems(comparisons);
        setHasMore(has_more);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setPending(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedQ]);

  const loadMore = async () => {
    if (!hasMore || loadingMore || pending) return;
    const qSnap = qRef.current;
    setLoadingMore(true);
    try {
      const { comparisons, has_more } = await fetchActivity({
        limit: 20,
        offset: items.length,
        q: qSnap,
      });
      if (qSnap !== qRef.current) return;
      setItems((prev) => [...prev, ...comparisons]);
      setHasMore(has_more);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingMore(false);
    }
  };

  const showFullSpinner = pending && items.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10 sm:py-14">
      <header>
        <h1 className="font-display text-3xl font-semibold text-sortable-text-primary">Activity</h1>
        <p className="mt-1 text-sm text-sortable-text-secondary">
          Your comparisons. Search by list title or item labels.
        </p>
      </header>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-sortable-text-secondary">Search</span>
        <input
          type="search"
          value={searchRaw}
          onChange={(e) => setSearchRaw(e.target.value)}
          placeholder="Filter by list or item…"
          className="rounded-xl border border-white/10 bg-sortable-surface px-3 py-2 text-sm text-sortable-text-primary placeholder:text-sortable-text-secondary focus:border-sortable-highlight focus:outline-none focus:ring-1 focus:ring-sortable-highlight"
          autoComplete="off"
        />
      </label>

      {pending && items.length > 0 ? (
        <p className="text-xs text-sortable-text-secondary">Updating…</p>
      ) : null}

      {showFullSpinner ? (
        <Loading />
      ) : error ? (
        <p className="text-sortable-danger">{error}</p>
      ) : items.length === 0 ? (
        <EmptyState
          title={debouncedQ ? 'No matches' : 'No comparisons yet'}
          description={
            debouncedQ
              ? 'Try a different search term.'
              : 'Start ranking a list to see activity here.'
          }
        />
      ) : (
        <>
          <ol className="flex flex-col gap-3">
            {items.map((c) => (
              <ActivityComparisonCard key={c.comparison_id} comparison={c} />
            ))}
          </ol>
          {hasMore ? (
            <div className="flex justify-center pt-2">
              <Button type="button" variant="secondary" onClick={loadMore} disabled={loadingMore || pending}>
                {loadingMore ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
