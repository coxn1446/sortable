import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';

import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import Loading from '../components/Loading/Loading';
import {
  selectDiscoverLists,
  setDiscoverLists,
} from '../store/lists.reducer';
import { fetchDiscoverLists } from '../helpers/listHelpers';
import { listRoutePath } from '../helpers/listRoutePaths';

export default function Discover() {
  const dispatch = useDispatch();
  const lists = useSelector(selectDiscoverLists);
  const [loading, setLoading] = useState(lists.length === 0);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await fetchDiscoverLists();
        if (active) dispatch(setDiscoverLists(data));
      } catch (e) {
        if (active) setError(e.message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [dispatch]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10 sm:py-14">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-semibold">Discover</h1>
        <p className="text-sortable-text-secondary">
          Public lists you can rank or just browse.
        </p>
      </header>

      {loading ? (
        <Loading />
      ) : error ? (
        <p className="text-sortable-danger">{error}</p>
      ) : lists.length === 0 ? (
        <EmptyState title="Nothing public yet" description="Check back soon." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lists.map((list) => (
            <Card key={list.list_id} className="flex flex-col gap-3 p-5">
              <div>
                <h3 className="font-display text-lg font-semibold">{list.title}</h3>
                {list.description ? (
                  <p className="mt-1 line-clamp-2 text-sm text-sortable-text-secondary">
                    {list.description}
                  </p>
                ) : null}
              </div>
              <Link
                to={listRoutePath(String(list.list_id))}
                className="self-start text-sm font-semibold text-sortable-highlight hover:underline"
              >
                View list →
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
