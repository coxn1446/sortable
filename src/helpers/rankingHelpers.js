import { api } from '../utils/api';

export async function fetchRanking(listId, { viewUserId } = {}) {
  const suffix =
    viewUserId != null ? `?view_user_id=${encodeURIComponent(viewUserId)}` : '';
  return api.get(`/api/lists/${listId}/ranking${suffix}`);
}
