import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';

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

const PROFILE_OAUTH_ERRORS = {
  profile_link_google_in_use: 'This Google account is already used on another profile.',
  profile_link_google_conflict: 'A different Google account is already linked to this profile.',
  profile_link_google_failed: 'Could not link Google. Try again.',
  profile_link_apple_in_use: 'This Apple ID is already used on another profile.',
  profile_link_apple_conflict: 'A different Apple ID is already linked to this profile.',
  profile_link_apple_failed: 'Could not link Apple. Try again.',
  apple: 'Apple sign-in did not complete.',
  google: 'Google sign-in did not complete.',
};

export default function Profile() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const user = useSelector(selectUser);
  const myLists = useSelector(selectMyLists);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const linked = searchParams.get('linked');
    const notice = searchParams.get('notice');
    const oauthError = searchParams.get('oauth_error');
    if (!linked && !notice && !oauthError) return;

    const next = new URLSearchParams(searchParams);
    if (linked === 'google') {
      toast.success('Google sign-in linked to your account.');
      next.delete('linked');
    } else if (linked === 'apple') {
      toast.success('Apple sign-in linked to your account.');
      next.delete('linked');
    }
    if (notice === 'google_already_linked') {
      toast.success('Google is already linked to this account.');
      next.delete('notice');
    } else if (notice === 'apple_already_linked') {
      toast.success('Apple is already linked to this account.');
      next.delete('notice');
    }
    if (oauthError) {
      toast.error(PROFILE_OAUTH_ERRORS[oauthError] || 'Could not complete sign-in link.');
      next.delete('oauth_error');
    }

    const qs = next.toString();
    navigate({ pathname: '/profile', search: qs ? `?${qs}` : '' }, { replace: true });
  }, [searchParams, navigate]);

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
