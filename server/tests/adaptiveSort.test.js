const {
  init,
  nextPair,
  applyComparison,
  replay,
} = require('../services/ranking/adaptiveSort');

/**
 * Helper: simulate a user with an *oracle ranking* answering all comparisons.
 * Returns the comparisons issued and the final state.
 */
function simulate(itemIds, oracleRanking) {
  const oracleRank = new Map(oracleRanking.map((id, idx) => [id, idx]));
  let state = init(itemIds);
  const comparisons = [];
  let safety = 0;

  while (!state.isComplete) {
    const pair = nextPair(state);
    if (pair.done) break;
    const { a, b } = pair;
    const winner = oracleRank.get(a) < oracleRank.get(b) ? a : b;
    const loser = winner === a ? b : a;
    comparisons.push({ winner_item_id: winner, loser_item_id: loser });
    state = applyComparison(state, winner, loser);
    safety++;
    if (safety > itemIds.length * 50) {
      throw new Error('runaway loop in adaptive sort simulation');
    }
  }
  return { state, comparisons };
}

describe('adaptiveSort.init', () => {
  test('empty list -> immediately complete', () => {
    const s = init([]);
    expect(s.isComplete).toBe(true);
    expect(s.placed).toEqual([]);
    expect(nextPair(s)).toEqual({ done: true });
  });

  test('single item -> immediately complete', () => {
    const s = init([42]);
    expect(s.isComplete).toBe(true);
    expect(s.placed).toEqual([42]);
    expect(nextPair(s)).toEqual({ done: true });
  });

  test('two items -> one pending comparison', () => {
    const s = init([1, 2]);
    expect(s.isComplete).toBe(false);
    expect(s.placed).toEqual([1]);
    expect(s.pending).toBe(2);
    const pair = nextPair(s);
    expect(pair.done).toBeUndefined();
    expect(new Set([pair.a, pair.b])).toEqual(new Set([1, 2]));
  });
});

describe('adaptiveSort.applyComparison', () => {
  test('two items: winner ends up on top', () => {
    let s = init([1, 2]);
    s = applyComparison(s, /*winner*/ 2, /*loser*/ 1);
    expect(s.isComplete).toBe(true);
    expect(s.placed).toEqual([2, 1]);
  });

  test('two items: loser keeps position', () => {
    let s = init([1, 2]);
    s = applyComparison(s, /*winner*/ 1, /*loser*/ 2);
    expect(s.isComplete).toBe(true);
    expect(s.placed).toEqual([1, 2]);
  });

  test('idempotent: stale comparisons not involving pending are ignored', () => {
    let s = init([1, 2, 3]);
    const before = s;
    const stale = applyComparison(s, 99, 100);
    expect(stale).toBe(before);
  });

  test('winnerId === loserId is a no-op', () => {
    const s = init([1, 2, 3]);
    expect(applyComparison(s, 1, 1)).toBe(s);
  });
});

describe('adaptiveSort full convergence', () => {
  test.each([3, 4, 5, 6, 8, 10, 16])(
    '%i items converge in <= ceil(N log2 N) comparisons',
    (n) => {
      const items = Array.from({ length: n }, (_, i) => i + 1);
      const oracle = [...items].sort(() => 0.5 - Math.random());
      const { state, comparisons } = simulate(items, oracle);
      expect(state.isComplete).toBe(true);
      expect(state.placed).toEqual(oracle);
      const upperBound = Math.ceil(n * Math.log2(Math.max(2, n))) + n;
      expect(comparisons.length).toBeLessThanOrEqual(upperBound);
    }
  );

  test('replay reproduces the same final state', () => {
    const items = [1, 2, 3, 4, 5, 6];
    const oracle = [3, 5, 1, 6, 2, 4];
    const { comparisons } = simulate(items, oracle);
    const replayed = replay(items, comparisons);
    expect(replayed.isComplete).toBe(true);
    expect(replayed.placed).toEqual(oracle);
  });

  test('partial replay produces an interim state with pending', () => {
    const items = [1, 2, 3, 4, 5];
    const oracle = [2, 4, 1, 5, 3];
    const { comparisons } = simulate(items, oracle);
    const partial = replay(items, comparisons.slice(0, 2));
    expect(partial.isComplete).toBe(false);
    expect(partial.pending).not.toBeNull();
  });
});

describe('adaptiveSort never asks the same pair twice in a row', () => {
  test('after a comparison the next pair changes', () => {
    let s = init([1, 2, 3, 4]);
    const seen = new Set();
    let safety = 0;
    while (!s.isComplete && safety < 50) {
      const p = nextPair(s);
      if (p.done) break;
      const key = [p.a, p.b].sort().join(',');
      seen.add(key);
      s = applyComparison(s, p.a, p.b);
      safety++;
    }
    expect(s.isComplete).toBe(true);
  });
});
