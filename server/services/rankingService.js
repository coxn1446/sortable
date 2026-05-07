const { listQueries, listItemQueries, rankingQueries, rankingExclusionQueries } = require('../queries');

function buildPersonalRanking(rows, sortStateRow, itemMap, listItems = [], exclusionItemIds = []) {
  const exclusionSet = new Set((exclusionItemIds ?? []).map(Number));

  const rowsFiltered = (rows ?? []).filter((r) => !exclusionSet.has(Number(r.item_id)));

  if (!rowsFiltered?.length) {
    return { personal: null, isFinalized: false };
  }

  const rankedItemIds = new Set(rowsFiltered.map((r) => r.item_id));
  const catalog = listItems?.length ? listItems : [...itemMap.values()];
  const catalogEligible = catalog.filter((it) => !exclusionSet.has(it.item_id));

  const everyEligibleItemRanked =
    catalogEligible.length === 0 || catalogEligible.every((it) => rankedItemIds.has(it.item_id));
  const isFinalized = !!(sortStateRow?.is_complete && everyEligibleItemRanked);

  const personal = rowsFiltered
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((r) => {
      const item = itemMap.get(r.item_id);
      return {
        rank: r.position,
        id: r.item_id,
        label: item?.label,
        image_url: item?.image_url,
        is_finalized: isFinalized,
      };
    });
  return { personal, isFinalized };
}

async function getRanking({ listId, userId, viewUserId = null }) {
  const list = await listQueries.findListById(listId);
  if (!list) throw Object.assign(new Error('List not found.'), { status: 404 });

  const items = await listItemQueries.findItemsForList(listId);
  const itemMap = new Map(items.map((i) => [i.item_id, i]));

  const aggregate = await rankingQueries.getAggregateRanking(listId);
  let aggregateRanking = aggregate.map((row, idx) => ({
    rank: idx + 1,
    id: row.item_id,
    label: row.label,
    image_url: row.image_url,
    elo_rating: Number(row.elo_rating),
    match_count: Number(row.match_count),
    win_count: Number(row.win_count),
  }));

  const seen = new Set(aggregateRanking.map((r) => r.id));
  let nextRank = aggregateRanking.length + 1;
  for (const item of items) {
    if (!seen.has(item.item_id)) {
      aggregateRanking.push({
        rank: nextRank++,
        id: item.item_id,
        label: item.label,
        image_url: item.image_url,
        elo_rating: 1500,
        match_count: 0,
        win_count: 0,
      });
    }
  }

  let personal = null;
  let isFinalized = false;
  if (userId) {
    const ranks = await rankingQueries.getUserRanks(listId, userId);
    const sortState = await rankingQueries.getSortState(listId, userId);
    const exclusionIds = await rankingExclusionQueries.findExcludedItemIds(listId, userId);
    const built = buildPersonalRanking(ranks, sortState, itemMap, items, exclusionIds);
    personal = built.personal;
    isFinalized = built.isFinalized;
  }

  const participants = userId != null ? await rankingQueries.listRankingParticipants(listId) : [];

  let viewedPersonal = null;
  let resolvedViewUserId = null;
  if (viewUserId != null) {
    if (!userId) {
      throw Object.assign(new Error('Authentication required.'), { status: 401 });
    }
    if (!Number.isInteger(viewUserId) || viewUserId < 1) {
      throw Object.assign(new Error('Invalid view_user_id.'), { status: 400 });
    }
    const allowed = participants.some((p) => Number(p.user_id) === viewUserId);
    if (!allowed) {
      throw Object.assign(new Error('No ranking for that participant.'), { status: 404 });
    }
    const rows = await rankingQueries.getUserRanks(listId, viewUserId);
    const viewedSortState = await rankingQueries.getSortState(listId, viewUserId);
    const viewedExclusions = await rankingExclusionQueries.findExcludedItemIds(listId, viewUserId);
    const viewed = buildPersonalRanking(rows, viewedSortState, itemMap, items, viewedExclusions);
    viewedPersonal = viewed.personal;
    resolvedViewUserId = viewUserId;
  }

  return {
    list_id: list.list_id,
    aggregate: aggregateRanking,
    personal,
    is_finalized: isFinalized,
    participants,
    viewed_personal: viewedPersonal,
    viewed_user_id: resolvedViewUserId,
  };
}

module.exports = { getRanking };
