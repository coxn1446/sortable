'use strict';

jest.mock('../queries', () => ({
  listQueries: {
    findListById: jest.fn(),
    addContributor: jest.fn(),
  },
  listItemQueries: {
    findItemsForList: jest.fn(),
    findItem: jest.fn(),
  },
  comparisonQueries: {
    findComparisonsForUser: jest.fn(),
    deleteUserComparisonsTouchingItem: jest.fn(),
  },
  rankingQueries: {
    replaceUserRanks: jest.fn(),
    upsertSortState: jest.fn(),
    getUserRanks: jest.fn(),
    getSortState: jest.fn(),
  },
  rankingExclusionQueries: {
    addExclusion: jest.fn(),
    userHasExcludedItem: jest.fn(),
    findExcludedItemIds: jest.fn(),
  },
}));

jest.mock('../db', () => ({
  query: jest.fn(),
}));

jest.mock('../services/listService', () => ({
  ListServiceError: class ListServiceError extends Error {
    constructor(message, status = 400) {
      super(message);
      this.name = 'ListServiceError';
      this.status = status;
    }
  },
  getListForViewer: jest.fn(),
}));

const adaptiveSort = require('../services/ranking/adaptiveSort');
const { getListForViewer } = require('../services/listService');
const comparisonService = require('../services/comparisonService');
const db = require('../db');
const {
  listQueries,
  listItemQueries,
  comparisonQueries,
  rankingQueries,
  rankingExclusionQueries,
} = require('../queries');

describe('comparisonService.excludeItemFromRanking', () => {
  let replaySpy;

  beforeEach(() => {
    jest.resetAllMocks();
    replaySpy = jest.spyOn(adaptiveSort, 'replay');

    getListForViewer.mockResolvedValue({ list_id: 99 });
    listItemQueries.findItem.mockResolvedValue({ item_id: 5 });
    rankingExclusionQueries.userHasExcludedItem.mockResolvedValue(false);
    rankingExclusionQueries.findExcludedItemIds.mockResolvedValue([5]);
    rankingQueries.getUserRanks.mockResolvedValue([]);
    rankingQueries.getSortState.mockResolvedValue(null);
    listItemQueries.findItemsForList.mockResolvedValue([
      { item_id: 4, label: 'A' },
      { item_id: 5, label: 'B' },
    ]);
    comparisonQueries.findComparisonsForUser.mockResolvedValue([]);
    replaySpy.mockReturnValue({
      placed: [],
      pending: null,
      lo: null,
      hi: null,
      queue: [],
      isComplete: true,
    });
    db.query.mockResolvedValue({ rows: [] });
  });

  afterEach(() => {
    replaySpy.mockRestore();
  });

  test('records exclusion, prunes comparisons, replays eligible ids, persists, rebuilds aggregate', async () => {
    await comparisonService.excludeItemFromRanking({ listId: 99, userId: 3, itemId: 5 });

    expect(listItemQueries.findItem).toHaveBeenCalledWith(99, 5);
    expect(rankingExclusionQueries.addExclusion).toHaveBeenCalledWith({
      listId: 99,
      userId: 3,
      itemId: 5,
    });
    expect(comparisonQueries.deleteUserComparisonsTouchingItem).toHaveBeenCalledWith({
      listId: 99,
      userId: 3,
      itemId: 5,
    });

    expect(replaySpy).toHaveBeenCalledWith([4], []);
    expect(rankingQueries.replaceUserRanks).toHaveBeenCalled();
    expect(rankingQueries.upsertSortState).toHaveBeenCalled();
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM item_aggregate'), [99]);
    expect(listQueries.addContributor).toHaveBeenCalledWith({ listId: 99, userId: 3 });
  });

  test('is idempotent when item already excluded', async () => {
    rankingExclusionQueries.userHasExcludedItem.mockResolvedValue(true);
    replaySpy.mockClear();

    const gn = jest.spyOn(comparisonService, 'getNextPair').mockResolvedValue({
      done: true,
      placedCount: 0,
      total: 2,
      progress: 0,
    });

    const result = await comparisonService.excludeItemFromRanking({ listId: 99, userId: 3, itemId: 5 });

    expect(result.done).toBe(true);
    gn.mockRestore();
    expect(rankingExclusionQueries.addExclusion).not.toHaveBeenCalled();
    expect(comparisonQueries.deleteUserComparisonsTouchingItem).not.toHaveBeenCalled();
    expect(replaySpy).not.toHaveBeenCalled();
    expect(db.query).not.toHaveBeenCalled();
  });

  test('throws for invalid item_id', async () => {
    await expect(
      comparisonService.excludeItemFromRanking({ listId: 99, userId: 3, itemId: 0 })
    ).rejects.toMatchObject({
      status: 400,
    });
  });

  test('throws when item is not on the list', async () => {
    listItemQueries.findItem.mockResolvedValue(null);

    await expect(
      comparisonService.excludeItemFromRanking({ listId: 99, userId: 3, itemId: 5 })
    ).rejects.toMatchObject({
      status: 404,
    });

    expect(rankingExclusionQueries.addExclusion).not.toHaveBeenCalled();
  });
});
