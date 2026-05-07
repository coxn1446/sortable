import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';

import RankedList from '../components/ui/RankedList';
import SortableSelect from '../components/ui/SortableSelect';
import ParticipantSelectOption from '../components/lists/ParticipantSelectOption';
import Button from '../components/ui/Button';
import SortableLogoLink from '../components/ui/SortableLogoLink';
import Loading from '../components/Loading/Loading';
import EmptyState from '../components/ui/EmptyState';
import {
  selectListById,
  selectRankingByListId,
  setList,
  setRanking,
} from '../store/lists.reducer';
import { fetchListById } from '../helpers/listHelpers';
import { fetchRanking } from '../helpers/rankingHelpers';
import { listRoutePath } from '../helpers/listRoutePaths';
import { copyTextToClipboard } from '../helpers/clipboardHelpers';
import { selectIsAuthenticated, selectUser } from '../store/auth.reducer';

const TAB_MINE = 'mine';
const TAB_OTHER = 'other';
const TAB_AGGREGATE = 'aggregate';

async function copyShareUrl(listIdNum) {
  const path = listRoutePath(listIdNum);
  const url = `${window.location.origin}${path}`;
  try {
    await copyTextToClipboard(url);
    toast.success('Link copied to clipboard');
  } catch {
    toast.error('Could not copy link');
  }
}

/**
 * @param {{ listId: number; embedded?: boolean }} props
 */
