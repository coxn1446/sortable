const db = require('../db');

async function recordComparison({ listId, userId, winnerItemId, loserItemId }) {
  const { rows } = await db.query(
    `INSERT INTO comparisons (list_id, user_id, winner_item_id, loser_item_id)
     VALUES ($1, $2, $3, $4)
     RETURNING comparison_id, list_id, user_id, winner_item_id, loser_item_id, created_at`,
    [listId, userId, winnerItemId, loserItemId]
  );
  return rows[0];
}

async function findComparisonsForUser(listId, userId) {
  const { rows } = await db.query(
    `SELECT comparison_id, list_id, user_id, winner_item_id, loser_item_id, created_at
     FROM comparisons
     WHERE list_id = $1 AND user_id = $2
     ORDER BY created_at ASC, comparison_id ASC`,
    [listId, userId]
  );
  return rows;
}

async function deleteComparisonsForUserList(listId, userId) {
  await db.query(`DELETE FROM comparisons WHERE list_id = $1 AND user_id = $2`, [
    listId,
    userId,
  ]);
}

async function deleteUserComparisonsTouchingItem({ listId, userId, itemId }) {
  await db.query(
    `DELETE FROM comparisons
     WHERE list_id = $1 AND user_id = $2
       AND (winner_item_id = $3 OR loser_item_id = $3)`,
    [listId, userId, itemId]
  );
}

async function findComparisonsForListOrdered(listId) {
  const { rows } = await db.query(
    `SELECT comparison_id, list_id, user_id, winner_item_id, loser_item_id, created_at
     FROM comparisons
     WHERE list_id = $1
     ORDER BY created_at ASC, comparison_id ASC`,
    [listId]
  );
  return rows;
}

function escapeILikePattern(raw) {
  return raw.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/**
 * @param {number} userId
 * @param {{ limit?: number, offset?: number, search?: string }} [options]
 * @returns {Promise<Array>} Up to (limit + 1) rows (caller uses extra row for has_more).
 */
async function findRecentComparisonsForUser(userId, options = {}) {
  const limitRaw = Number(options.limit);
  const offsetRaw = Number(options.offset);
  const safeLimit = Math.min(50, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 20));
  const safeOffset = Math.max(0, Number.isFinite(offsetRaw) ? Math.floor(offsetRaw) : 0);
  const rawSearch =
    typeof options.search === 'string' ? options.search.trim().slice(0, 200) : '';

  const fetchLimit = safeLimit + 1;

  const baseFrom = `
     FROM comparisons c
     JOIN lists l ON l.list_id = c.list_id
     JOIN list_items wi ON wi.item_id = c.winner_item_id
     JOIN list_items li ON li.item_id = c.loser_item_id
     WHERE c.user_id = $1`;

  let sql;
  /** @type {unknown[]} */
  let params;

  if (!rawSearch) {
    sql = `SELECT c.comparison_id, c.list_id, c.user_id,
            c.winner_item_id, c.loser_item_id, c.created_at,
            l.title AS list_title,
            wi.label AS winner_label,
            li.label AS loser_label
     ${baseFrom}
     ORDER BY c.created_at DESC, c.comparison_id DESC
     LIMIT $2 OFFSET $3`;
    params = [userId, fetchLimit, safeOffset];
  } else {
    const pattern = `%${escapeILikePattern(rawSearch)}%`;
    sql = `SELECT c.comparison_id, c.list_id, c.user_id,
            c.winner_item_id, c.loser_item_id, c.created_at,
            l.title AS list_title,
            wi.label AS winner_label,
            li.label AS loser_label
     ${baseFrom}
     AND (
       l.title ILIKE $4 ESCAPE '\\'
       OR wi.label ILIKE $4 ESCAPE '\\'
       OR li.label ILIKE $4 ESCAPE '\\'
     )
     ORDER BY c.created_at DESC, c.comparison_id DESC
     LIMIT $2 OFFSET $3`;
    params = [userId, fetchLimit, safeOffset, pattern];
  }

  const { rows } = await db.query(sql, params);
  return rows;
}

module.exports = {
  recordComparison,
  findComparisonsForUser,
  deleteComparisonsForUserList,
  deleteUserComparisonsTouchingItem,
  findComparisonsForListOrdered,
  findRecentComparisonsForUser,
};
