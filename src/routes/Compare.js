import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import toast from 'react-hot-toast';

import ChoiceCard from '../components/ui/ChoiceCard';
import Button from '../components/ui/Button';
import ConfirmModal from '../components/ui/ConfirmModal';
import Loading from '../components/Loading/Loading';
import {
  fetchNextPair,
  recordComparison,
  resetMyRanking,
  excludeItemFromRanking,
} from '../helpers/comparisonHelpers';
import SortableLogoLink from '../components/ui/SortableLogoLink';
import { fetchListById } from '../helpers/listHelpers';
import { listRoutePath } from '../helpers/listRoutePaths';
import { setList, setPair } from '../store/lists.reducer';
import { useNative } from '../hooks/useNative';

const SELECT_FLASH_MS = 150;

const RESET_RANKING_WARNING =
  'Once you erase this data, it cannot be recovered. Your comparisons, removals for this list, and personal ranking will be permanently cleared.';

async function maybeHaptic(isNative) {
  if (!isNative) return;
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // haptics optional
  }
}

/**
 * Pairwise ranking UI under `/list/:id` (Choose tab).
 * @param {{ listId: number; embedded?: boolean; onRankingComplete?: () => void; onAfterReset?: () => void; refreshEpoch?: number }} props
 */
export function ComparePanel({
  listId,
  embedded = false,
  onRankingComplete,
  onAfterReset,
  refreshEpoch = 0,
}) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const native = useNative();

  const [pair, setLocalPair] = useState(null);
  const [list, setLocalList] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSide, setSelectedSide] = useState(null);
  const [excludeBusy, setExcludeBusy] = useState(false);
  const inFlightRef = useRef(false);

  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);

  const onDoneRef = useRef(onRankingComplete);
  useEffect(() => {
    onDoneRef.current = onRankingComplete;
  }, [onRankingComplete]);

  const onAfterResetRef = useRef(onAfterReset);
  useEffect(() => {
    onAfterResetRef.current = onAfterReset;
  }, [onAfterReset]);

  useEffect(() => {
    setResetConfirmOpen(searchParams.get('reset') === '1');
  }, [searchParams]);

  const stripResetFromUrl = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('reset');
        return next;
      },
      { replace: true }
    );
  }, [setSearchParams]);

  const loadPair = useCallback(async () => {
    const p = await fetchNextPair(listId);
    setLocalPair(p);
    dispatch(setPair({ listId, pair: p }));
    return p;
  }, [listId, dispatch]);

  const confirmResetFromModal = useCallback(async () => {
    setResetBusy(true);
    try {
      await resetMyRanking(listId);
      toast.success('Ranking reset — choose again from the top.');
      onAfterResetRef.current?.();
      stripResetFromUrl();
      setResetConfirmOpen(false);
      await loadPair();
    } catch (err) {
      toast.error(err.message || 'Could not reset ranking');
      stripResetFromUrl();
      setResetConfirmOpen(false);
    } finally {
      setResetBusy(false);
    }
  }, [listId, loadPair, stripResetFromUrl]);

  const cancelResetModal = useCallback(() => {
    stripResetFromUrl();
    setResetConfirmOpen(false);
  }, [stripResetFromUrl]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const detail = await fetchListById(listId);
        if (!active) return;
        setLocalList(detail.list);
        dispatch(setList(detail));
        const p = await loadPair();
        if (!active) return;
        if (p.done) {
          if (embedded) {
            setLocalPair(p);
            onDoneRef.current?.();
          } else {
            navigate(listRoutePath(listId), { replace: true });
          }
          return;
        }
      } catch (e) {
        if (active) setError(e.message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [listId, dispatch, loadPair, navigate, embedded, refreshEpoch]);

  const excludeLabel =
    list?.exclude_choice_label && String(list.exclude_choice_label).trim()
      ? String(list.exclude_choice_label).trim()
      : 'Remove';

  const excludeOption = useCallback(
    async (item) => {
      if (!pair || pair.done || item == null || selectedSide !== null || excludeBusy || resetConfirmOpen)
        return;

      setExcludeBusy(true);
      try {
        const next = await excludeItemFromRanking(listId, item.item_id);

        setLocalPair(next);
        dispatch(setPair({ listId, pair: next }));

        if (next.done) {
          if (embedded) {
            onDoneRef.current?.();
          } else {
            navigate(listRoutePath(listId), { replace: true });
          }
        }
      } catch (e) {
        toast.error(e.message || 'Could not update your list');
        if (e.status === 409) {
          loadPair().catch(() => {});
        }
      } finally {
        setExcludeBusy(false);
      }
    },
    [
      pair,
      listId,
      dispatch,
      selectedSide,
      excludeBusy,
      resetConfirmOpen,
      loadPair,
      embedded,
      navigate,
    ]
  );

  const choose = useCallback(
    async (side) => {
      if (!pair || pair.done || inFlightRef.current || resetConfirmOpen || excludeBusy) return;
      inFlightRef.current = true;
      setSelectedSide(side);

      const winner = side === 'a' ? pair.a : pair.b;
      const loser = side === 'a' ? pair.b : pair.a;

      maybeHaptic(native.isNative);

      try {
        const next = await recordComparison(listId, {
          winnerId: winner.item_id,
          loserId: loser.item_id,
        });

        setTimeout(() => {
          if (next.done) {
            if (embedded) {
              setLocalPair(next);
              onDoneRef.current?.();
              inFlightRef.current = false;
              return;
            }
            navigate(listRoutePath(listId), { replace: true });
            return;
          }
          setLocalPair(next);
          dispatch(setPair({ listId, pair: next }));
          setSelectedSide(null);
          inFlightRef.current = false;
        }, SELECT_FLASH_MS);
      } catch (e) {
        toast.error(e.message || 'Could not record comparison');
        setSelectedSide(null);
        inFlightRef.current = false;
        if (e.status === 409) {
          loadPair().catch(() => {});
        }
      }
    },
    [pair, listId, dispatch, navigate, native.isNative, loadPair, embedded, resetConfirmOpen, excludeBusy]
  );

  useEffect(() => {
    function onKey(e) {
      if (resetConfirmOpen) return;
      if (e.key === 'ArrowLeft' || e.key === '1') choose('a');
      else if (e.key === 'ArrowRight' || e.key === '2') choose('b');
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [choose, resetConfirmOpen]);

  let body = null;

  if (loading) {
    body = <Loading label="Loading list" />;
  } else if (error) {
    body = (
      <div className="mx-auto max-w-md p-10 text-center">
        <p className="text-sortable-danger">{error}</p>
        <Link to="/" className="mt-4 inline-block text-sm text-sortable-highlight">
          Back home
        </Link>
      </div>
    );
  } else if ((!pair || pair.done) && embedded) {
    body = null;
  } else if (!pair || pair.done) {
    body = <Loading label="Wrapping up" />;
  } else {
    const total = pair.total || 0;
    const placed = pair.placedCount || 0;
    const progressPct = total ? Math.round((placed / total) * 100) : 0;

    const shellClass = embedded
      ? 'mx-auto flex w-full max-w-5xl flex-col gap-6 py-2 sm:py-4'
      : 'mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:py-10';

    body = (
      <div className={shellClass}>
        {!embedded ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <SortableLogoLink />
              <Link to="/" className="text-sm text-sortable-text-secondary hover:underline">
                ← Home
              </Link>
            </div>
            <span className="text-sm text-sortable-text-secondary">
              {placed} / {total} placed
            </span>
          </div>
        ) : (
          <div className="flex justify-end">
            <span className="text-sm text-sortable-text-secondary">
              {placed} / {total} placed
            </span>
          </div>
        )}
        <div className="flex flex-col gap-3">
          {!embedded ? (
            <>
              <h2 className="font-display text-2xl font-semibold sm:text-3xl">{list?.title || 'Pick one'}</h2>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-sortable-gradient transition-[width] duration-300 ease-smooth"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </>
          ) : (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-sortable-gradient transition-[width] duration-300 ease-smooth"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:gap-6">
          <ChoiceCard
            item={pair.a}
            selected={selectedSide === 'a'}
            disabled={selectedSide !== null}
            excludeLabel={excludeLabel}
            onExclude={excludeOption}
            excludeDisabled={excludeBusy}
            onSelect={() => choose('a')}
          />
          <ChoiceCard
            item={pair.b}
            selected={selectedSide === 'b'}
            disabled={selectedSide !== null}
            excludeLabel={excludeLabel}
            onExclude={excludeOption}
            excludeDisabled={excludeBusy}
            onSelect={() => choose('b')}
          />
        </div>

        <p className="text-center text-xs text-sortable-text-secondary">
          Tip: use ← and → on the keyboard.
        </p>

        {!embedded ? (
          <div className="flex justify-center pt-2">
            <Link to={listRoutePath(listId)}>
              <Button variant="ghost">Back to list</Button>
            </Link>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <>
      {body}
      <ConfirmModal
        open={resetConfirmOpen}
        onClose={cancelResetModal}
        onConfirm={confirmResetFromModal}
        title="Reset your choices?"
        description={RESET_RANKING_WARNING}
        confirmLabel="Reset anyway"
        busy={resetBusy}
      />
    </>
  );
}

export default ComparePanel;
