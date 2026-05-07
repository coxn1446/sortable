const db = require('../db');

const LIST_FIELDS = `
  list_id,
  owner_user_id,
  title,
  description,
  is_public,
  share_slug,
  exclude_choice_label,
  created_at,
  updated_at
`;

async function createList({
  ownerUserId,
  title,
  description,
  isPublic,
  shareSlug,
  excludeChoiceLabel = null,
}) {
  const { rows } = await db.query(
    `INSERT INTO lists (owner_user_id, title, description, is_public, share_slug, exclude_choice_label)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${LIST_FIELDS}`,
    [ownerUserId, title, description || null, !!isPublic, shareSlug, excludeChoiceLabel || null]
  );
  return rows[0];
}

async function findListById(listId) {
  const { rows } = await db.query(
    `SELECT ${LIST_FIELDS} FROM lists WHERE list_id = $1`,
    [listId]
  );
  return rows[0] || null;
}

async function findListBySlug(slug) {
  const { rows } = await db.query(
    `SELECT ${LIST_FIELDS} FROM lists WHERE share_slug = $1`,
    [slug]
  );
  return rows[0] || null;
}

async function findListsForUser(userId) {
  const { rows } = await db.query(
    `SELECT l.list_id, l.owner_user_id, l.title, l.description,
            l.is_public, l.share_slug, l.exclude_choice_label, l.created_at, l.updated_at,
            COALESCE(
              (SELECT uss.is_complete
               FROM user_sort_state uss
               WHERE uss.list_id = l.list_id AND uss.user_id = $1),
              FALSE
            ) AS my_rank_complete
     FROM lists l
     LEFT JOIN list_contributors c
       ON c.list_id = l.list_id AND c.user_id = $1
     WHERE l.owner_user_id = $1 OR c.user_id IS NOT NULL
     GROUP BY l.list_id
     ORDER BY l.updated_at DESC`,
    [userId]
  );
  return rows;
}

async function findPublicLists({ limit = 24 } = {}) {
  const { rows } = await db.query(
    `SELECT ${LIST_FIELDS}
     FROM lists
     WHERE is_public = TRUE
     ORDER BY updated_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
}

async function updateList(listId, updates) {
  const keys = Object.keys(updates);
  if (keys.length === 0) return findListById(listId);
  const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
  const values = keys.map((k) => updates[k]);
  const { rows } = await db.query(
    `UPDATE lists SET ${sets}, updated_at = NOW()
     WHERE list_id = $1 RETURNING ${LIST_FIELDS}`,
    [listId, ...values]
  );
  return rows[0] || null;
}

async function deleteList(listId) {
  await db.query(`DELETE FROM lists WHERE list_id = $1`, [listId]);
}

async function addContributor({ listId, userId, role = 'contributor' }) {
  await db.query(
    `INSERT INTO list_contributors (list_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (list_id, user_id) DO NOTHING`,
    [listId, userId, role]
  );
}

async function findContributor(listId, userId) {
  const { rows } = await db.query(
    `SELECT list_id, user_id, role, joined_at
     FROM list_contributors WHERE list_id = $1 AND user_id = $2`,
    [listId, userId]
  );
  return rows[0] || null;
}

async function listContributors(listId) {
  const { rows } = await db.query(
    `SELECT c.list_id, c.user_id, c.role, c.joined_at,
            u.username, u.profile_picture
     FROM list_contributors c
     JOIN users u ON u.user_id = c.user_id
     WHERE c.list_id = $1
     ORDER BY c.joined_at ASC`,
    [listId]
  );
  return rows;
}

module.exports = {
  LIST_FIELDS,
  createList,
  findListById,
  findListBySlug,
  findListsForUser,
  findPublicLists,
  updateList,
  deleteList,
  addContributor,
  findContributor,
  listContributors,
};