export function ListResultsPanel({ listId, embedded = false }) {
  const dispatch = useDispatch();
  const key = String(listId);
  const list = useSelector(selectListById(listId));
  const ranking = useSelector(selectRankingByListId(listId));
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const currentUser = useSelector(selectUser);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [revealOnMount, setRevealOnMount] = useState(true);
  const [activeTab, setActiveTab] = useState(TAB_MINE);
  const [otherUserId, setOtherUserId] = useState(null);
  const [otherItems, setOtherItems] = useState(null);
  const [otherLoading, setOtherLoading] = useState(false);
  const [otherError, setOtherError] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const [detail, rankingData] = await Promise.all([
          fetchListById(listId),
          fetchRanking(listId),
        ]);
        if (!active) return;
        dispatch(setList(detail));
        dispatch(setRanking({ listId, ranking: rankingData }));
      } catch (e) {
        if (active) setError(e.message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
      setRevealOnMount(false);
    };
  }, [listId, dispatch]);

  const participants = ranking?.participants || [];
  const otherParticipants = useMemo(
    () =>
      participants.filter(
        (p) => currentUser == null || Number(p.user_id) !== Number(currentUser.user_id)
      ),
    [participants, currentUser]
  );

  const participantOptions = useMemo(
    () =>
      otherParticipants.map((p) => ({
        value: String(p.user_id),
        label: (
          <ParticipantSelectOption
            userId={p.user_id}
            username={p.username}
            profilePicture={p.profile_picture}
          />
        ),
        optionAriaLabel: p.username,
      })),
    [otherParticipants]
  );

  useEffect(() => {
    if (!otherParticipants.length) {
      setOtherUserId(null);
      return;
    }
    setOtherUserId((prev) => {
      if (prev != null && otherParticipants.some((p) => Number(p.user_id) === prev)) {
        return prev;
      }
      return Number(otherParticipants[0].user_id);
    });
  }, [otherParticipants]);

  useEffect(() => {
    if (activeTab !== TAB_OTHER || otherUserId == null || !isAuthenticated) {
      return;
    }
    let active = true;
    (async () => {
      try {
        setOtherLoading(true);
        setOtherError(null);
        const data = await fetchRanking(listId, { viewUserId: otherUserId });
        if (!active) return;
        setOtherItems(data.viewed_personal || null);
      } catch (e) {
        if (active) {
          setOtherError(e.message);
          setOtherItems(null);
        }
      } finally {
        if (active) setOtherLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [activeTab, otherUserId, listId, isAuthenticated]);

  if (loading) return <Loading label="Tallying" />;
  if (error) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <p className="text-sortable-danger">{error}</p>
      </div>
    );
  }

  const personal = ranking?.personal || [];
  const aggregate = ranking?.aggregate || [];
  const showPersonal = personal.length > 0;
  const showAggregate = aggregate.length > 0;
  const finished = !!ranking?.is_finalized;
  const compareHref = finished ? listRoutePath(key, { reset: '1' }) : listRoutePath(key);
  const compareLabel = finished ? 'Reset your ranking' : 'Continue ranking';

  const effectiveTab = !isAuthenticated ? TAB_AGGREGATE : activeTab;

  const rankEntryPath = listRoutePath(key);

  const shellClass = embedded
    ? 'mx-auto flex w-full max-w-3xl flex-col gap-8 py-2 sm:py-4'
    : 'mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:py-10';

  return (
    <div className={shellClass}>
      {!embedded ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <SortableLogoLink />
              <Link
                to="/"
                className="text-sm text-sortable-text-secondary hover:underline"
              >
                ← Home
              </Link>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-3xl font-semibold sm:text-4xl">
              {list?.title || 'Results'}
            </h1>
            {list?.description ? (
              <p className="text-sortable-text-secondary">{list.description}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Link to={compareHref}>
          <Button>{compareLabel}</Button>
        </Link>
        <Button type="button" variant="secondary" onClick={() => copyShareUrl(key)}>
          Share link
        </Button>
      </div>

      {isAuthenticated && (showPersonal || showAggregate || otherParticipants.length > 0) ? (
        <div className="flex flex-wrap gap-2 border-b border-white/10 pb-2">
          <button
            type="button"
            className={[
              'rounded-xl px-4 py-2 text-sm font-medium transition-colors duration-200 ease-smooth',
              effectiveTab === TAB_MINE
                ? 'bg-white/10 text-sortable-text-primary'
                : 'text-sortable-text-secondary hover:bg-white/5 hover:text-sortable-text-primary',
            ].join(' ')}
            onClick={() => setActiveTab(TAB_MINE)}
          >
            My results
          </button>
          <button
            type="button"
            className={[
              'rounded-xl px-4 py-2 text-sm font-medium transition-colors duration-200 ease-smooth',
              effectiveTab === TAB_OTHER
                ? 'bg-white/10 text-sortable-text-primary'
                : 'text-sortable-text-secondary hover:bg-white/5 hover:text-sortable-text-primary',
            ].join(' ')}
            onClick={() => setActiveTab(TAB_OTHER)}
          >
            Someone else
          </button>
          <button
            type="button"
            className={[
              'rounded-xl px-4 py-2 text-sm font-medium transition-colors duration-200 ease-smooth',
              effectiveTab === TAB_AGGREGATE
                ? 'bg-white/10 text-sortable-text-primary'
                : 'text-sortable-text-secondary hover:bg-white/5 hover:text-sortable-text-primary',
            ].join(' ')}
            onClick={() => setActiveTab(TAB_AGGREGATE)}
          >
            Aggregate
          </button>
        </div>
      ) : null}

      {!isAuthenticated && !showAggregate ? (
        <EmptyState
          title="No comparisons yet"
          description="Pick a few matchups to start building the ranking."
          action={
            <Link to={rankEntryPath}>
              <Button>Start comparing</Button>
            </Link>
          }
        />
      ) : null}

      {isAuthenticated && effectiveTab === TAB_MINE ? (
        showPersonal ? (
          <section className="flex flex-col gap-3">
            <h2 className="font-display text-xl font-semibold">My ranking</h2>
            <RankedList items={personal} revealOnMount={revealOnMount} />
          </section>
        ) : (
          <EmptyState
            title="You have not ranked this list yet"
            description="Start comparing items to build your personal ranking."
            action={
              <Link to={compareHref}>
                <Button>{compareLabel}</Button>
              </Link>
            }
          />
        )
      ) : null}

      {isAuthenticated && effectiveTab === TAB_OTHER ? (
        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-display text-xl font-semibold">Their ranking</h2>
            {otherParticipants.length > 0 ? (
              <div className="flex w-full min-w-0 max-w-xs flex-col gap-1 text-xs text-sortable-text-secondary sm:w-auto sm:max-w-sm">
                <span className="sr-only">Participant</span>
                <SortableSelect
                  ariaLabel="Participant"
                  value={otherUserId != null ? String(otherUserId) : participantOptions[0]?.value ?? ''}
                  onChange={(v) => setOtherUserId(Number(v))}
                  options={participantOptions}
                />
              </div>
            ) : null}
          </div>
          {otherParticipants.length === 0 ? (
            <EmptyState title="No one else yet" description="Share the list so others can add their rankings." />
          ) : otherLoading ? (
            <Loading label="Loading" />
          ) : otherError ? (
            <p className="text-sortable-danger">{otherError}</p>
          ) : otherItems?.length ? (
            <RankedList items={otherItems} />
          ) : (
            <EmptyState title="No ranking for this participant" />
          )}
        </section>
      ) : null}

      {(!isAuthenticated || effectiveTab === TAB_AGGREGATE) && showAggregate ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-semibold">Aggregate</h2>
          <RankedList
            items={aggregate}
            revealOnMount={!isAuthenticated ? revealOnMount : false}
            renderTrailing={(item) => (
              <span className="ml-auto text-xs text-sortable-text-secondary">
                {Math.round(item.elo_rating)}
              </span>
            )}
          />
        </section>
      ) : null}

      {isAuthenticated && !showPersonal && !showAggregate && !otherParticipants.length ? (
        <EmptyState
          title="No comparisons yet"
          description="Pick a few matchups to start building the ranking."
          action={
            <Link to={compareHref}>
              <Button>{compareLabel}</Button>
            </Link>
          }
        />
      ) : null}
    </div>
  );
}

export default ListResultsPanel;
