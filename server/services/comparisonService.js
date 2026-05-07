const adaptiveSort = require('./ranking/adaptiveSort');
const elo = require('./ranking/elo');
const db = require('../db');
const { ListServiceError, getListForViewer } = require('./listService');
const {
  listQueries,
  listItemQueries,
  comparisonQueries,
  rankingQueries,
  rankingExclusionQueries,
} = require('../queries');

/**
 * Lightweight in-memory state used by the adaptive sort engine.
 * Hydrated from / flushed to `user_item_ranks` + `user_sort_state`.
 */
function rebuildState(userItemRanks, sortStateRow, eligibleItemIds) {
  const placed = userItemRanks
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((r) => r.item_id);

  const placedSet = new Set(placed);
  const pending = sortStateRow?.pending_item_id ?? null;
  const queue = eligibleItemIds.filter((id) => !placedSet.has(id) && id !== pending);

  if (sortStateRow?.is_complete && pending == null) {
    // New items can be added after a completed ranking; reopen insertion for missing ids.
    if (queue.length > 0) {
      const nextPending = queue[0];
      return {
        placed,
        pending: nextPending,
        lo: 1,
        hi: placed.length + 1,
        queue: queue.slice(1),
        isComplete: false,
      };
    }
    return {
      placed,
      pending: null,
      lo: null,
      hi: null,
      queue: [],
      isComplete: true,
    };
  }

  if (pending == null) {
    // Either we haven't started or we're between items. Pick first queued item.
    if (placed.length === 0 && queue.length === 0) {
      return { placed: [], pending: null, lo: null, hi: null, queue: [], isComplete: true };
    }
    if (placed.length === 0 && queue.length > 0) {
      const [first, ...rest] = queue;
      return {
        placed: [first],
        pending: rest[0] ?? null,
        lo: rest.length ? 1 : null,
        hi: rest.length ? 2 : null,
        queue: rest.slice(1),
        isComplete: rest.length === 0,
      };
    }
    if (queue.length === 0) {
      return {
        placed,
        pending: null,
        lo: null,
        hi: null,
        queue: [],
        isComplete: true,
      };
    }
    const nextPending = queue[0];
    return {
      placed,
      pending: nextPending,
      lo: 1,
      hi: placed.length + 1,
      queue: queue.slice(1),
      isComplete: false,
    };
  }

  return {
    placed,
    pending,
    lo: sortStateRow.lo_position ?? 1,
    hi: sortStateRow.hi_position ?? placed.length + 1,
    queue,
    isComplete: !!sortStateRow.is_complete,
  };
}

async function loadState({ listId, userId }) {
  const exclusionIds = await rankingExclusionQueries.findExcludedItemIds(listId, userId);
  const exclusionSet = new Set(exclusionIds);

  const items = await listItemQueries.findItemsForList(listId);
  const itemMap = new Map(items.map((i) => [i.item_id, i]));
  const eligibleItemIds = items.map((i) => i.item_id).filter((id) => !exclusionSet.has(id));

  if (items.length === 0) {
    return {
      state: { placed: [], pending: null, lo: null, hi: null, queue: [], isComplete: true },
      items,
      itemMap,
    };
  }

  if (eligibleItemIds.length === 0) {
    return {
      state: {
        placed: [],
        pending: null,
        lo: null,
        hi: null,
        queue: [],
        isComplete: true,
      },
      items,
      itemMap,
    };
  }

  const compsAll = await comparisonQueries.findComparisonsForUser(listId, userId);
  const comps = compsAll.filter(
    (c) =>
      !exclusionSet.has(c.winner_item_id) &&
      !exclusionSet.has(c.loser_item_id)
  );

  const ranksRaw = await rankingQueries.getUserRanks(listId, userId);
  const ranksFiltered = ranksRaw.filter((r) => !exclusionSet.has(r.item_id));

  const sortRow = await rankingQueries.getSortState(listId, userId);

  const pendingBad =
    sortRow?.pending_item_id != null && exclusionSet.has(Number(sortRow.pending_item_id));

  const hasOrphanComparison = comps.length < compsAll.length;
  const hasExcludedRankRows = ranksRaw.some((r) => exclusionSet.has(r.item_id));

  if (hasOrphanComparison || hasExcludedRankRows || pendingBad) {
    const replayed = adaptiveSort.replay(eligibleItemIds, comps);
    await persistState({ listId, userId, state: replayed });
    return { state: replayed, items, itemMap };
  }

  if (comps.length === 0 && ranksFiltered.length === 0 && !sortRow) {
    // First visit: seed rank for the first eligible item, queue the rest.
    const state = adaptiveSort.init(eligibleItemIds);
    await persistState({ listId, userId, state });
    return { state, items, itemMap };
  }

  return {
    state: rebuildState(ranksFiltered, sortRow, eligibleItemIds),
    items,
    itemMap,
  };
}

