/**
 * Elo rating utilities.
 *
 * Default K=32, decays to K=16 once an item has played 30 matches so early matches
 * move ratings quickly and later matches stabilize.
 */

const DEFAULT_RATING = 1500;
const K_HIGH = 32;
const K_LOW = 16;
const K_DECAY_THRESHOLD = 30;

function expectedScore(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

function kFactor(matchCount) {
  return matchCount >= K_DECAY_THRESHOLD ? K_LOW : K_HIGH;
}

/**
 * Apply a single match outcome.
 *
 * `winner` / `loser` shape: { elo_rating, match_count, win_count }.
 * Returns updated copies of both items.
 */
function applyMatch({ winner, loser }) {
  const winnerRating = Number(winner.elo_rating);
  const loserRating = Number(loser.elo_rating);
  const expectedWinner = expectedScore(winnerRating, loserRating);
  const kWinner = kFactor(winner.match_count);
  const kLoser = kFactor(loser.match_count);

  return {
    winner: {
      elo_rating: round2(winnerRating + kWinner * (1 - expectedWinner)),
      match_count: winner.match_count + 1,
      win_count: winner.win_count + 1,
    },
    loser: {
      elo_rating: round2(loserRating + kLoser * (0 - (1 - expectedWinner))),
      match_count: loser.match_count + 1,
      win_count: loser.win_count,
    },
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

module.exports = {
  DEFAULT_RATING,
  K_HIGH,
  K_LOW,
  K_DECAY_THRESHOLD,
  expectedScore,
  kFactor,
  applyMatch,
};
