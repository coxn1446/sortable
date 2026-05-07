/**
 * Adaptive insertion sort for pairwise comparisons.
 *
 * Each user maintains:
 *   - placed: items already placed, in rank order (best first, 1-indexed by `position`)
 *   - pending: the item currently being inserted via binary search
 *   - lo / hi: 1-indexed bounds for where pending will land (inclusive)
 *   - queue: unattempted items
 *
 * Insertion sort with binary search needs ceil(log2(N+1)) comparisons per insertion,
 * so a list of N items converges in roughly O(N log N) total comparisons.
 *
 * The state is plain JSON so it serializes cleanly into the
 * `user_item_ranks` + `user_sort_state` tables.
 */

/** Build initial state from an ordered list of item ids. */
function init(itemIds) {
  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    return { placed: [], pending: null, lo: null, hi: null, queue: [], isComplete: true };
  }
  const placed = [itemIds[0]];
  const queue = itemIds.slice(1);
  if (queue.length === 0) {
    return { placed, pending: null, lo: null, hi: null, queue: [], isComplete: true };
  }
  const pending = queue.shift();
  return {
    placed,
    pending,
    lo: 1,
    hi: placed.length + 1,
    queue,
    isComplete: false,
  };
}

/**
 * Returns the next comparison the user should answer.
 * - { done: true }                       when fully sorted
 * - { a: pendingId, b: opponentId, pendingPosition }  otherwise
 */
function nextPair(state) {
  if (!state || state.isComplete || state.pending == null) {
    return { done: true };
  }
  const mid = Math.floor((state.lo + state.hi) / 2);
  return {
    a: state.pending,
    b: state.placed[mid - 1],
    pendingPosition: mid,
  };
}

/**
 * Returns a new state after recording the outcome of the current comparison.
 * If `winnerId` / `loserId` don't match the expected pending vs target pair, the state
 * is returned unchanged (idempotent against duplicate / stale clicks).
 */
function applyComparison(state, winnerId, loserId) {
  if (!state || state.isComplete || state.pending == null) return state;
  if (winnerId === loserId) return state;

  const mid = Math.floor((state.lo + state.hi) / 2);
  const target = state.placed[mid - 1];
  const pending = state.pending;

  let { lo, hi } = state;

  if (winnerId === pending && loserId === target) {
    hi = mid;
  } else if (loserId === pending && winnerId === target) {
    lo = mid + 1;
  } else {
    return state;
  }

  if (lo === hi) {
    const insertIdx = lo - 1;
    const placed = [
      ...state.placed.slice(0, insertIdx),
      pending,
      ...state.placed.slice(insertIdx),
    ];
    const queue = state.queue.slice();
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

  return { ...state, lo, hi };
}

/**
 * Replay a list of comparisons against a fresh init() to derive the current state.
 * Used to recover after a crash or to rebuild the cache from `comparisons` rows.
 */
function replay(itemIds, comparisons) {
  let state = init(itemIds);
  for (const c of comparisons) {
    state = applyComparison(state, c.winner_item_id, c.loser_item_id);
  }
  return state;
}

module.exports = { init, nextPair, applyComparison, replay };