async function persistState({ listId, userId, state }) {
  const ranks = state.placed.map((itemId, idx) => ({
    itemId,
    position: idx + 1,
  }));
  await rankingQueries.replaceUserRanks(listId, userId, ranks, {
    isFinalized: state.isComplete,
  });
  await rankingQueries.upsertSortState({
    listId,
    userId,
    pendingItemId: state.pending,
    loPosition: state.lo,
    hiPosition: state.hi,
    isComplete: state.isComplete,
  });
}

async function getNextPair({ listId, userId }) {
  const { state, itemMap } = await loadState({ listId, userId });
  return decorate(state, itemMap);
}

function decorate(state, itemMap) {
  const pair = adaptiveSort.nextPair(state);
  const placedCount = state.placed.length;
  const total = placedCount + (state.pending ? 1 : 0) + state.queue.length;
  const progress = total > 0 ? placedCount / total : 1;
  if (pair.done) {
    return {
      done: true,
      placedCount,
      total,
      progress: 1,
    };
  }
  return {
    done: false,
    a: itemMap.get(pair.a) || null,
    b: itemMap.get(pair.b) || null,
    pendingPosition: pair.pendingPosition,
    placedCount,
    total,
    progress,
  };
}

async function applyComparison({ listId, userId, winnerItemId, loserItemId }) {
  if (!Number.isInteger(winnerItemId) || !Number.isInteger(loserItemId)) {
    throw new ListServiceError('winner_id and loser_id are required.', 400);
  }
  if (winnerItemId === loserItemId) {
    throw new ListServiceError('winner and loser must be different items.', 400);
  }

  const list = await listQueries.findListById(listId);
  if (!list) throw new ListServiceError('List not found.', 404);

  // Auto-add the user as a contributor on first comparison.
  await listQueries.addContributor({ listId, userId });

  const { state, items, itemMap } = await loadState({ listId, userId });
  if (state.isComplete) {
    return decorate(state, itemMap);
  }

  // Validate that both items belong to this list.
  if (!itemMap.has(winnerItemId) || !itemMap.has(loserItemId)) {
    throw new ListServiceError('Item not found in this list.', 400);
  }

  // Validate that this comparison matches the current pending pair.
  const expected = adaptiveSort.nextPair(state);
  if (expected.done) {
    return decorate(state, itemMap);
  }
  const expectedSet = new Set([expected.a, expected.b]);
  if (!expectedSet.has(winnerItemId) || !expectedSet.has(loserItemId)) {
    throw new ListServiceError('Stale comparison: the active pair has changed.', 409);
  }

  // Record the comparison row.
  await comparisonQueries.recordComparison({
    listId,
    userId,
    winnerItemId,
    loserItemId,
  });

  // Update aggregate Elo for both items (community ranking view).
  await updateAggregateElo({ listId, winnerItemId, loserItemId });

  // Advance the adaptive sort and persist the new state.
  const nextState = adaptiveSort.applyComparison(state, winnerItemId, loserItemId);
  await persistState({ listId, userId, state: nextState });

  return decorate(nextState, new Map(items.map((i) => [i.item_id, i])));
}

/**
 * Exclude an item from the viewer's ranking consideration: persist exclusion, prune comparisons that
 * reference that item for this user, replay adaptive sort on eligible items, rebuild aggregate Elo for
 * all users on the list.
 */
async function excludeItemFromRanking({ listId, userId, itemId }) {
  await getListForViewer({ listId, userId, allowPublic: true });

  const numericId = Number(itemId);
  if (!Number.isInteger(numericId) || numericId < 1) {
    throw new ListServiceError('item_id is required.', 400);
  }

  const itemRow = await listItemQueries.findItem(listId, numericId);
  if (!itemRow) throw new ListServiceError('Item not found in this list.', 404);

  if (await rankingExclusionQueries.userHasExcludedItem(listId, userId, numericId)) {
    return getNextPair({ listId, userId });
  }

  await rankingExclusionQueries.addExclusion({
    listId,
    userId,
    itemId: numericId,
  });

  await comparisonQueries.deleteUserComparisonsTouchingItem({
    listId,
    userId,
    itemId: numericId,
  });

  const exclusions = await rankingExclusionQueries.findExcludedItemIds(listId, userId);
  const exclusionSet = new Set(exclusions);

  const items = await listItemQueries.findItemsForList(listId);
  const itemMap = new Map(items.map((i) => [i.item_id, i]));

  const eligibleItemIds = items.map((i) => i.item_id).filter((id) => !exclusionSet.has(id));

  let state;
  if (eligibleItemIds.length === 0) {
    state = {
      placed: [],
      pending: null,
      lo: null,
      hi: null,
      queue: [],
      isComplete: true,
    };
  } else {
    const comps = await comparisonQueries.findComparisonsForUser(listId, userId);
    const compsOk = comps.filter(
      (c) =>
        !exclusionSet.has(c.winner_item_id) &&
        !exclusionSet.has(c.loser_item_id)
    );
    state = adaptiveSort.replay(eligibleItemIds, compsOk);
  }

  await persistState({ listId, userId, state });

  await rebuildAggregateWithQuery((text, params) => db.query(text, params), listId);

  await listQueries.addContributor({ listId, userId });

  return decorate(state, itemMap);
}

