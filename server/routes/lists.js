const express = require('express');
const router = express.Router();

const listService = require('../services/listService');
const comparisonService = require('../services/comparisonService');
const rankingService = require('../services/rankingService');
const comparisonQueries = require('../queries/comparisonQueries');
const { requireAuth } = require('../middleware/requireAuth');

function userId(req) {
  return req.user?.user_id || null;
}

function handleServiceError(error, next) {
  return next(error);
}

/* ---------- list collection ---------- */

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { title, description, items, is_public, exclude_choice_label } = req.body || {};
    const result = await listService.createListWithItems({
      ownerUserId: userId(req),
      title,
      description,
      isPublic: is_public,
      items,
      exclude_choice_label,
    });
    res.status(201).json(result);
  } catch (error) {
    handleServiceError(error, next);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const lists = await listService.getMyLists(userId(req));
    res.json({ lists });
  } catch (error) {
    next(error);
  }
});

router.get('/discover', async (req, res, next) => {
  try {
    const lists = await listService.getDiscoverLists();
    res.json({ lists });
  } catch (error) {
    next(error);
  }
});

router.get('/activity', requireAuth, async (req, res, next) => {
  try {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const offset = Math.max(0, Math.floor(Number(req.query.offset) || 0));
    const search = typeof req.query.q === 'string' ? req.query.q : '';
    const rows = await comparisonQueries.findRecentComparisonsForUser(userId(req), {
      limit,
      offset,
      search,
    });
    const has_more = rows.length > limit;
    const comparisons = has_more ? rows.slice(0, limit) : rows;
    res.json({ comparisons, has_more });
  } catch (error) {
    next(error);
  }
});

/* ---------- single list (auth required for private) ---------- */

router.get('/by-slug/:slug', async (req, res, next) => {
  try {
    const list = await listService.getListBySlugForViewer(req.params.slug, userId(req));
    const items = await listService.getItems(list.list_id);
    res.json({ list, items });
  } catch (error) {
    handleServiceError(error, next);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid list id' });
    const list = await listService.getListForViewer({
      listId: id,
      userId: userId(req),
      allowPublic: true,
    });
    const items = await listService.getItems(id);
    res.json({ list, items });
  } catch (error) {
    handleServiceError(error, next);
  }
});

router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const list = await listService.patchList({
      listId: id,
      userId: userId(req),
      updates: req.body || {},
    });
    res.json({ list });
  } catch (error) {
    handleServiceError(error, next);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await listService.destroyList({ listId: id, userId: userId(req) });
    res.json({ ok: true });
  } catch (error) {
    handleServiceError(error, next);
  }
});

/* ---------- items ---------- */

router.post('/:id/items', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const item = await listService.addItem({
      listId: id,
      userId: userId(req),
      label: req.body?.label,
      imageUrl: req.body?.image_url,
    });
    res.status(201).json({ item });
  } catch (error) {
    handleServiceError(error, next);
  }
});

router.patch('/:id/items/:itemId', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const itemId = Number(req.params.itemId);
    if (!Number.isInteger(itemId)) return res.status(400).json({ error: 'Invalid item id' });
    const item = await listService.patchItem({
      listId: id,
      userId: userId(req),
      itemId,
      updates: req.body || {},
    });
    res.json({ item });
  } catch (error) {
    handleServiceError(error, next);
  }
});

router.delete('/:id/items/:itemId', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const itemId = Number(req.params.itemId);
    await listService.removeItem({ listId: id, userId: userId(req), itemId });
    res.json({ ok: true });
  } catch (error) {
    handleServiceError(error, next);
  }
});

/* ---------- comparisons / ranking ---------- */

router.get('/:id/next-pair', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    // Verify viewer has access (will throw 401/403 otherwise).
    await listService.getListForViewer({
      listId: id,
      userId: userId(req),
      allowPublic: true,
    });
    const result = await comparisonService.getNextPair({
      listId: id,
      userId: userId(req),
    });
    res.json(result);
  } catch (error) {
    handleServiceError(error, next);
  }
});

router.post('/:id/comparisons', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const winnerItemId = Number(req.body?.winner_id);
    const loserItemId = Number(req.body?.loser_id);
    // Verify access first.
    await listService.getListForViewer({
      listId: id,
      userId: userId(req),
      allowPublic: true,
    });
    const result = await comparisonService.applyComparison({
      listId: id,
      userId: userId(req),
      winnerItemId,
      loserItemId,
    });
    res.json(result);
  } catch (error) {
    handleServiceError(error, next);
  }
});

router.post('/:id/my-ranking/reset', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await comparisonService.resetMyRanking({
      listId: id,
      userId: userId(req),
    });
    res.status(204).end();
  } catch (error) {
    handleServiceError(error, next);
  }
});

router.post('/:id/my-ranking/exclude', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const itemId = Number(req.body?.item_id);
    const result = await comparisonService.excludeItemFromRanking({
      listId: id,
      userId: userId(req),
      itemId,
    });
    res.json(result);
  } catch (error) {
    handleServiceError(error, next);
  }
});

router.get('/:id/ranking', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    let viewUserId = null;
    const rawView = req.query.view_user_id;
    if (rawView !== undefined && rawView !== '') {
      const n = Number(rawView);
      if (!Number.isInteger(n) || n < 1) {
        return res.status(400).json({ error: 'Invalid view_user_id' });
      }
      viewUserId = n;
    }
    await listService.getListForViewer({
      listId: id,
      userId: userId(req),
      allowPublic: true,
    });
    const ranking = await rankingService.getRanking({
      listId: id,
      userId: userId(req),
      viewUserId,
    });
    res.json(ranking);
  } catch (error) {
    handleServiceError(error, next);
  }
});

module.exports = router;
