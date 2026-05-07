import { createSlice, createSelector } from '@reduxjs/toolkit';

const initialState = {
  byId: {},
  myListIds: [],
  discoverIds: [],
  itemsByListId: {},
  pairByListId: {},
  rankingByListId: {},
  loading: {
    me: false,
    discover: false,
  },
};

const listsSlice = createSlice({
  name: 'lists',
  initialState,
  reducers: {
    setMyLists(state, action) {
      const lists = action.payload || [];
      state.myListIds = lists.map((l) => l.list_id);
      lists.forEach((l) => {
        state.byId[l.list_id] = { ...state.byId[l.list_id], ...l };
      });
    },
    setDiscoverLists(state, action) {
      const lists = action.payload || [];
      state.discoverIds = lists.map((l) => l.list_id);
      lists.forEach((l) => {
        state.byId[l.list_id] = { ...state.byId[l.list_id], ...l };
      });
    },
    setList(state, action) {
      const { list, items } = action.payload;
      if (list) {
        state.byId[list.list_id] = { ...state.byId[list.list_id], ...list };
      }
      if (Array.isArray(items) && list) {
        state.itemsByListId[list.list_id] = items;
      }
    },
    setPair(state, action) {
      const { listId, pair } = action.payload;
      state.pairByListId[listId] = pair;
    },
    setRanking(state, action) {
      const { listId, ranking } = action.payload;
      state.rankingByListId[listId] = ranking;
    },
    removeList(state, action) {
      const id = action.payload;
      delete state.byId[id];
      delete state.itemsByListId[id];
      delete state.pairByListId[id];
      delete state.rankingByListId[id];
      state.myListIds = state.myListIds.filter((x) => x !== id);
      state.discoverIds = state.discoverIds.filter((x) => x !== id);
    },
    setLoading(state, action) {
      const { key, value } = action.payload;
      state.loading[key] = !!value;
    },
    resetLists() {
      return initialState;
    },
  },
});

export const {
  setMyLists,
  setDiscoverLists,
  setList,
  setPair,
  setRanking,
  removeList,
  setLoading,
  resetLists,
} = listsSlice.actions;

export const selectMyLists = createSelector(
  [(state) => state.lists.myListIds, (state) => state.lists.byId],
  (myListIds, byId) => myListIds.map((id) => byId[id]).filter(Boolean)
);

export const selectDiscoverLists = createSelector(
  [(state) => state.lists.discoverIds, (state) => state.lists.byId],
  (discoverIds, byId) => discoverIds.map((id) => byId[id]).filter(Boolean)
);

export const selectListById = (id) => (state) => state.lists.byId[id] || null;

export const selectItemsByListId = (id) => (state) =>
  state.lists.itemsByListId[id] || [];

export const selectPairByListId = (id) => (state) =>
  state.lists.pairByListId[id] || null;

export const selectRankingByListId = (id) => (state) =>
  state.lists.rankingByListId[id] || null;

export default listsSlice.reducer;
