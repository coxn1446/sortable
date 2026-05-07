import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Navigate, NavLink, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import toast from 'react-hot-toast';

import Button from '../components/ui/Button';
import ConfirmModal from '../components/ui/ConfirmModal';
import SortableSelect from '../components/ui/SortableSelect';
import Card from '../components/ui/Card';
import ParticipantSelectOption from '../components/lists/ParticipantSelectOption';
import Loading from '../components/Loading/Loading';
import RankedList from '../components/ui/RankedList';
import EmptyState from '../components/ui/EmptyState';
import { IconCreate, IconMedia, IconTrash } from '../components/icons/SortableIcons';
import {
  addItem as addItemToList,
  deleteList as deleteListApi,
  patchItem,
  removeItem,
  updateList,
} from '../helpers/listHelpers';
import { uploadPublicImage } from '../helpers/uploadHelpers';
import { listRoutePath } from '../helpers/listRoutePaths';
import { removeList } from '../store/lists.reducer';
import { fetchRanking } from '../helpers/rankingHelpers';
import { resetMyRanking } from '../helpers/comparisonHelpers';
import { ComparePanel } from './Compare';
import { useListPageContext } from './listPageContext';

const P_AGG = 'aggregate';
const OTHER_PREFIX = 'other:';

const settingsFieldClass =
  'rounded-xl border border-white/10 bg-sortable-surface px-3 py-2 text-sm text-sortable-text-primary placeholder:text-sortable-text-secondary focus:border-sortable-highlight focus:outline-none focus:ring-1 focus:ring-sortable-highlight';

const optionRowClass =
  'flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-sortable-surface px-3 py-2';

const settingsOptionRowClass =
  'flex items-center gap-2 rounded-xl border border-white/10 bg-sortable-surface px-3 py-2 sm:gap-3';

const optionIconBtnClass =
  'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-sortable-bg transition-colors hover:border-white/20 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sortable-highlight disabled:pointer-events-none disabled:opacity-40';

const DEFAULT_EXCLUDE_BUTTON_LABEL = 'Remove';

const RESET_CHOICES_WARNING =
  'Once you erase this data, it cannot be recovered. Your comparisons, removals for this list, and personal ranking will be permanently cleared.';

/** Same gradient CTA as Nav guest Sign up; inline so surrounding sentence stays plain text. */
const listGuestSignInCtaClass =
  'mr-3 inline-flex items-center justify-center align-middle rounded-xl bg-sortable-gradient px-3 py-2.5 text-sm font-medium text-white shadow-glow transition-transform duration-200 ease-smooth hover:scale-102 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sortable-highlight';

