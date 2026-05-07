jest.mock('../queries', () => ({
  listQueries: {
    findListById: jest.fn(),
    addContributor: jest.fn(),
  },
  listItemQueries: {
    findItemsForList: jest.fn(),
  },
  comparisonQueries: {
    recordComparison: jest.fn(),
    deleteComparisonsForUserList: jest.fn(),
    deleteUserComparisonsTouchingItem: jest.fn(),
    findComparisonsForUser: jest.fn(),
    findComparisonsForListOrdered: jest.fn(),
  },
  rankingQueries: {
    getUserRanks: jest.fn(),
    getSortState: jest.fn(),
    replaceUserRanks: jest.fn(),
    upsertSortState: jest.fn(),
    ensureAggregateRow: jest.fn(),
    getAggregate: jest.fn(),
    updateAggregate: jest.fn(),
    deleteUserRankingForList: jest.fn(),
    resetAggregateForList: jest.fn(),
    getAggregateRanking: jest.fn(),
  },
  rankingExclusionQueries: {
    findExcludedItemIds: jest.fn(),
    deleteExclusionsForUserList: jest.fn(),
    addExclusion: jest.fn(),
    userHasExcludedItem: jest.fn(),
  },
}));

jest.mock('../db', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}));

jest.mock('../services/listService', () => ({
  ListServiceError: class ListServiceError extends Error {
    constructor(message, status = 400) {
      super(message);
      this.status = status;
    }
  },
  getListForViewer: jest.fn(),
}));

const db = require('../db');
const { getListForViewer } = require('../services/listService');
const comparisonService = require('../services/comparisonService');

describe('comparisonService.resetMyRanking', () => {
  let clientQuery;
  let release;

  beforeEach(() => {
    jest.resetAllMocks();
    getListForViewer.mockResolvedValue({ list_id: 1 });

    clientQuery = jest.fn();
    release = jest.fn();

    clientQuery.mockImplementation(async (sql) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
      if (typeof sql === 'string' && sql.includes('FROM comparisons')) {
        return { rows: [] };
      }
      if (typeof sql === 'string' && sql.includes('FROM item_aggregate')) {
        return {
          rows: [{ elo_rating: '1500', match_count: '0', win_count: '0' }],
        };
      }
      return { rows: [] };
    });

    db.getClient.mockResolvedValue({
      query: clientQuery,
      release,
    });
  });

  test('runs transactional delete + aggregate rebuild', async () => {
    await comparisonService.resetMyRanking({ listId: 10, userId: 3 });

    expect(getListForViewer).toHaveBeenCalledWith({
      listId: 10,
      userId: 3,
      allowPublic: true,
    });
    expect(db.getClient).toHaveBeenCalled();
    expect(clientQuery).toHaveBeenCalledWith('BEGIN');
    expect(clientQuery).toHaveBeenCalledWith(`DELETE FROM comparisons WHERE list_id = $1 AND user_id = $2`, [
      10,
      3,
    ]);
    expect(clientQuery).toHaveBeenCalledWith(
      `DELETE FROM user_list_item_exclusions WHERE list_id = $1 AND user_id = $2`,
      [10, 3]
    );
    expect(clientQuery).toHaveBeenCalledWith(`DELETE FROM user_item_ranks WHERE list_id = $1 AND user_id = $2`, [
      10,
      3,
    ]);
    expect(clientQuery).toHaveBeenCalledWith(`DELETE FROM user_sort_state WHERE list_id = $1 AND user_id = $2`, [
      10,
      3,
    ]);
    expect(clientQuery).toHaveBeenCalledWith(`DELETE FROM item_aggregate WHERE list_id = $1`, [10]);
    expect(clientQuery).toHaveBeenCalledWith('COMMIT');
    expect(release).toHaveBeenCalled();
  });

  test('rolls back and releases client when rebuild fails', async () => {
    clientQuery.mockImplementation(async (sql) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [] };
      if (typeof sql === 'string' && sql.includes('DELETE FROM item_aggregate')) {
        throw new Error('boom');
      }
      return { rows: [] };
    });

    await expect(comparisonService.resetMyRanking({ listId: 10, userId: 3 })).rejects.toThrow('boom');
    expect(clientQuery).toHaveBeenCalledWith('ROLLBACK');
    expect(release).toHaveBeenCalled();
  });

  test('surface access errors from getListForViewer', async () => {
    getListForViewer.mockRejectedValue(new Error('nope'));

    await expect(comparisonService.resetMyRanking({ listId: 10, userId: 3 })).rejects.toThrow('nope');
    expect(db.getClient).not.toHaveBeenCalled();
  });
});
