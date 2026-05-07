import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  activeModal: null,
  loading: false,
};

const globalSlice = createSlice({
  name: 'global',
  initialState,
  reducers: {
    setActiveModal: (state, action) => {
      state.activeModal = action.payload;
    },
    closeModal: (state) => {
      state.activeModal = null;
    },
    setGlobalLoading: (state, action) => {
      state.loading = action.payload;
    },
  },
});

export const { setActiveModal, closeModal, setGlobalLoading } = globalSlice.actions;

export const selectActiveModal = (state) => state.global.activeModal;
export const selectGlobalLoading = (state) => state.global.loading;

export default globalSlice.reducer;
