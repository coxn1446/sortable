const {
  DEFAULT_RATING,
  K_HIGH,
  K_LOW,
  K_DECAY_THRESHOLD,
  expectedScore,
  kFactor,
  applyMatch,
} = require('../services/ranking/elo');

describe('elo.expectedScore', () => {
  test('equal ratings -> 0.5', () => {
    expect(expectedScore(1500, 1500)).toBeCloseTo(0.5, 5);
  });

  test('higher rated player has expected score > 0.5', () => {
    expect(expectedScore(1700, 1500)).toBeGreaterThan(0.5);
  });

  test('expected scores sum to 1', () => {
    const a = expectedScore(1600, 1400);
    const b = expectedScore(1400, 1600);
    expect(a + b).toBeCloseTo(1, 5);
  });
});

describe('elo.kFactor', () => {
  test('uses K_HIGH for new items', () => {
    expect(kFactor(0)).toBe(K_HIGH);
    expect(kFactor(K_DECAY_THRESHOLD - 1)).toBe(K_HIGH);
  });

  test('decays to K_LOW once threshold reached', () => {
    expect(kFactor(K_DECAY_THRESHOLD)).toBe(K_LOW);
    expect(kFactor(100)).toBe(K_LOW);
  });
});

describe('elo.applyMatch', () => {
  function makeItem(overrides = {}) {
    return {
      elo_rating: DEFAULT_RATING,
      match_count: 0,
      win_count: 0,
      ...overrides,
    };
  }

  test('equal ratings: winner +16 (K=32 * 0.5), loser -16', () => {
    const result = applyMatch({ winner: makeItem(), loser: makeItem() });
    expect(result.winner.elo_rating).toBeCloseTo(1516, 1);
    expect(result.loser.elo_rating).toBeCloseTo(1484, 1);
    expect(result.winner.match_count).toBe(1);
    expect(result.winner.win_count).toBe(1);
    expect(result.loser.match_count).toBe(1);
    expect(result.loser.win_count).toBe(0);
  });

  test('underdog wins -> larger swing', () => {
    const equal = applyMatch({ winner: makeItem(), loser: makeItem() });
    const upset = applyMatch({
      winner: makeItem({ elo_rating: 1300 }),
      loser: makeItem({ elo_rating: 1700 }),
    });
    const equalDelta = equal.winner.elo_rating - DEFAULT_RATING;
    const upsetDelta = upset.winner.elo_rating - 1300;
    expect(upsetDelta).toBeGreaterThan(equalDelta);
  });

  test('K decays after threshold matches -> smaller swing', () => {
    const before = applyMatch({
      winner: makeItem({ match_count: 0 }),
      loser: makeItem({ match_count: 0 }),
    });
    const after = applyMatch({
      winner: makeItem({ match_count: K_DECAY_THRESHOLD }),
      loser: makeItem({ match_count: K_DECAY_THRESHOLD }),
    });
    const beforeDelta = before.winner.elo_rating - DEFAULT_RATING;
    const afterDelta = after.winner.elo_rating - DEFAULT_RATING;
    expect(afterDelta).toBeLessThan(beforeDelta);
    expect(afterDelta).toBeCloseTo(beforeDelta / 2, 1);
  });

  test('zero-sum: total rating preserved when same K', () => {
    const w = makeItem({ elo_rating: 1600 });
    const l = makeItem({ elo_rating: 1400 });
    const before = w.elo_rating + l.elo_rating;
    const out = applyMatch({ winner: w, loser: l });
    const after = out.winner.elo_rating + out.loser.elo_rating;
    expect(after).toBeCloseTo(before, 0);
  });
});
