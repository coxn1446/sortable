const crypto = require('crypto');
const {
  listQueries,
  listItemQueries,
} = require('../queries');

const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 1000;
const MAX_LABEL_LENGTH = 200;
const MAX_IMAGE_URL_LENGTH = 2048;
const MAX_ITEMS_AT_CREATION = 200;
const MAX_EXCLUDE_CHOICE_LABEL = 50;
const SLUG_RETRY = 5;

class ListServiceError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'ListServiceError';
    this.status = status;
  }
}

function generateSlug() {
  // Roughly 40 bits of entropy, base36; collision-resistant for our scale.
  return crypto.randomBytes(6).toString('hex');
}

function sanitizeListInput({ title, description, isPublic }) {
  if (typeof title !== 'string' || !title.trim()) {
    throw new ListServiceError('Title is required.', 400);
  }
  if (title.length > MAX_TITLE_LENGTH) {
    throw new ListServiceError(`Title must be ${MAX_TITLE_LENGTH} characters or fewer.`, 400);
  }
  if (description != null && description.length > MAX_DESCRIPTION_LENGTH) {
    throw new ListServiceError(
      `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`,
      400
    );
  }
  return {
    title: title.trim(),
    description: description ? description.trim() : null,
    isPublic: !!isPublic,
  };
}

function sanitizeExcludeChoiceLabel(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw !== 'string') {
    throw new ListServiceError('exclude_choice_label must be a string.', 400);
  }
  const t = raw.trim();
  if (!t) return null;
  if (t.length > MAX_EXCLUDE_CHOICE_LABEL) {
    throw new ListServiceError(
      `exclude_choice_label must be ${MAX_EXCLUDE_CHOICE_LABEL} characters or fewer.`,
      400
    );
  }
  return t;
}

function sanitizeItemLabels(items) {
  if (!Array.isArray(items)) return [];
  const labels = items
    .map((raw) => {
      if (typeof raw === 'string') return raw.trim();
      if (raw && typeof raw.label === 'string') return raw.label.trim();
      return '';
    })
    .filter(Boolean);
  if (labels.length > MAX_ITEMS_AT_CREATION) {
    throw new ListServiceError(
      `Lists are limited to ${MAX_ITEMS_AT_CREATION} items at creation.`,
      400
    );
  }
  for (const label of labels) {
    if (label.length > MAX_LABEL_LENGTH) {
      throw new ListServiceError(
        `Item labels must be ${MAX_LABEL_LENGTH} characters or fewer.`,
        400
      );
    }
  }
  return labels;
}

async function createListWithItems({
  ownerUserId,
  title,
  description,
  isPublic,
  items,
  exclude_choice_label,
}) {
  const sanitized = sanitizeListInput({ title, description, isPublic });
  const labels = sanitizeItemLabels(items);
  const excludeLabel = sanitizeExcludeChoiceLabel(exclude_choice_label);

  let list = null;
  for (let attempt = 0; attempt < SLUG_RETRY && !list; attempt++) {
    const shareSlug = generateSlug();
    try {
      list = await listQueries.createList({
        ownerUserId,
        title: sanitized.title,
        description: sanitized.description,
        isPublic: sanitized.isPublic,
        shareSlug,
        excludeChoiceLabel: excludeLabel,
      });
    } catch (error) {
      if (error.code === '23505' && attempt < SLUG_RETRY - 1) {
        // unique violation on share_slug; retry
        continue;
      }
      throw error;
    }
  }
  if (!list) {
    throw new ListServiceError('Could not allocate a unique share slug.', 500);
  }

  await listQueries.addContributor({
    listId: list.list_id,
    userId: ownerUserId,
    role: 'owner',
  });

  let createdItems = [];
  if (labels.length > 0) {
    createdItems = await listItemQueries.createItemsBulk(list.list_id, labels);
  }

  return { list, items: createdItems };
}

async function getListForViewer({ listId, userId, allowPublic = true }) {
  const list = await listQueries.findListById(listId);
  if (!list) throw new ListServiceError('List not found.', 404);
  if (list.is_public && allowPublic) return list;
  if (!userId) throw new ListServiceError('Authentication required.', 401);
  if (list.owner_user_id === userId) return list;
  const contributor = await listQueries.findContributor(listId, userId);
  if (contributor) return list;
  throw new ListServiceError('You do not have access to this list.', 403);
}

