import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Link,
  Navigate,
  NavLink,
  useLocation,
  useParams,
  useRoutes,
} from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';

import Button from '../components/ui/Button';
import { IconSettings } from '../components/icons/SortableIcons';
import Loading from '../components/Loading/Loading';
import { fetchListByKey } from '../helpers/listHelpers';
import { listRoutePath } from '../helpers/listRoutePaths';
import { fetchRanking } from '../helpers/rankingHelpers';
import { copyTextToClipboard } from '../helpers/clipboardHelpers';
import { setList } from '../store/lists.reducer';
import {
  selectAuthLoading,
  selectIsAuthenticated,
  selectUser,
} from '../store/auth.reducer';
import { ListPageContext } from './listPageContext';
import { ListChooseTab, ListResultsTab, ListSettingsTab } from './ListPage.tabs';

function listSubNavLinkClass({ isActive }) {
  return [
    'rounded-xl px-4 py-2 text-sm font-medium transition-colors duration-200 ease-smooth',
    isActive
      ? 'bg-white/10 text-sortable-text-primary'
      : 'text-sortable-text-secondary hover:bg-white/5 hover:text-sortable-text-primary',
  ].join(' ');
}

async function copyListPublicUrl(listId) {
  const path = listRoutePath(listId);
  const url = `${window.location.origin}${path}`;
  try {
    await copyTextToClipboard(url);
    toast.success('Link copied');
  } catch {
    toast.error('Could not copy link');
  }
}

/** Unknown nested path → canonical `/list/:listKey` (preserves slug segment until numeric redirect runs). */
function ListCatchAllRedirect() {
  const { listKey } = useParams();
  const enc = encodeURIComponent(String(listKey ?? '').trim());
  return <Navigate to={`/list/${enc}`} replace />;
}

export default function ListPage() {
  const { listKey: listKeyParam } = useParams();
  const location = useLocation();
  const dispatch = useDispatch();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const authLoading = useSelector(selectAuthLoading);
  const currentUser = useSelector(selectUser);

  const rawSegment = useMemo(
    () => decodeURIComponent(String(listKeyParam ?? '').trim()),
    [listKeyParam]
  );

  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState(null);
  const [detail, setDetail] = useState(null);

  const [rankingTick, setRankingTick] = useState(0);
  const bumpRanking = useCallback(() => {
    setRankingTick((t) => t + 1);
  }, []);

  const [rankingLoading, setRankingLoading] = useState(true);
  const [ranking, setRanking] = useState(null);
  const [rankingFetchError, setRankingFetchError] = useState(null);

  const [newItemLabel, setNewItemLabel] = useState('');
  const [addItemBusy, setAddItemBusy] = useState(false);

  useEffect(() => {
    if (!rawSegment) return undefined;
    let active = true;
    (async () => {
      try {
        setLoadingList(true);
        setListError(null);
        const d = await fetchListByKey(rawSegment);
        if (!active) return;
        dispatch(setList(d));
        setDetail(d);
        setRankingTick(0);
      } catch (e) {
        if (active) setListError(e.message || 'Could not load list.');
      } finally {
        if (active) setLoadingList(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [rawSegment, dispatch]);

  const list = detail?.list;
  const items = detail?.items || [];
  const listId = list?.list_id;

  const refreshListDetail = useCallback(async () => {
    if (list == null) return;
    const d = await fetchListByKey(String(list.list_id));
    dispatch(setList(d));
    setDetail(d);
  }, [list, dispatch]);

  useEffect(() => {
    if (listId == null) return undefined;
    let active = true;
    const spinner = rankingTick === 0;
    (async () => {
      try {
        if (spinner) {
          setRankingLoading(true);
        }
        setRankingFetchError(null);
        const r = await fetchRanking(listId);
        if (active) setRanking(r);
      } catch (e) {
        if (active) {
          setRankingFetchError(e.message || 'Could not load ranking.');
          setRanking(null);
        }
      } finally {
        if (active && spinner) {
          setRankingLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [listId, rankingTick]);

  const isOwner =
    isAuthenticated &&
    currentUser != null &&
    list != null &&
    Number(list.owner_user_id) === Number(currentUser.user_id);

  const rankingReady = ranking != null && !rankingFetchError && !rankingLoading;

  const loginNext = encodeURIComponent(`${location.pathname}${location.search || ''}`);

  const ctxValue = useMemo(
    () => ({
      list,
      items,
      listId,
      ranking,
      rankingLoading,
      rankingFetchError,
      rankingReady,
      bumpRanking,
      rankingTick,
      isAuthenticated,
      authLoading,
      isOwner,
      currentUser,
      loginNext,
      refreshListDetail,
      newItemLabel,
      setNewItemLabel,
      addItemBusy,
      setAddItemBusy,
    }),
    [
      list,
      items,
      listId,
      ranking,
      rankingLoading,
      rankingFetchError,
      rankingReady,
      bumpRanking,
      rankingTick,
      isAuthenticated,
      authLoading,
      isOwner,
      currentUser,
      loginNext,
      refreshListDetail,
      newItemLabel,
      addItemBusy,
    ]
  );

  const routeElement = useRoutes([
    { index: true, element: <ListChooseTab /> },
    { path: 'results', element: <ListResultsTab /> },
    { path: 'settings', element: <ListSettingsTab /> },
    { path: '*', element: <ListCatchAllRedirect /> },
  ]);

  if (!loadingList && list && rawSegment !== String(list.list_id)) {
    const suffix = location.search || '';
    const tailMatch = location.pathname.match(/^\/list\/[^/]+(\/.*)?$/);
    const tail = tailMatch?.[1] ?? '';
    return <Navigate to={`/list/${list.list_id}${tail}${suffix}`} replace />;
  }

  if (loadingList) return <Loading label="Loading list" />;
  if (listError || !list) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <p className="text-sortable-danger">{listError || 'List not found.'}</p>
        <Link to="/" className="mt-4 inline-block text-sm text-sortable-highlight">
          Back home
        </Link>
      </div>
    );
  }

  return (
    <ListPageContext.Provider value={ctxValue}>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:py-10">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <h1 className="font-display text-3xl font-semibold sm:text-4xl">{list.title}</h1>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="shrink-0"
                onClick={() => copyListPublicUrl(list.list_id)}
              >
                Share
              </Button>
            </div>
            {list.description ? (
              <p className="text-sortable-text-secondary">{list.description}</p>
            ) : null}
          </div>
        </header>

        <nav
          className="flex flex-wrap gap-2 border-b border-white/10 pb-2"
          aria-label="List sections"
        >
          <NavLink end className={listSubNavLinkClass} to={listRoutePath(list.list_id)}>
            Choose
          </NavLink>
          <NavLink className={listSubNavLinkClass} to={listRoutePath(list.list_id, { tab: 'results' })}>
            Results
          </NavLink>
          {isOwner ? (
            <NavLink className={listSubNavLinkClass} to={listRoutePath(list.list_id, { tab: 'settings' })}>
              <span className="inline-flex items-center gap-2">
                <IconSettings className="h-4 w-4 shrink-0" />
                Settings
              </span>
            </NavLink>
          ) : null}
        </nav>

        {routeElement}
      </div>
    </ListPageContext.Provider>
  );
}