/**
 * @param {(text: string, params?: unknown[]) => Promise<{ rows?: unknown[] }>} query
 */
async function runAggregateMatch(query, listId, winnerItemId, loserItemId) {
  await query(
    `INSERT INTO item_aggregate (list_id, item_id) VALUES ($1, $2) ON CONFLICT (list_id, item_id) DO NOTHING`,
    [listId, winnerItemId]
  );
  await query(
    `INSERT INTO item_aggregate (list_id, item_id) VALUES ($1, $2) ON CONFLICT (list_id, item_id) DO NOTHING`,
    [listId, loserItemId]
  );
  const { rows: wRows } = await query(
    `SELECT elo_rating, match_count, win_count FROM item_aggregate WHERE list_id = $1 AND item_id = $2`,
    [listId, winnerItemId]
  );
  const { rows: lRows } = await query(
    `SELECT elo_rating, match_count, win_count FROM item_aggregate WHERE list_id = $1 AND item_id = $2`,
    [listId, loserItemId]
  );
  const winner = wRows[0];
  const loser = lRows[0];
  if (!winner || !loser) return;
  const updated = elo.applyMatch({
    winner: {
      elo_rating: Number(winner.elo_rating),
      match_count: Number(winner.match_count),
      win_count: Number(winner.win_count),
    },
    loser: {
      elo_rating: Number(loser.elo_rating),
      match_count: Number(loser.match_count),
      win_count: Number(loser.win_count),
    },
  });
  await query(
    `UPDATE item_aggregate SET elo_rating = $3, match_count = $4, win_count = $5, updated_at = NOW() WHERE list_id = $1 AND item_id = $2`,
    [listId, winnerItemId, updated.winner.elo_rating, updated.winner.match_count, updated.winner.win_count]
  );
  await query(
    `UPDATE item_aggregate SET elo_rating = $3, match_count = $4, win_count = $5, updated_at = NOW() WHERE list_id = $1 AND item_id = $2`,
    [listId, loserItemId, updated.loser.elo_rating, updated.loser.match_count, updated.loser.win_count]
  );
}

/**
 * Replace aggregate Elo for a list by replaying every remaining comparison in chronological order.
 */
async function rebuildAggregateWithQuery(query, listId) {
  await query(`DELETE FROM item_aggregate WHERE list_id = $1`, [listId]);
  const { rows } = await query(
    `SELECT winner_item_id, loser_item_id FROM comparisons WHERE list_id = $1 ORDER BY created_at ASC, comparison_id ASC`,
    [listId]
  );
  for (const c of rows) {
    await runAggregateMatch(query, listId, c.winner_item_id, c.loser_item_id);
  }
}

async function updateAggregateElo({ listId, winnerItemId, loserItemId }) {
  await runAggregateMatch((text, params) => db.query(text, params), listId, winnerItemId, loserItemId);
}

async function resetMyRanking({ listId, userId }) {
  await getListForViewer({ listId, userId, allowPublic: true });
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM comparisons WHERE list_id = $1 AND user_id = $2`, [listId, userId]);
    await client.query(
      `DELETE FROM user_list_item_exclusions WHERE list_id = $1 AND user_id = $2`,
      [listId, userId]
    );
    await client.query(`DELETE FROM user_item_ranks WHERE list_id = $1 AND user_id = $2`, [listId, userId]);
    await client.query(`DELETE FROM user_sort_state WHERE list_id = $1 AND user_id = $2`, [listId, userId]);
    await rebuildAggregateWithQuery(client.query.bind(client), listId);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  getNextPair,
  applyComparison,
  resetMyRanking,
  excludeItemFromRanking,
};
