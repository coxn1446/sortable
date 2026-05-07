import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';

import { selectDiscoverLists, setDiscoverLists } from '../store/lists.reducer';
import { fetchDiscoverLists } from '../helpers/listHelpers';
import { listRoutePath } from '../helpers/listRoutePaths';
import { selectIsAuthenticated } from '../store/auth.reducer';
import EmptyState from '../components/ui/EmptyState';
import HomeHero from '../components/home/HomeHero';
import ListPreviewCard from '../components/lists/ListPreviewCard';

export default function Home() {
  const dispatch = useDispatch();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const discover = useSelector(selectDiscoverLists);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const pub = await fetchDiscoverLists();
        if (active) dispatch(setDiscoverLists(pub));
      } catch (e) {
        if (active) setError(e.message);
      }
    })();
    return () => {
      active = false;
    };
  }, [dispatch]);

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-col gap-10 px-4 py-8 sm:gap-12 sm:py-12">
      <HomeHero isAuthenticated={isAuthenticated} />

      {error ? (
        <p className="text-sm text-sortable-danger">{error}</p>
      ) : null}

      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-2xl font-semibold text-sortable-text-primary">
            Discover lists
          </h2>
          <Link
            to="/discover"
            className="shrink-0 text-sm font-semibold text-sortable-highlight hover:underline"
          >
            View more
          </Link>
        </div>
        {discover.length === 0 ? (
          <EmptyState
            title="No public lists yet"
            description="When other people share lists, they'll show up here."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {discover.slice(0, 6).map((list) => (
              <ListPreviewCard
                key={list.list_id}
                list={list}
                ctaLabel="View"
                ctaTo={listRoutePath(String(list.list_id))}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
