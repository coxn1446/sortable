/**
 * Path segment under `/list/:id` — always the numeric database list id.
 * @param {{ list_id: number }} list
 */
export function listPathSegment(list) {
  return String(list?.list_id ?? '');
}

/**
 * @param {string|number} listId - must match `lists.list_id` (digits only once resolved)
 * @param {{ reset?: string; tab?: 'results' | 'settings' }} [params]
 */
export function listRoutePath(listId, { reset, tab } = {}) {
  const enc = encodeURIComponent(String(listId));
  let path = `/list/${enc}`;
  if (tab === 'results') path += '/results';
  else if (tab === 'settings') path += '/settings';
  const p = new URLSearchParams();
  if (reset === '1' || reset === 'true') p.set('reset', '1');
  const q = p.toString();
  return q ? `${path}?${q}` : path;
}
