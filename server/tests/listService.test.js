jest.mock('../queries', () => ({
  listQueries: {
    createList: jest.fn(),
    addContributor: jest.fn(),
    findListById: jest.fn(),
    findListBySlug: jest.fn(),
    findContributor: jest.fn(),
    updateList: jest.fn(),
    deleteList: jest.fn(),
    findListsForUser: jest.fn(),
    findPublicLists: jest.fn(),
  },
  listItemQueries: {
    createItemsBulk: jest.fn(),
    createItem: jest.fn(),
    deleteItem: jest.fn(),
    findItemsForList: jest.fn(),
    findItem: jest.fn(),
    updateItem: jest.fn(),
  },
  authQueries: {},
  userQueries: {},
  comparisonQueries: {},
  rankingQueries: {},
}));

const { listQueries, listItemQueries } = require('../queries');
const listService = require('../services/listService');
const { ListServiceError } = listService;

describe('listService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createListWithItems', () => {
    test('creates list, adds owner contributor, and bulk-inserts items', async () => {
      const listRow = {
        list_id: 10,
        owner_user_id: 1,
        title: 'Test',
        description: null,
        is_public: false,
        share_slug: 'abc123',
      };

      listQueries.createList.mockResolvedValue(listRow);
      listItemQueries.createItemsBulk.mockResolvedValue([
        { item_id: 1, list_id: 10, label: 'A' },
        { item_id: 2, list_id: 10, label: 'B' },
      ]);

      const result = await listService.createListWithItems({
        ownerUserId: 1,
        title: 'Test',
        description: null,
        isPublic: false,
        items: ['A', 'B'],
      });

      expect(listQueries.createList).toHaveBeenCalled();
      expect(listQueries.addContributor).toHaveBeenCalledWith({
        listId: 10,
        userId: 1,
        role: 'owner',
      });
      expect(listItemQueries.createItemsBulk).toHaveBeenCalledWith(10, ['A', 'B']);
      expect(result.list.list_id).toBe(10);
      expect(result.items).toHaveLength(2);
    });

    test('throws when title is missing', async () => {
      await expect(
        listService.createListWithItems({
          ownerUserId: 1,
          title: '   ',
          items: [],
        })
      ).rejects.toBeInstanceOf(ListServiceError);
    });
  });

  describe('getListForViewer', () => {
    test('returns a public list without authentication', async () => {
      listQueries.findListById.mockResolvedValue({
        list_id: 1,
        is_public: true,
        owner_user_id: 99,
      });

      const list = await listService.getListForViewer({
        listId: 1,
        userId: null,
        allowPublic: true,
      });
      expect(list.list_id).toBe(1);
    });

    test('rejects unauthenticated access to private lists', async () => {
      listQueries.findListById.mockResolvedValue({
        list_id: 2,
        is_public: false,
        owner_user_id: 99,
      });

      await expect(listService.getListForViewer({ listId: 2, userId: null })).rejects.toMatchObject({
        message: 'Authentication required.',
        status: 401,
      });
    });

    test('allows the owner to view a private list', async () => {
      listQueries.findListById.mockResolvedValue({
        list_id: 3,
        is_public: false,
        owner_user_id: 5,
      });

      const list = await listService.getListForViewer({ listId: 3, userId: 5 });
      expect(list.list_id).toBe(3);
    });

    test('allows a contributor to view a private list', async () => {
      listQueries.findListById.mockResolvedValue({
        list_id: 4,
        is_public: false,
        owner_user_id: 1,
      });
      listQueries.findContributor.mockResolvedValue({ role: 'contributor' });

      const list = await listService.getListForViewer({ listId: 4, userId: 7 });
      expect(list.list_id).toBe(4);
    });
  });

  describe('patchList', () => {
    test('owner patch ignores collab_mode field', async () => {
      listQueries.findListById.mockResolvedValue({
        list_id: 1,
        owner_user_id: 5,
      });
      listQueries.updateList.mockResolvedValue({
        list_id: 1,
        title: 'Hi',
        owner_user_id: 5,
      });

      await listService.patchList({
        listId: 1,
        userId: 5,
        updates: { title: 'Hi', collab_mode: 'shared' },
      });

      expect(listQueries.updateList).toHaveBeenCalledWith(1, { title: 'Hi' });
    });

    test('rejects non-owners', async () => {
      listQueries.findListById.mockResolvedValue({
        list_id: 1,
        owner_user_id: 1,
      });

      await expect(
        listService.patchList({ listId: 1, userId: 2, updates: { title: 'Nope' } })
      ).rejects.toMatchObject({ status: 403 });
      expect(listQueries.updateList).not.toHaveBeenCalled();
    });
  });

  describe('patchItem', () => {
    test('owner can update image_url', async () => {
      listQueries.findListById.mockResolvedValue({
        list_id: 1,
        owner_user_id: 5,
      });
      listItemQueries.findItem.mockResolvedValue({
        item_id: 10,
        list_id: 1,
        label: 'A',
        image_url: null,
      });
      listItemQueries.updateItem.mockResolvedValue({
        item_id: 10,
        list_id: 1,
        label: 'A',
        image_url: 'https://example.com/a.jpg',
      });

      const item = await listService.patchItem({
        listId: 1,
        userId: 5,
        itemId: 10,
        updates: { image_url: 'https://example.com/a.jpg' },
      });

      expect(listItemQueries.updateItem).toHaveBeenCalledWith(1, 10, {
        imageUrl: 'https://example.com/a.jpg',
      });
      expect(item.image_url).toBe('https://example.com/a.jpg');
    });

    test('clears image_url when null', async () => {
      listQueries.findListById.mockResolvedValue({
        list_id: 1,
        owner_user_id: 5,
      });
      listItemQueries.findItem.mockResolvedValue({
        item_id: 10,
        list_id: 1,
        label: 'A',
        image_url: 'https://x/y.jpg',
      });
      listItemQueries.updateItem.mockResolvedValue({
        item_id: 10,
        list_id: 1,
        label: 'A',
        image_url: null,
      });

      await listService.patchItem({
        listId: 1,
        userId: 5,
        itemId: 10,
        updates: { image_url: null },
      });

      expect(listItemQueries.updateItem).toHaveBeenCalledWith(1, 10, { imageUrl: null });
    });

    test('rejects non-owners', async () => {
      listQueries.findListById.mockResolvedValue({
        list_id: 1,
        owner_user_id: 1,
      });

      await expect(
        listService.patchItem({
          listId: 1,
          userId: 2,
          itemId: 10,
          updates: { image_url: 'https://z' },
        })
      ).rejects.toMatchObject({ status: 403 });
      expect(listItemQueries.updateItem).not.toHaveBeenCalled();
    });

    test('throws when option is missing', async () => {
      listQueries.findListById.mockResolvedValue({
        list_id: 1,
        owner_user_id: 5,
      });
      listItemQueries.findItem.mockResolvedValue(null);

      await expect(
        listService.patchItem({
          listId: 1,
          userId: 5,
          itemId: 99,
          updates: { image_url: 'https://z' },
        })
      ).rejects.toMatchObject({ status: 404, message: 'Option not found.' });
    });

    test('throws when no updates provided', async () => {
      listQueries.findListById.mockResolvedValue({
        list_id: 1,
        owner_user_id: 5,
      });
      listItemQueries.findItem.mockResolvedValue({
        item_id: 10,
        list_id: 1,
        label: 'A',
        image_url: null,
      });

      await expect(
        listService.patchItem({
          listId: 1,
          userId: 5,
          itemId: 10,
          updates: {},
        })
      ).rejects.toMatchObject({ message: 'No updates provided.', status: 400 });
      expect(listItemQueries.updateItem).not.toHaveBeenCalled();
    });

    test('throws when image_url has wrong type', async () => {
      listQueries.findListById.mockResolvedValue({
        list_id: 1,
        owner_user_id: 5,
      });
      listItemQueries.findItem.mockResolvedValue({
        item_id: 10,
        list_id: 1,
        label: 'A',
        image_url: null,
      });

      await expect(
        listService.patchItem({
          listId: 1,
          userId: 5,
          itemId: 10,
          updates: { image_url: 123 },
        })
      ).rejects.toMatchObject({
        message: 'image_url must be a string or null.',
        status: 400,
      });
    });

    test('throws when image_url exceeds max length', async () => {
      listQueries.findListById.mockResolvedValue({
        list_id: 1,
        owner_user_id: 5,
      });
      listItemQueries.findItem.mockResolvedValue({
        item_id: 10,
        list_id: 1,
        label: 'A',
        image_url: null,
      });

      const longUrl = `https://example.com/${'x'.repeat(2100)}`;

      await expect(
        listService.patchItem({
          listId: 1,
          userId: 5,
          itemId: 10,
          updates: { image_url: longUrl },
        })
      ).rejects.toMatchObject({
        message: expect.stringContaining('Image URL must'),
        status: 400,
      });
    });
  });
});
