import { api } from '../utils/api';

export async function fetchNextPair(listId) {
  return api.get(`/api/lists/${listId}/next-pair`);
}

export async function recordComparison(listId, { winnerId, loserId }) {
  return api.post(`/api/lists/${listId}/comparisons`, {
    winner_id: winnerId,
    loser_id: loserId,
  });
}

export async function resetMyRanking(listId) {
  return api.post(`/api/lists/${listId}/my-ranking/reset`, undefined);
}

export async function excludeItemFromRanking(listId, itemId) {
  return api.post(`/api/lists/${listId}/my-ranking/exclude`, {
    item_id: itemId,
  });
}
