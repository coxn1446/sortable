import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import Button from '../ui/Button';
import { createList } from '../../helpers/listHelpers';
import { listRoutePath } from '../../helpers/listRoutePaths';

const inputClass =
  'rounded-xl border border-white/10 bg-sortable-surface px-3 py-2 text-sm text-sortable-text-primary placeholder:text-sortable-text-secondary focus:border-sortable-highlight focus:outline-none focus:ring-1 focus:ring-sortable-highlight';

const DEFAULT_EXCLUDE_BUTTON_LABEL = 'Remove';

/**
 * @param {{ embedded?: boolean }} props — When embedded (e.g. Home), omits page chrome and Cancel.
 */
export default function CreateListForm({ embedded = false }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [itemsText, setItemsText] = useState('');
  const [excludeChoiceLabel, setExcludeChoiceLabel] = useState(DEFAULT_EXCLUDE_BUTTON_LABEL);
  const [isPublic, setIsPublic] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const itemLabels = itemsText
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (itemLabels.length < 2) {
      toast.error('Add at least 2 items.');
      return;
    }
    setSubmitting(true);
    try {
      const excludeTrim = excludeChoiceLabel.trim();
      const excludeForApi =
        excludeTrim === '' || excludeTrim === DEFAULT_EXCLUDE_BUTTON_LABEL ? undefined : excludeTrim;

      const { list } = await createList({
        title,
        description,
        items: itemLabels,
        isPublic,
        excludeChoiceLabel: excludeForApi,
      });
      toast.success('List created');
      navigate(listRoutePath(String(list.list_id)));
    } catch (error) {
      toast.error(error.message || 'Could not create list');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-sortable-text-secondary">Title</span>
        <input
          type="text"
          required
          placeholder="Best pizza toppings"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputClass}
          maxLength={200}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-sortable-text-secondary">Description (optional)</span>
        <textarea
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={inputClass}
          maxLength={1000}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-sortable-text-secondary">Exclude button label</span>
        <input
          type="text"
          value={excludeChoiceLabel}
          onChange={(e) => setExcludeChoiceLabel(e.target.value)}
          className={inputClass}
          maxLength={50}
          placeholder={DEFAULT_EXCLUDE_BUTTON_LABEL}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-sortable-text-secondary">Items (one per line)</span>
        <textarea
          rows={embedded ? 6 : 8}
          required
          placeholder={'Pepperoni\nMargherita\nMushroom\nHawaiian'}
          value={itemsText}
          onChange={(e) => setItemsText(e.target.value)}
          className={inputClass}
        />
        <span className="text-xs text-sortable-text-secondary">
          {itemLabels.length} item{itemLabels.length === 1 ? '' : 's'}
        </span>
      </label>

      <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-sortable-surface p-4">
        <input
          type="checkbox"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
          className="h-4 w-4 rounded border-white/30 bg-sortable-bg"
        />
        <div>
          <div className="font-medium">Public list</div>
          <div className="text-xs text-sortable-text-secondary">
            When on, the list appears on Discover. When off, it stays off Discover and you share it only by
            link.
          </div>
        </div>
      </label>

      <div className="flex justify-end gap-3 pt-2">
        {!embedded ? (
          <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Creating' : 'Create list'}
        </Button>
      </div>
    </form>
  );
}
