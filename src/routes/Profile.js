import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';

import { selectUser } from '../store/auth.reducer';
import { selectMyLists, setMyLists } from '../store/lists.reducer';
import { fetchActivity, fetchMyLists } from '../helpers/listHelpers';
import { listRoutePath } from '../helpers/listRoutePaths';
import EmptyState from '../components/ui/EmptyState';
import Loading from '../components/Loading/Loading';
import Button from '../components/ui/Button';
import { IconCreate } from '../components/icons/SortableIcons';
import ListPreviewCard from '../components/lists/ListPreviewCard';
import ActivityComparisonCard from '../components/lists/ActivityComparisonCard';
import ProfileAccountSection from '../components/profile/ProfileAccountSection';

const LISTS_PREVIEW_COUNT = 6;

export default function Profile() {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const myLists = useSelector(selectMyLists);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [lists, { comparisons }] = await Promise.all([
          fetchMyLists(),
          fetchActivity({ limit: 10, offset: 0 }),
        ]);
        if (!active) return;
        dispatch(setMyLists(lists));
        setActivity(comparisons);
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
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-10 sm:py-14">
      <section className="flex flex-col gap-3">
        <h1 className="font-display text-3xl font-semibold text-sortable-text-primary">Account</h1>
        <ProfileAccountSection user={user} />
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-xl font-semibold text-sortable-text-primary">Lists</h2>
          <Link
            to="/lists"
            className="shrink-0 text-sm font-semibold text-sortable-highlight hover:underline"
          >
            View more
          </Link>
        </div>
        {loading ? (
          <Loading />
        ) : error ? (
          <p className="text-sm text-sortable-danger">{error}</p>
        ) : myLists.length === 0 ? (
          <EmptyState
            title="No lists yet"
            description="Create your first list and start ranking."
            action={
              <Link to="/lists/new">
                <Button>
                  <IconCreate className="h-5 w-5 shrink-0 text-white" />
                  Create a list
                </Button>
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {myLists.slice(0, LISTS_PREVIEW_COUNT).map((list) => (
              <ListPreviewCard
                key={list.list_id}
                list={list}
                ctaLabel="View"
                ctaTo={listRoutePath(String(list.list_id))}
                viewerUserId={user?.user_id}
              />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-xl font-semibold text-sortable-text-primary">Activity</h2>
          <Link
            to="/activity"
            className="shrink-0 text-sm font-semibold text-sortable-highlight hover:underline"
          >
            View more
          </Link>
        </div>
        {loading ? null : error ? null : activity.length === 0 ? (
          <EmptyState
            title="No comparisons yet"
            description="Start ranking a list to see activity here."
          />
        ) : (
          <ol className="flex flex-col gap-3">
            {activity.map((c) => (
              <ActivityComparisonCard key={c.comparison_id} comparison={c} />
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
