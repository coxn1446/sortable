import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';

import authReducer from '../store/auth.reducer';
import globalReducer from '../store/global.reducer';
import nativeReducer from '../store/native.reducer';
import listsReducer from '../store/lists.reducer';
import { ComparePanel } from '../routes/Compare';
import * as listHelpers from '../helpers/listHelpers';
import * as comparisonHelpers from '../helpers/comparisonHelpers';

jest.mock('../helpers/listHelpers');
jest.mock('../helpers/comparisonHelpers', () => ({
  fetchNextPair: jest.fn(),
  recordComparison: jest.fn(),
  resetMyRanking: jest.fn(),
  excludeItemFromRanking: jest.fn(),
}));
jest.mock('react-hot-toast', () => ({ error: jest.fn(), success: jest.fn() }));

jest.mock('../utils/NativeContext', () => ({
  useNative: () => ({ isNative: false }),
}));

const routerFutureFlags = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
};

const buildStore = () =>
  configureStore({
    reducer: {
      auth: authReducer,
      global: globalReducer,
      native: nativeReducer,
      lists: listsReducer,
    },
  });

describe('Compare', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listHelpers.fetchListById.mockResolvedValue({
      list: {
        list_id: 1,
        title: 'Demo',
        is_public: true,
        exclude_choice_label: 'Skip',
      },
      items: [],
    });
    comparisonHelpers.fetchNextPair.mockResolvedValue({
      a: { item_id: 10, label: 'Alpha' },
      b: { item_id: 20, label: 'Beta' },
      total: 5,
      placedCount: 2,
      done: false,
    });
    comparisonHelpers.recordComparison.mockResolvedValue({
      a: { item_id: 30, label: 'Gamma' },
      b: { item_id: 40, label: 'Delta' },
      total: 5,
      placedCount: 3,
      done: false,
    });
    comparisonHelpers.resetMyRanking.mockResolvedValue(null);
    comparisonHelpers.excludeItemFromRanking.mockResolvedValue({
      a: { item_id: 30, label: 'Gamma' },
      b: { item_id: 40, label: 'Delta' },
      total: 5,
      placedCount: 3,
      done: false,
    });
  });

  test('records a comparison when the user picks the left card', async () => {
    const user = userEvent.setup();
    const store = buildStore();

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/x']} future={routerFutureFlags}>
          <Routes>
            <Route path="/x" element={<ComparePanel listId={1} />} />
          </Routes>
        </MemoryRouter>
      </Provider>
    );

    expect(await screen.findByLabelText(/Choose Alpha/i)).toBeInTheDocument();

    await user.click(screen.getByLabelText(/Choose Alpha/i));

    await waitFor(() => {
      expect(comparisonHelpers.recordComparison).toHaveBeenCalledWith(1, {
        winnerId: 10,
        loserId: 20,
      });
    });

    expect(await screen.findByLabelText(/Choose Gamma/i)).toBeInTheDocument();
  });

  test('calls excludeItemFromRanking when user clicks the skip control', async () => {
    const user = userEvent.setup();
    const store = buildStore();

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/x']} future={routerFutureFlags}>
          <Routes>
            <Route path="/x" element={<ComparePanel listId={1} />} />
          </Routes>
        </MemoryRouter>
      </Provider>
    );

    const skipButtons = await screen.findAllByRole('button', { name: 'Skip' });
    expect(skipButtons.length).toBe(2);

    await user.click(skipButtons[0]);

    await waitFor(() => {
      expect(comparisonHelpers.excludeItemFromRanking).toHaveBeenCalledWith(1, 10);
    });
  });

  test('with ?reset=1 shows a warning modal before calling resetMyRanking', async () => {
    const user = userEvent.setup();
    const toastMod = require('react-hot-toast');
    const store = buildStore();

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/x?reset=1']} future={routerFutureFlags}>
          <Routes>
            <Route path="/x" element={<ComparePanel listId={1} />} />
          </Routes>
        </MemoryRouter>
      </Provider>
    );

    await screen.findByRole('heading', { name: /Reset your choices/i });

    expect(comparisonHelpers.resetMyRanking).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /Reset anyway/i }));

    await waitFor(() => {
      expect(comparisonHelpers.resetMyRanking).toHaveBeenCalledWith(1);
    });

    await waitFor(() => {
      expect(comparisonHelpers.fetchNextPair).toHaveBeenCalled();
    });

    expect(toastMod.success).toHaveBeenCalled();
  });

  test('with ?reset=1, Cancel closes the modal without resetting', async () => {
    const user = userEvent.setup();
    const store = buildStore();

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/x?reset=1']} future={routerFutureFlags}>
          <Routes>
            <Route path="/x" element={<ComparePanel listId={1} />} />
          </Routes>
        </MemoryRouter>
      </Provider>
    );

    await screen.findByRole('heading', { name: /Reset your choices/i });

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Reset your choices/i })).not.toBeInTheDocument();
    });

    expect(comparisonHelpers.resetMyRanking).not.toHaveBeenCalled();
  });
});
