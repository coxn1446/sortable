import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';

import { selectUser } from '../store/auth.reducer';
import { setMyLists } from '../store/lists.reducer';
import { fetchMyLists } from '../helpers/listHelpers';
import { listRoutePath } from '../helpers/listRoutePaths';
import Button from '../components/ui/Button';
import { IconCreate } from '../components/icons/SortableIcons';
import EmptyState from '../components/ui/EmptyState';
import Loading from '../components/Loading/Loading';
import ListPreviewCard from '../components/lists/ListPreviewCard';

function filterLists(lists, userId, query, ownsOnly, rankFilter) {
  let out = [...lists];
  const q = query.trim().toLowerCase();
  if (q) {
    out = out.filter((l) => {
      const title = (l.title || '').toLowerCase();
      const desc = (l.description || '').toLowerCase();
      return title.includes(q) || desc.includes(q);
    });
  }
  if (ownsOnly && userId != null) {
    out = out.filter((l) => Number(l.owner_user_id) === Number(userId));
  }
  if (rankFilter === 'completed') {
    out = out.filter((l) => l.my_rank_complete === true);
  } else if (rankFilter === 'in_progress') {
    out = out.filter((l) => !l.my_rank_complete);
  }
  return out;
}

function sortLists(lists, sortByCreated) {
  const key = sortByCreated ? 'created_at' : 'updated_at';
  return [...lists].sort((a, b) => {
    const ta = new Date(a[key]).getTime();
    const tb = new Date(b[key]).getTime();
    return tb - ta;
  });
}

const chipBase =
  'rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors duration-200 ease-smooth';

function FilterChip({ active, children, onClick, ariaPressed }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ariaPressed}
      className={[
        chipBase,
        active
          ? 'border-sortable-highlight bg-white/10 text-sortable-text-primary'
          : 'border-white/10 bg-sortable-card text-sortable-text-secondary hover:border-white/20 hover:text-sortable-text-primary',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

export default function ListsPage() {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const viewerId = user?.user_id ?? null;

  const [rawLists, setRawLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [ownsOnly, setOwnsOnly] = useState(false);
  const [rankFilter, setRankFilter] = useState('all');
  const [sortByDateMade, setSortByDateMade] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const lists = await fetchMyLists();
        if (!active) return;
        dispatch(setMyLists(lists));
        setRawLists(lists);
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

  const displayed = useMemo(() => {
    const filtered = filterLists(rawLists, viewerId, search, ownsOnly, rankFilter);
    return sortLists(filtered, sortByDateMade);
  }, [rawLists, viewerId, search, ownsOnly, rankFilter, sortByDateMade]);

  const toggleRank = (next) => {
    setRankFilter((prev) => (prev === next ? 'all' : next));
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10 sm:py-14">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-sortable-text-primary">Lists</h1>
          <p className="mt-1 text-sm text-sortable-text-secondary">
            Lists you own or participate in.
          </p>
        </div>
        <Link to="/lists/new" className="shrink-0 sm:mt-1">
          <Button>
            <IconCreate className="h-5 w-5 shrink-0 text-white" />
            New list
          </Button>
        </Link>
      </header>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-sortable-text-secondary">Search</span>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title or description…"
          className="rounded-xl border border-white/10 bg-sortable-surface px-3 py-2 text-sm text-sortable-text-primary placeholder:text-sortable-text-secondary focus:border-sortable-highlight focus:outline-none focus:ring-1 focus:ring-sortable-highlight"
          autoComplete="off"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <FilterChip
          active={ownsOnly}
          ariaPressed={ownsOnly}
          onClick={() => setOwnsOnly((v) => !v)}
        >
          Lists I Own
        </FilterChip>
        <FilterChip
          active={rankFilter === 'completed'}
          ariaPressed={rankFilter === 'completed'}
          onClick={() => toggleRank('completed')}
        >
          Completed
        </FilterChip>
        <FilterChip
          active={rankFilter === 'in_progress'}
          ariaPressed={rankFilter === 'in_progress'}
          onClick={() => toggleRank('in_progress')}
        >
          In Progress
        </FilterChip>
        <FilterChip
          active={sortByDateMade}
          ariaPressed={sortByDateMade}
          onClick={() => setSortByDateMade((v) => !v)}
        >
          Date Made
        </FilterChip>
      </div>
      <p className="text-xs text-sortable-text-secondary">
        {sortByDateMade
          ? 'Sorted by date created (newest first). Turn off Date Made to sort by last updated.'
          : 'Sorted by last updated (newest first). Turn on Date Made to sort by when each list was created.'}
      </p>

      {loading ? (
        <Loading />
      ) : error ? (
        <p className="text-sm text-sortable-danger">{error}</p>
      ) : rawLists.length === 0 ? (
        <EmptyState
          title="No lists yet"
          description="Create a list or accept an invite to collaborate."
          action={
            <Link to="/lists/new">
              <Button>
                <IconCreate className="h-5 w-5 shrink-0 text-white" />
                Create a list
              </Button>
            </Link>
          }
        />
      ) : displayed.length === 0 ? (
        <EmptyState
          title="No matches"
          description="Try changing search or filters."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {displayed.map((list) => (
            <ListPreviewCard
              key={list.list_id}
              list={list}
              ctaLabel="View"
              ctaTo={listRoutePath(String(list.list_id))}
              viewerUserId={viewerId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