async function getListBySlugForViewer(slug, userId) {
  const list = await listQueries.findListBySlug(slug);
  if (!list) throw new ListServiceError('List not found.', 404);
  if (list.is_public) return list;
  if (!userId) throw new ListServiceError('Authentication required.', 401);
  if (list.owner_user_id === userId) return list;
  const contributor = await listQueries.findContributor(list.list_id, userId);
  if (contributor) return list;
  throw new ListServiceError('You do not have access to this list.', 403);
}

async function ensureOwner(listId, userId) {
  const list = await listQueries.findListById(listId);
  if (!list) throw new ListServiceError('List not found.', 404);
  if (list.owner_user_id !== userId) {
    throw new ListServiceError('Only the owner can modify this list.', 403);
  }
  return list;
}

async function patchList({ listId, userId, updates }) {
  await ensureOwner(listId, userId);
  const allowed = {};
  if (updates.title !== undefined) {
    if (typeof updates.title !== 'string' || !updates.title.trim()) {
      throw new ListServiceError('Title is required.', 400);
    }
    allowed.title = updates.title.trim().slice(0, MAX_TITLE_LENGTH);
  }
  if (updates.description !== undefined) {
    allowed.description = updates.description ? String(updates.description).trim() : null;
  }
  if (updates.is_public !== undefined) {
    allowed.is_public = !!updates.is_public;
  }
  if (updates.exclude_choice_label !== undefined) {
    allowed.exclude_choice_label = sanitizeExcludeChoiceLabel(updates.exclude_choice_label);
    if (!allowed.exclude_choice_label) {
      allowed.exclude_choice_label = null;
    }
  }
  return listQueries.updateList(listId, allowed);
}

async function destroyList({ listId, userId }) {
  await ensureOwner(listId, userId);
  await listQueries.deleteList(listId);
}

async function addItem({ listId, userId, label, imageUrl }) {
  await ensureOwner(listId, userId);
  if (typeof label !== 'string' || !label.trim()) {
    throw new ListServiceError('Item label is required.', 400);
  }
  return listItemQueries.createItem({
    listId,
    label: label.trim().slice(0, MAX_LABEL_LENGTH),
    imageUrl: imageUrl || null,
  });
}

function sanitizeItemImageUrl(raw) {
  if (raw === undefined) return undefined;
  if (raw === null || raw === '') return null;
  if (typeof raw !== 'string') {
    throw new ListServiceError('image_url must be a string or null.', 400);
  }
  const url = raw.trim();
  if (!url) return null;
  if (url.length > MAX_IMAGE_URL_LENGTH) {
    throw new ListServiceError(`Image URL must be ${MAX_IMAGE_URL_LENGTH} characters or fewer.`, 400);
  }
  return url;
}

async function patchItem({ listId, userId, itemId, updates }) {
  await ensureOwner(listId, userId);
  const existing = await listItemQueries.findItem(listId, itemId);
  if (!existing) throw new ListServiceError('Option not found.', 404);

  const patch = {};
  if (updates.label !== undefined) {
    if (typeof updates.label !== 'string' || !updates.label.trim()) {
      throw new ListServiceError('Item label is required.', 400);
    }
    patch.label = updates.label.trim().slice(0, MAX_LABEL_LENGTH);
  }
  if (updates.image_url !== undefined) {
    patch.imageUrl = sanitizeItemImageUrl(updates.image_url);
  }
  if (Object.keys(patch).length === 0) {
    throw new ListServiceError('No updates provided.', 400);
  }
  return listItemQueries.updateItem(listId, itemId, patch);
}

async function removeItem({ listId, userId, itemId }) {
  await ensureOwner(listId, userId);
  await listItemQueries.deleteItem(listId, itemId);
}

async function getMyLists(userId) {
  return listQueries.findListsForUser(userId);
}

async function getDiscoverLists() {
  return listQueries.findPublicLists({ limit: 24 });
}

async function getItems(listId) {
  return listItemQueries.findItemsForList(listId);
}

module.exports = {
  ListServiceError,
  createListWithItems,
  getListForViewer,
  getListBySlugForViewer,
  ensureOwner,
  patchList,
  destroyList,
  addItem,
  patchItem,
  removeItem,
  getMyLists,
  getDiscoverLists,
  getItems,
};
