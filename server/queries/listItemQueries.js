const db = require('../db');

const ITEM_FIELDS = `item_id, list_id, label, image_url, created_at`;

async function createItem({ listId, label, imageUrl }) {
  const { rows } = await db.query(
    `INSERT INTO list_items (list_id, label, image_url)
     VALUES ($1, $2, $3)
     RETURNING ${ITEM_FIELDS}`,
    [listId, label, imageUrl || null]
  );
  return rows[0];
}

async function createItemsBulk(listId, labels) {
  if (!Array.isArray(labels) || labels.length === 0) return [];
  const values = [];
  const placeholders = labels
    .map((label, i) => {
      values.push(label);
      return `($1, $${i + 2})`;
    })
    .filter(Boolean);
  const { rows } = await db.query(
    `INSERT INTO list_items (list_id, label)
     VALUES ${placeholders.join(', ')}
     RETURNING ${ITEM_FIELDS}`,
    [listId, ...values]
  );
  return rows;
}

async function findItemsForList(listId) {
  const { rows } = await db.query(
    `SELECT ${ITEM_FIELDS} FROM list_items
     WHERE list_id = $1 ORDER BY item_id ASC`,
    [listId]
  );
  return rows;
}

async function findItem(listId, itemId) {
  const { rows } = await db.query(
    `SELECT ${ITEM_FIELDS} FROM list_items
     WHERE list_id = $1 AND item_id = $2`,
    [listId, itemId]
  );
  return rows[0] || null;
}

async function deleteItem(listId, itemId) {
  await db.query(
    `DELETE FROM list_items WHERE list_id = $1 AND item_id = $2`,
    [listId, itemId]
  );
}

async function updateItem(listId, itemId, patch) {
  const clauses = [];
  const vals = [];
  let idx = 1;
  if (patch.label !== undefined) {
    clauses.push(`label = $${idx++}`);
    vals.push(patch.label);
  }
  if (patch.imageUrl !== undefined) {
    clauses.push(`image_url = $${idx++}`);
    vals.push(patch.imageUrl);
  }
  if (clauses.length === 0) {
    return findItem(listId, itemId);
  }
  vals.push(listId, itemId);
  const listPlace = idx;
  const itemPlace = idx + 1;
  const { rows } = await db.query(
    `UPDATE list_items SET ${clauses.join(', ')}
     WHERE list_id = $${listPlace} AND item_id = $${itemPlace}
     RETURNING ${ITEM_FIELDS}`,
    vals
  );
  return rows[0] || null;
}

module.exports = {
  ITEM_FIELDS,
  createItem,
  createItemsBulk,
  findItemsForList,
  findItem,
  deleteItem,
  updateItem,
};
