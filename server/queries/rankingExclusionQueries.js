const db = require('../db');

/**
 * Add an exclusion row. Idempotent.
 * @returns {Promise<boolean>} true if a row was inserted
 */
async function addExclusion({ listId, userId, itemId }) {
  const { rowCount } = await db.query(
    `INSERT INTO user_list_item_exclusions (list_id, user_id, item_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (list_id, user_id, item_id) DO NOTHING`,
    [listId, userId, itemId]
  );
  return rowCount === 1;
}

async function findExcludedItemIds(listId, userId) {
  const { rows } = await db.query(
    `SELECT item_id FROM user_list_item_exclusions
     WHERE list_id = $1 AND user_id = $2`,
    [listId, userId]
  );
  return rows.map((r) => Number(r.item_id));
}

async function deleteExclusionsForUserList(listId, userId) {
  await db.query(
    `DELETE FROM user_list_item_exclusions WHERE list_id = $1 AND user_id = $2`,
    [listId, userId]
  );
}

async function userHasExcludedItem(listId, userId, itemId) {
  const { rows } = await db.query(
    `SELECT 1 FROM user_list_item_exclusions
     WHERE list_id = $1 AND user_id = $2 AND item_id = $3`,
    [listId, userId, itemId]
  );
  return rows.length > 0;
}

module.exports = {
  addExclusion,
  findExcludedItemIds,
  deleteExclusionsForUserList,
  userHasExcludedItem,
};
