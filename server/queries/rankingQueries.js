const db = require('../db');

/* ---- user_item_ranks ---- */

async function getUserRanks(listId, userId) {
  const { rows } = await db.query(
    `SELECT list_id, user_id, item_id, position, is_finalized
     FROM user_item_ranks
     WHERE list_id = $1 AND user_id = $2
     ORDER BY position ASC`,
    [listId, userId]
  );
  return rows;
}

async function replaceUserRanks(listId, userId, ranks, { isFinalized = false } = {}) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    await client.query(
      `DELETE FROM user_item_ranks WHERE list_id = $1 AND user_id = $2`,
      [listId, userId]
    );
    if (ranks.length > 0) {
      const values = [];
      const placeholders = ranks.map((r, i) => {
        const base = i * 4;
        values.push(listId, userId, r.itemId, r.position);
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, ${isFinalized ? 'TRUE' : 'FALSE'})`;
      });
      await client.query(
        `INSERT INTO user_item_ranks (list_id, user_id, item_id, position, is_finalized)
         VALUES ${placeholders.join(', ')}`,
        values
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/* ---- user_sort_state ---- */

async function getSortState(listId, userId) {
  const { rows } = await db.query(
    `SELECT list_id, user_id, pending_item_id, lo_position, hi_position, is_complete, updated_at
     FROM user_sort_state
     WHERE list_id = $1 AND user_id = $2`,
    [listId, userId]
  );
  return rows[0] || null;
}

async function upsertSortState({
  listId,
  userId,
  pendingItemId,
  loPosition,
  hiPosition,
  isComplete,
}) {
  await db.query(
    `INSERT INTO user_sort_state
       (list_id, user_id, pending_item_id, lo_position, hi_position, is_complete)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (list_id, user_id) DO UPDATE SET
       pending_item_id = EXCLUDED.pending_item_id,
       lo_position     = EXCLUDED.lo_position,
       hi_position     = EXCLUDED.hi_position,
       is_complete     = EXCLUDED.is_complete,
       updated_at      = NOW()`,
    [listId, userId, pendingItemId || null, loPosition, hiPosition, !!isComplete]
  );
}

/* ---- item_aggregate (Elo) ---- */

async function ensureAggregateRow(listId, itemId) {
  await db.query(
    `INSERT INTO item_aggregate (list_id, item_id)
     VALUES ($1, $2)
     ON CONFLICT (list_id, item_id) DO NOTHING`,
    [listId, itemId]
  );
}

async function getAggregate(listId, itemId) {
  const { rows } = await db.query(
    `SELECT list_id, item_id, elo_rating, match_count, win_count
     FROM item_aggregate
     WHERE list_id = $1 AND item_id = $2`,
    [listId, itemId]
  );
  return rows[0] || null;
}

async function updateAggregate({ listId, itemId, eloRating, matchCount, winCount }) {
  await db.query(
    `UPDATE item_aggregate
       SET elo_rating = $3, match_count = $4, win_count = $5, updated_at = NOW()
     WHERE list_id = $1 AND item_id = $2`,
    [listId, itemId, eloRating, matchCount, winCount]
  );
}

async function deleteUserRankingForList(listId, userId) {
  await db.query(`DELETE FROM user_item_ranks WHERE list_id = $1 AND user_id = $2`, [
    listId,
    userId,
  ]);
  await db.query(`DELETE FROM user_sort_state WHERE list_id = $1 AND user_id = $2`, [
    listId,
    userId,
  ]);
}

async function resetAggregateForList(listId) {
  await db.query(`DELETE FROM item_aggregate WHERE list_id = $1`, [listId]);
}

async function listRankingParticipants(listId) {
  const { rows } = await db.query(
    `SELECT d.user_id, u.username, u.profile_picture, COALESCE(uss.is_complete, FALSE) AS is_finalized
     FROM (
       SELECT DISTINCT user_id FROM user_item_ranks WHERE list_id = $1
     ) d
     JOIN users u ON u.user_id = d.user_id
     LEFT JOIN user_sort_state uss ON uss.list_id = $1 AND uss.user_id = d.user_id
     ORDER BY LOWER(u.username) ASC`,
    [listId]
  );
  return rows;
}

async function getAggregateRanking(listId) {
  const { rows } = await db.query(
    `SELECT a.list_id, a.item_id, a.elo_rating, a.match_count, a.win_count,
            i.label, i.image_url
     FROM item_aggregate a
     JOIN list_items i ON i.item_id = a.item_id
     WHERE a.list_id = $1
     ORDER BY a.elo_rating DESC, a.item_id ASC`,
    [listId]
  );
  return rows;
}

module.exports = {
  getUserRanks,
  replaceUserRanks,
  getSortState,
  upsertSortState,
  ensureAggregateRow,
  getAggregate,
  updateAggregate,
  deleteUserRankingForList,
  resetAggregateForList,
  listRankingParticipants,
  getAggregateRanking,
};
