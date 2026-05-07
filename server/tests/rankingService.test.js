jest.mock('../queries', () => ({
  listQueries: {
    findListById: jest.fn(),
  },
  listItemQueries: {
    findItemsForList: jest.fn(),
  },
  rankingQueries: {
    getAggregateRanking: jest.fn(),
    getUserRanks: jest.fn(),
    getSortState: jest.fn(),
    listRankingParticipants: jest.fn(),
  },
  rankingExclusionQueries: {
    findExcludedItemIds: jest.fn(),
  },
}));

const { listQueries, listItemQueries, rankingQueries, rankingExclusionQueries } = require('../queries');
const rankingService = require('../services/rankingService');

describe('rankingService', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    rankingExclusionQueries.findExcludedItemIds.mockResolvedValue([]);
  });

  test('getRanking includes participants for an authenticated viewer', async () => {
    listQueries.findListById.mockResolvedValue({
      list_id: 3,
    });
    listItemQueries.findItemsForList.mockResolvedValue([
      { item_id: 1, label: 'A', image_url: null },
      { item_id: 2, label: 'B', image_url: null },
    ]);
    rankingQueries.getAggregateRanking.mockResolvedValue([
      {
        item_id: 1,
        label: 'A',
        image_url: null,
        elo_rating: 1600,
        match_count: 2,
        win_count: 2,
      },
    ]);
    rankingQueries.getUserRanks.mockResolvedValue([
      { item_id: 1, position: 1 },
      { item_id: 2, position: 2 },
    ]);
    rankingQueries.getSortState.mockResolvedValue({ is_complete: true });
    rankingQueries.listRankingParticipants.mockResolvedValue([
      { user_id: 7, username: 'pat', is_finalized: true },
    ]);

    const result = await rankingService.getRanking({ listId: 3, userId: 5, viewUserId: null });

    expect(result.participants).toHaveLength(1);
    expect(result.is_finalized).toBe(true);
    expect(result.personal).toHaveLength(2);
    expect(result).not.toHaveProperty('collab_mode');
    expect(rankingQueries.listRankingParticipants).toHaveBeenCalledWith(3);
  });

  test('getRanking is not finalized when sort state says complete but list gained new items', async () => {
    listQueries.findListById.mockResolvedValue({
      list_id: 3,
    });
    listItemQueries.findItemsForList.mockResolvedValue([
      { item_id: 1, label: 'A', image_url: null },
      { item_id: 2, label: 'B', image_url: null },
      { item_id: 3, label: 'C', image_url: null },
    ]);
    rankingQueries.getAggregateRanking.mockResolvedValue([]);
    rankingQueries.getUserRanks.mockResolvedValue([
      { item_id: 1, position: 1 },
      { item_id: 2, position: 2 },
    ]);
    rankingQueries.getSortState.mockResolvedValue({ is_complete: true });
    rankingQueries.listRankingParticipants.mockResolvedValue([]);

    const result = await rankingService.getRanking({ listId: 3, userId: 5, viewUserId: null });

    expect(result.is_finalized).toBe(false);
    expect(result.personal).toHaveLength(2);
  });

  test('getRanking is finalized when some items are excluded from personal ranking', async () => {
    listQueries.findListById.mockResolvedValue({
      list_id: 3,
    });
    listItemQueries.findItemsForList.mockResolvedValue([
      { item_id: 1, label: 'A', image_url: null },
      { item_id: 2, label: 'B', image_url: null },
    ]);
    rankingQueries.getAggregateRanking.mockResolvedValue([]);
    rankingQueries.getUserRanks.mockResolvedValue([{ item_id: 2, position: 1 }]);
    rankingQueries.getSortState.mockResolvedValue({ is_complete: true });
    rankingQueries.listRankingParticipants.mockResolvedValue([]);
    rankingExclusionQueries.findExcludedItemIds.mockResolvedValue([1]);

    const result = await rankingService.getRanking({ listId: 3, userId: 5, viewUserId: null });

    expect(result.is_finalized).toBe(true);
    expect(result.personal).toHaveLength(1);
    expect(result.personal[0]).toEqual(expect.objectContaining({ id: 2 }));
  });

  test('getRanking rejects view_user_id for anonymous viewers', async () => {
    listQueries.findListById.mockResolvedValue({
      list_id: 3,
    });
    listItemQueries.findItemsForList.mockResolvedValue([
      { item_id: 1, label: 'A', image_url: null },
    ]);
    rankingQueries.getAggregateRanking.mockResolvedValue([]);

    await expect(
      rankingService.getRanking({ listId: 3, userId: null, viewUserId: 9 })
    ).rejects.toMatchObject({ status: 401 });
  });

  test('getRanking rejects view_user_id when that user has no ranks on the list', async () => {
    listQueries.findListById.mockResolvedValue({
      list_id: 3,
    });
    listItemQueries.findItemsForList.mockResolvedValue([
      { item_id: 1, label: 'A', image_url: null },
    ]);
    rankingQueries.getAggregateRanking.mockResolvedValue([]);
    rankingQueries.listRankingParticipants.mockResolvedValue([
      { user_id: 7, username: 'pat', is_finalized: false },
    ]);

    await expect(
      rankingService.getRanking({ listId: 3, userId: 5, viewUserId: 99 })
    ).rejects.toMatchObject({ status: 404 });
  });

  test('getRanking returns viewed_personal when view_user_id is allowed', async () => {
    listQueries.findListById.mockResolvedValue({
      list_id: 3,
    });
    listItemQueries.findItemsForList.mockResolvedValue([
      { item_id: 1, label: 'A', image_url: null },
      { item_id: 2, label: 'B', image_url: null },
    ]);
    rankingQueries.getAggregateRanking.mockResolvedValue([]);
    rankingQueries.getUserRanks.mockImplementation((_listId, uid) => {
      if (uid === 5) return Promise.resolve([]);
      if (uid === 7)
        return Promise.resolve([
          { item_id: 2, position: 1 },
          { item_id: 1, position: 2 },
        ]);
      return Promise.resolve([]);
    });
    rankingQueries.getSortState.mockImplementation((_listId, uid) => {
      if (uid === 5) return Promise.resolve(null);
      return Promise.resolve({ is_complete: true });
    });
    rankingQueries.listRankingParticipants.mockResolvedValue([
      { user_id: 7, username: 'pat', is_finalized: true },
    ]);

    const result = await rankingService.getRanking({ listId: 3, userId: 5, viewUserId: 7 });

    expect(result.viewed_user_id).toBe(7);
    expect(result.viewed_personal).toEqual([
      expect.objectContaining({ id: 2, rank: 1, label: 'B' }),
      expect.objectContaining({ id: 1, rank: 2, label: 'A' }),
    ]);
  });
});