export function ListChooseTab() {
  const {
    list,
    items,
    listId,
    ranking,
    rankingReady,
    rankingFetchError,
    bumpRanking,
    rankingTick,
    isAuthenticated,
    authLoading,
    loginNext,
    isOwner,
  } = useListPageContext();

  const [resetChoicesOpen, setResetChoicesOpen] = useState(false);
  const [resetChoicesBusy, setResetChoicesBusy] = useState(false);

  const showCompareUi =
    isAuthenticated &&
    !authLoading &&
    rankingReady &&
    items.length >= 2 &&
    ranking &&
    !ranking.is_finalized;

  const finishedRanking =
    isAuthenticated && rankingReady && ranking?.is_finalized && items.length >= 2;

  const handleConfirmResetChoices = async () => {
    setResetChoicesBusy(true);
    try {
      await resetMyRanking(listId);
      toast.success('Choices cleared — you can rank again from the top.');
      setResetChoicesOpen(false);
      bumpRanking();
    } catch (err) {
      toast.error(err.message || 'Could not reset choices.');
    } finally {
      setResetChoicesBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {rankingFetchError ? (
        <p className="text-sm text-sortable-danger">{rankingFetchError}</p>
      ) : null}

      {items.length < 2 ? (
        <EmptyState
          title="Add more options"
          description="A list needs at least two items before anyone can compare."
          action={
            isOwner ? (
              <NavLink to={listRoutePath(listId, { tab: 'settings' })}>
                <Button size="sm">Open Settings</Button>
              </NavLink>
            ) : (
              <span className="text-sm text-sortable-text-secondary">
                Ask the list owner to add options.
              </span>
            )
          }
        />
      ) : null}

      {!isAuthenticated && items.length >= 2 ? (
        <Card className="p-5">
          <p className="text-sm text-sortable-text-secondary">
            <NavLink
              to={`/login?next=${loginNext}`}
              className={listGuestSignInCtaClass}
              end={false}
            >
              Sign In
            </NavLink>
            <span>to build your ranking on this list.</span>
          </p>
        </Card>
      ) : null}

      {finishedRanking ? (
        <Card className="p-5">
          <p className="font-medium text-sortable-text-primary">You&apos;re done with your choices for now.</p>
          <p className="mt-1 text-sm text-sortable-text-secondary">
            View how everything stacks up, or clear your picks and start over.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <NavLink to={listRoutePath(listId, { tab: 'results' })}>
              <Button type="button">View Results</Button>
            </NavLink>
            <Button type="button" variant="secondary" onClick={() => setResetChoicesOpen(true)}>
              Reset Choices
            </Button>
          </div>
        </Card>
      ) : null}

      <ConfirmModal
        open={resetChoicesOpen}
        onClose={() => setResetChoicesOpen(false)}
        onConfirm={handleConfirmResetChoices}
        title="Reset your choices?"
        description={RESET_CHOICES_WARNING}
        confirmLabel="Reset anyway"
        busy={resetChoicesBusy}
      />

      {showCompareUi ? (
        <section id="compare" className="scroll-mt-6">
          <h2 className="sr-only">Compare choices</h2>
          <ComparePanel
            listId={list.list_id}
            embedded
            refreshEpoch={rankingTick}
            onRankingComplete={bumpRanking}
            onAfterReset={bumpRanking}
          />
        </section>
      ) : null}
    </div>
  );
}

export function ListResultsTab() {
  const {
    listId,
    ranking,
    rankingLoading,
    rankingFetchError,
    isAuthenticated,
    loginNext,
    currentUser,
  } = useListPageContext();

  const [perspective, setPerspective] = useState(P_AGG);
  const [otherItems, setOtherItems] = useState(null);
  const [otherLoading, setOtherLoading] = useState(false);

  const participants = ranking?.participants || [];
  const otherParticipants = useMemo(
    () =>
      participants.filter(
        (p) =>
          currentUser == null || Number(p.user_id) !== Number(currentUser.user_id)
      ),
    [participants, currentUser]
  );

  useEffect(() => {
    setPerspective(isAuthenticated ? 'mine' : P_AGG);
  }, [listId, isAuthenticated]);

  const otherUserIdParsed = perspective.startsWith(OTHER_PREFIX)
    ? Number(perspective.slice(OTHER_PREFIX.length))
    : null;

  useEffect(() => {
    if (otherUserIdParsed == null || !Number.isInteger(otherUserIdParsed)) {
      setOtherItems(null);
      setOtherLoading(false);
      return undefined;
    }
    if (!isAuthenticated) {
      setOtherItems(null);
      return undefined;
    }
    let active = true;
    (async () => {
      try {
        setOtherLoading(true);
        const data = await fetchRanking(listId, { viewUserId: otherUserIdParsed });
        if (!active) return;
        setOtherItems(data.viewed_personal || null);
      } catch {
        if (active) setOtherItems(null);
      } finally {
        if (active) setOtherLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [listId, otherUserIdParsed, isAuthenticated, perspective]);

  const aggregate = ranking?.aggregate || [];
  const personal = ranking?.personal || [];

  const rankingViewLabelId = useId();
  const rankingViewOptions = useMemo(() => {
    const opts = [{ value: P_AGG, label: 'Aggregate' }];
    if (isAuthenticated) opts.push({ value: 'mine', label: 'Mine' });
    if (isAuthenticated && otherParticipants.length > 0) {
      otherParticipants.forEach((p) => {
        opts.push({
          value: `${OTHER_PREFIX}${p.user_id}`,
          label: (
            <ParticipantSelectOption
              userId={p.user_id}
              username={p.username}
              profilePicture={p.profile_picture}
            />
          ),
          optionAriaLabel: p.username,
        });
      });
    }
    return opts;
  }, [isAuthenticated, otherParticipants]);

  useEffect(() => {
    if (rankingViewOptions.some((o) => o.value === perspective)) return;
    setPerspective(rankingViewOptions[0]?.value ?? P_AGG);
  }, [rankingViewOptions, perspective]);

  return (
    <div className="flex flex-col gap-4">
      {rankingFetchError ? (
        <p className="text-sm text-sortable-danger">{rankingFetchError}</p>
      ) : null}

      <section className="flex flex-col gap-4">
        <div className="flex max-w-xl flex-col gap-2 text-sm text-sortable-text-secondary">
          <span id={rankingViewLabelId} className="font-medium text-sortable-text-primary">
            Ranking view
          </span>
          <SortableSelect
            ariaLabelledBy={rankingViewLabelId}
            value={perspective}
            onChange={setPerspective}
            options={rankingViewOptions}
          />
        </div>

        {rankingLoading ? (
          <Loading label="Ranking" />
        ) : perspective === P_AGG ? (
          aggregate.length > 0 ? (
            <RankedList
              items={aggregate}
              revealOnMount
              renderTrailing={(item) =>
                typeof item.elo_rating === 'number' ? (
                  <span className="ml-auto text-xs text-sortable-text-secondary">
                    {Math.round(item.elo_rating)}
                  </span>
                ) : null
              }
            />
          ) : (
            <EmptyState title="No aggregate ranking yet" description="Votes will appear once people compare." />
          )
        ) : perspective === 'mine' ? (
          !isAuthenticated ? (
            <EmptyState
              title="Sign in required"
              description="Sign in to see your personal ranking."
              action={
                <p className="text-sm text-sortable-text-secondary">
                  <NavLink
                    to={`/login?next=${loginNext}`}
                    className={listGuestSignInCtaClass}
                    end={false}
                  >
                    Sign In
                  </NavLink>
                  <span>to see your personal ranking.</span>
                </p>
              }
            />
          ) : personal.length ? (
            <RankedList items={personal} revealOnMount />
          ) : (
            <EmptyState title="No personal ranking yet" description="Pick choices on the Choose tab to start." />
          )
        ) : otherLoading ? (
          <Loading label="Ranking" />
        ) : otherItems?.length ? (
          <RankedList items={otherItems} />
        ) : (
          <EmptyState title="No ranking loaded" />
        )}
      </section>
    </div>
  );
}

export function ListSettingsTab() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const {
    list,
    items,
    listId,
    bumpRanking,
    refreshListDetail,
    isOwner,
    newItemLabel,
    setNewItemLabel,
    addItemBusy,
    setAddItemBusy,
  } = useListPageContext();

  const [titleEdit, setTitleEdit] = useState('');
  const [descriptionEdit, setDescriptionEdit] = useState('');
  const [excludeChoiceEdit, setExcludeChoiceEdit] = useState('');
  const [isPublicEdit, setIsPublicEdit] = useState(false);
  const [saveDetailsBusy, setSaveDetailsBusy] = useState(false);
  const [removingItemId, setRemovingItemId] = useState(null);
  const [deleteListBusy, setDeleteListBusy] = useState(false);

  const fileInputRef = useRef(null);
  const mediaPickItemIdRef = useRef(null);
  const [uploadingItemId, setUploadingItemId] = useState(null);

  useEffect(() => {
    setTitleEdit(list.title || '');
    setDescriptionEdit(list.description || '');
    setExcludeChoiceEdit(list.exclude_choice_label?.trim() || DEFAULT_EXCLUDE_BUTTON_LABEL);
    setIsPublicEdit(!!list.is_public);
  }, [list.list_id, list.title, list.description, list.is_public, list.exclude_choice_label]);

  const handleOptionPhotoFileChange = async (ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = '';
    const itemId = mediaPickItemIdRef.current;
    mediaPickItemIdRef.current = null;
    if (!file || itemId == null || listId == null) return;
    setUploadingItemId(itemId);
    try {
      const url = await uploadPublicImage(file);
      await patchItem(listId, itemId, { image_url: url });
      toast.success('Photo updated');
      await refreshListDetail();
      bumpRanking();
    } catch (err) {
      toast.error(err.message || 'Could not upload photo.');
    } finally {
      setUploadingItemId(null);
    }
  };

  const startOptionPhotoPick = (itemId) => {
    mediaPickItemIdRef.current = itemId;
    fileInputRef.current?.click();
  };

  const handleOptionPhotoPreviewClick = async (item) => {
    if (!item.image_url || listId == null) return;
    if (
      !window.confirm(
        'Remove this photo from this option? The option stays on the list.'
      )
    ) {
      return;
    }
    setUploadingItemId(item.item_id);
    try {
      await patchItem(listId, item.item_id, { image_url: null });
      toast.success('Photo removed');
      await refreshListDetail();
      bumpRanking();
    } catch (err) {
      toast.error(err.message || 'Could not remove photo.');
    } finally {
      setUploadingItemId(null);
    }
  };

  const handleSaveDetails = async (e) => {
    e.preventDefault();
    const title = titleEdit.trim();
    if (title.length < 1) {
      toast.error('Title is required.');
      return;
    }
    setSaveDetailsBusy(true);
    try {
      const excludeTrim = excludeChoiceEdit.trim();
      const excludeForApi =
        excludeTrim === '' || excludeTrim === DEFAULT_EXCLUDE_BUTTON_LABEL ? null : excludeTrim;

      await updateList(listId, {
        title,
        description: descriptionEdit.trim() ? descriptionEdit.trim() : null,
        is_public: isPublicEdit,
        exclude_choice_label: excludeForApi,
      });
      toast.success('Details saved');
      await refreshListDetail();
    } catch (err) {
      toast.error(err.message || 'Could not save details.');
    } finally {
      setSaveDetailsBusy(false);
    }
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    const label = newItemLabel.trim();
    if (label.length < 1 || listId == null) return;
    setAddItemBusy(true);
    try {
      await addItemToList(listId, { label, imageUrl: null });
      toast.success('Added');
      setNewItemLabel('');
      await refreshListDetail();
      bumpRanking();
    } catch (err) {
      toast.error(err.message || 'Could not add item.');
    } finally {
      setAddItemBusy(false);
    }
  };

  const handleRemoveItem = async (itemId, label) => {
    if (
      !window.confirm(`Remove "${label}" from this list? Comparisons involving this option will be removed.`)
    ) {
      return;
    }
    setRemovingItemId(itemId);
    try {
      await removeItem(listId, itemId);
      toast.success('Option removed');
      await refreshListDetail();
      bumpRanking();
    } catch (err) {
      toast.error(err.message || 'Could not remove option.');
    } finally {
      setRemovingItemId(null);
    }
  };

  const handleDeleteList = async () => {
    if (
      !window.confirm(
        `Delete "${list.title}" permanently? All rankings and comparisons for this list will be removed.`
      )
    ) {
      return;
    }
    setDeleteListBusy(true);
    try {
      await deleteListApi(listId);
      dispatch(removeList(listId));
      toast.success('List deleted');
      navigate('/');
    } catch (err) {
      toast.error(err.message || 'Could not delete list.');
    } finally {
      setDeleteListBusy(false);
    }
  };

  if (!isOwner) {
    return <Navigate to={listRoutePath(list.list_id)} replace />;
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-5">
        <h2 className="font-display text-lg font-semibold">List details</h2>
        <p className="mt-1 text-sm text-sortable-text-secondary">
          Edit the title and description, and whether this list appears on Discover or is link-only.
        </p>
        <form onSubmit={handleSaveDetails} className="mt-4 flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-xs text-sortable-text-secondary">
            Title
            <input
              className={settingsFieldClass}
              value={titleEdit}
              onChange={(ev) => setTitleEdit(ev.target.value)}
              required
              maxLength={200}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-sortable-text-secondary">
            Description (optional)
            <textarea
              className={settingsFieldClass}
              rows={3}
              value={descriptionEdit}
              onChange={(ev) => setDescriptionEdit(ev.target.value)}
              maxLength={1000}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-sortable-text-secondary">
            Exclude button label
            <input
              className={settingsFieldClass}
              value={excludeChoiceEdit}
              onChange={(ev) => setExcludeChoiceEdit(ev.target.value)}
              maxLength={50}
              placeholder={DEFAULT_EXCLUDE_BUTTON_LABEL}
            />
          </label>
          <div className="flex items-start gap-4 rounded-2xl border border-white/10 bg-sortable-surface p-4">
            <button
              type="button"
              role="switch"
              aria-checked={isPublicEdit}
              aria-label={
                isPublicEdit
                  ? 'List visibility: public on Discover'
                  : 'List visibility: private, link only'
              }
              onClick={() => setIsPublicEdit((v) => !v)}
              className={[
                'relative mt-0.5 h-8 w-14 shrink-0 rounded-full transition-colors duration-200 ease-smooth',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sortable-highlight',
                isPublicEdit ? 'bg-sortable-accent' : 'bg-white/15',
              ].join(' ')}
            >
              <span
                className={[
                  'absolute top-1 left-1 block h-6 w-6 rounded-full bg-sortable-text-primary shadow-soft',
                  'transition-transform duration-200 ease-smooth',
                  isPublicEdit ? 'translate-x-6' : 'translate-x-0',
                ].join(' ')}
                aria-hidden
              />
            </button>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-sortable-text-primary">
                {isPublicEdit ? 'Public list' : 'Private list'}
              </div>
              <div className="mt-1 text-xs text-sortable-text-secondary">
                {isPublicEdit
                  ? 'This list appears on Discover so anyone can find it.'
                  : 'Link-only: hidden from Discover; share the URL with people you choose.'}
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={saveDetailsBusy}>
              {saveDetailsBusy ? 'Saving' : 'Save details'}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-5">
        <h2 className="font-display text-lg font-semibold">Options in this list</h2>
        <p className="mt-1 text-sm text-sortable-text-secondary">
          Add options below; tap the media icon to pick an image, or tap the thumbnail later to remove the photo
          only. Trash deletes the whole option.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          tabIndex={-1}
          aria-hidden
          onChange={handleOptionPhotoFileChange}
        />
        <form onSubmit={handleAddItem} className={`mt-4 ${optionRowClass}`}>
          <label htmlFor="settings-new-option" className="sr-only">
            New option label
          </label>
          <input
            id="settings-new-option"
            type="text"
            className="min-w-0 flex-1 bg-transparent text-sm text-sortable-text-primary placeholder:text-sortable-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-sortable-highlight rounded-md px-1 py-0.5"
            value={newItemLabel}
            onChange={(ev) => setNewItemLabel(ev.target.value)}
            placeholder="Write in a new option"
            maxLength={200}
          />
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="shrink-0 gap-2 px-3 text-sortable-primary-start hover:text-sortable-primary-start"
            disabled={addItemBusy || !newItemLabel.trim()}
          >
            <IconCreate className="h-4 w-4 shrink-0 text-sortable-primary-start" />
            {addItemBusy ? 'Adding' : 'New Option'}
          </Button>
        </form>

        {items.length === 0 ? (
          <p className="mt-3 text-sm text-sortable-text-secondary">No options yet — use the field above.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {items.map((item) => {
              const rowBusy =
                removingItemId === item.item_id || uploadingItemId === item.item_id;
              return (
                <li key={item.item_id} className={settingsOptionRowClass}>
                  {item.image_url ? (
                    <button
                      type="button"
                      className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg ring-1 ring-white/10 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sortable-highlight disabled:pointer-events-none disabled:opacity-50"
                      aria-label={`Remove photo for ${item.label}`}
                      disabled={rowBusy}
                      onClick={() => handleOptionPhotoPreviewClick(item)}
                    >
                      <img src={item.image_url} alt="" className="h-full w-full object-cover" />
                    </button>
                  ) : (
                    <div
                      className="h-10 w-10 shrink-0 rounded-lg bg-white/5 ring-1 ring-white/10"
                      aria-hidden
                    />
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm text-sortable-text-primary">
                    {item.label}
                  </span>
                  <button
                    type="button"
                    className={`${optionIconBtnClass} text-sortable-primary-start`}
                    aria-label={`Choose photo for ${item.label}`}
                    disabled={rowBusy}
                    onClick={() => startOptionPhotoPick(item.item_id)}
                  >
                    <IconMedia className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    className={`${optionIconBtnClass} text-sortable-danger hover:border-sortable-danger/40`}
                    aria-label={`Delete ${item.label}`}
                    disabled={rowBusy}
                    onClick={() => handleRemoveItem(item.item_id, item.label)}
                  >
                    <IconTrash className="h-5 w-5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="border-sortable-danger/30 p-5">
        <h2 className="font-display text-lg font-semibold text-sortable-danger">Delete list</h2>
        <p className="mt-1 text-sm text-sortable-text-secondary">
          Permanently delete this list and all related rankings and comparisons.
        </p>
        <div className="mt-4">
          <Button type="button" variant="danger" disabled={deleteListBusy} onClick={handleDeleteList}>
            {deleteListBusy ? 'Deleting' : 'Delete this list'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
