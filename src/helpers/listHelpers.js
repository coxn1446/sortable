import { api } from '../utils/api';

export async function createList({ title, description, items, isPublic, excludeChoiceLabel }) {
  const body = {
    title,
    description,
    items,
    is_public: isPublic,
  };
  const trimmed = typeof excludeChoiceLabel === 'string' ? excludeChoiceLabel.trim() : '';
  if (trimmed) body.exclude_choice_label = trimmed;
  return api.post('/api/lists', body);
}

export async function fetchMyLists() {
  const data = await api.get('/api/lists/me');
  return data.lists || [];
}

export async function fetchDiscoverLists() {
  const data = await api.get('/api/lists/discover');
  return data.lists || [];
}

export async function fetchListById(listId) {
  return api.get(`/api/lists/${listId}`);
}

export async function fetchListBySlug(slug) {
  return api.get(`/api/lists/by-slug/${encodeURIComponent(slug)}`);
}

/** Numeric string → by id; otherwise by share slug. */
export async function fetchListByKey(rawKey) {
  const key = String(rawKey ?? '').trim();
  if (!key) {
    throw new Error('List not found.');
  }
  if (/^\d+$/.test(key)) {
    return fetchListById(Number(key));
  }
  return fetchListBySlug(key);
}

export async function updateList(listId, updates) {
  return api.patch(`/api/lists/${listId}`, updates);
}

export async function deleteList(listId) {
  return api.delete(`/api/lists/${listId}`);
}

export async function addItem(listId, { label, imageUrl }) {
  return api.post(`/api/lists/${listId}/items`, { label, image_url: imageUrl });
}

export async function patchItem(listId, itemId, updates) {
  return api.patch(`/api/lists/${listId}/items/${itemId}`, updates);
}

export async function removeItem(listId, itemId) {
  return api.delete(`/api/lists/${listId}/items/${itemId}`);
}

/**
 * @param {{ limit?: number, offset?: number, q?: string }} [opts]
 * @returns {Promise<{ comparisons: unknown[], has_more: boolean }>}
 */
export async function fetchActivity(opts = {}) {
  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;
  const q = typeof opts.q === 'string' ? opts.q.trim() : '';
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  if (q) params.set('q', q);
  const data = await api.get(`/api/lists/activity?${params.toString()}`);
  return {
    comparisons: data.comparisons || [],
    has_more: Boolean(data.has_more),
  };
}
