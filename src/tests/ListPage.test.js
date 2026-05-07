import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';

import authReducer from '../store/auth.reducer';
import globalReducer from '../store/global.reducer';
import nativeReducer from '../store/native.reducer';
import listsReducer from '../store/lists.reducer';
import ListPage from '../routes/ListPage';
import * as listHelpers from '../helpers/listHelpers';
import * as rankingHelpers from '../helpers/rankingHelpers';
import * as comparisonHelpers from '../helpers/comparisonHelpers';
import * as uploadHelpers from '../helpers/uploadHelpers';

jest.mock('../helpers/listHelpers');
jest.mock('../helpers/rankingHelpers');
jest.mock('../helpers/uploadHelpers', () => ({
  uploadPublicImage: jest.fn(),
}));
jest.mock('../helpers/comparisonHelpers', () => ({
  fetchNextPair: jest.fn(),
  recordComparison: jest.fn(),
  resetMyRanking: jest.fn(),
}));
jest.mock('react-hot-toast', () => ({ error: jest.fn(), success: jest.fn() }));
jest.mock('../utils/NativeContext', () => ({
  useNative: () => ({ isNative: false }),
}));

const routerFutureFlags = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
};

const mockListDetail = (overrides = {}) => ({
  list: {
    list_id: 7,
    title: 'Snack bracket',
    description: null,
    owner_user_id: 100,
    is_public: true,
    share_slug: 'sn7',
    ...overrides.list,
  },
  items:
    overrides.items ?? [
      { item_id: 1, list_id: 7, label: 'A' },
      { item_id: 2, list_id: 7, label: 'B' },
    ],
});

function renderWithRouter(initialEntry, authState) {
  const store = configureStore({
    reducer: {
      auth: authReducer,
      global: globalReducer,
      native: nativeReducer,
      lists: listsReducer,
    },
    preloadedState: {
      auth:
        authState || {
          user: { user_id: 100, username: 'owner' },
          isAuthenticated: true,
          loading: false,
        },
    },
  });

  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[initialEntry]} future={routerFutureFlags}>
        <Routes>
          <Route path="/list/:listKey/*" element={<ListPage />} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );
}

describe('ListPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listHelpers.fetchListByKey.mockResolvedValue(mockListDetail());
    rankingHelpers.fetchRanking.mockResolvedValue({
      aggregate: [{ rank: 1, id: 1, label: 'A', elo_rating: 1500 }],
      personal: [{ rank: 1, id: 1, label: 'A' }],
      is_finalized: true,
      participants: [{ user_id: 100, username: 'owner', is_finalized: true }],
    });
    comparisonHelpers.fetchNextPair.mockResolvedValue({
      done: true,
      placedCount: 2,
      total: 2,
      progress: 1,
    });
    listHelpers.updateList.mockResolvedValue({ list: mockListDetail().list });
    listHelpers.removeItem.mockResolvedValue(undefined);
    listHelpers.patchItem.mockResolvedValue({
      item: { item_id: 1, list_id: 7, label: 'A', image_url: 'https://example.com/a.jpg' },
    });
    listHelpers.deleteList.mockResolvedValue({ ok: true });
    uploadHelpers.uploadPublicImage.mockResolvedValue('https://cdn.example.com/up.jpg');
  });

  test('shows Choose / Results / Settings sub-navigation for the owner', async () => {
    renderWithRouter('/list/7');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Snack bracket' })).toBeInTheDocument();
    });

    expect(screen.getByRole('navigation', { name: /list sections/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Choose' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Results' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument();
  });

  test('hides Settings for non-owners', async () => {
    renderWithRouter('/list/7', {
      user: { user_id: 2, username: 'guest' },
      isAuthenticated: true,
      loading: false,
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Snack bracket' })).toBeInTheDocument();
    });

    expect(screen.queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument();
  });

  test('Choose tab shows inline gradient sign-in control for guests when the list has at least two options', async () => {
    rankingHelpers.fetchRanking.mockResolvedValue({
      aggregate: [],
      personal: [],
      is_finalized: false,
      participants: [],
    });

    renderWithRouter('/list/7', {
      user: null,
      isAuthenticated: false,
      loading: false,
    });

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Sign In' })).toBeInTheDocument();
    });

    expect(screen.getByRole('link', { name: 'Sign In' })).toHaveAttribute(
      'href',
      expect.stringContaining('/login?next=')
    );
    expect(screen.getByText(/to build your ranking on this list/i)).toBeInTheDocument();
  });

  test('Choose tab hides guest sign-in CTA when the list has fewer than two options', async () => {
    rankingHelpers.fetchRanking.mockResolvedValue({
      aggregate: [],
      personal: [],
      is_finalized: false,
      participants: [],
    });
    listHelpers.fetchListByKey.mockResolvedValue(
      mockListDetail({
        items: [{ item_id: 1, list_id: 7, label: 'Only' }],
      })
    );

    renderWithRouter('/list/7', {
      user: null,
      isAuthenticated: false,
      loading: false,
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Snack bracket' })).toBeInTheDocument();
    });

    expect(screen.queryByRole('link', { name: 'Sign In' })).not.toBeInTheDocument();
  });

  test('Choose tab shows View Results and Reset Choices when ranking is complete', async () => {
    renderWithRouter('/list/7');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'View Results' })).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Reset Choices' })).toBeInTheDocument();
  });

  test('View Results navigates to Results tab', async () => {
    const user = userEvent.setup();
    renderWithRouter('/list/7');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'View Results' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'View Results' }));

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Results' })).toHaveAttribute('aria-current', 'page');
    });
    expect(screen.getByRole('combobox', { name: /Ranking view/i })).toBeInTheDocument();
  });

  test('Reset Choices calls reset API and refreshes ranking', async () => {
    const user = userEvent.setup();
    comparisonHelpers.resetMyRanking.mockResolvedValue(undefined);

    renderWithRouter('/list/7');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Reset Choices' })).toBeInTheDocument();
    });

    rankingHelpers.fetchRanking.mockResolvedValue({
      aggregate: [],
      personal: [],
      is_finalized: false,
      participants: [],
    });
    comparisonHelpers.fetchNextPair.mockResolvedValue({
      a: { item_id: 1, label: 'A' },
      b: { item_id: 2, label: 'B' },
      total: 2,
      placedCount: 0,
      done: false,
    });

    await user.click(screen.getByRole('button', { name: 'Reset Choices' }));

    await screen.findByRole('heading', { name: /Reset your choices/i });

    await user.click(screen.getByRole('button', { name: /Reset anyway/i }));

    await waitFor(() => {
      expect(comparisonHelpers.resetMyRanking).toHaveBeenCalledWith(7);
    });

    await waitFor(() => {
      expect(rankingHelpers.fetchRanking.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  test('Settings shows details form and current options', async () => {
    renderWithRouter('/list/7/settings');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'List details' })).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { name: 'Options in this list' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Snack bracket')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /List visibility: public on Discover/i })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    const optionList = screen.getByRole('list');
    expect(within(optionList).getByText('A')).toBeInTheDocument();
    expect(within(optionList).getByText('B')).toBeInTheDocument();
  });

  test('Save details sends is_public with other fields', async () => {
    const user = userEvent.setup();
    listHelpers.updateList.mockImplementation(async () => ({
      list: { ...mockListDetail().list, is_public: false },
    }));

    renderWithRouter('/list/7/settings');

    await waitFor(() => {
      expect(
        screen.getByRole('switch', { name: /List visibility: public on Discover/i })
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole('switch', { name: /List visibility: public on Discover/i }));
    await user.click(screen.getByRole('button', { name: 'Save details' }));

    await waitFor(() => {
      expect(listHelpers.updateList).toHaveBeenCalledWith(
        7,
        expect.objectContaining({
          title: 'Snack bracket',
          description: null,
          is_public: false,
        })
      );
    });
  });

  test('removing an option calls the API when confirmed', async () => {
    window.confirm = jest.fn(() => true);
    const user = userEvent.setup();
    renderWithRouter('/list/7/settings');

    await waitFor(() => {
      expect(within(screen.getByRole('list')).getByText('A')).toBeInTheDocument();
    });

    const row = within(screen.getByRole('list')).getByText('A').closest('li');
    await user.click(within(row).getByRole('button', { name: /Delete A/i }));

    await waitFor(() => {
      expect(listHelpers.removeItem).toHaveBeenCalledWith(7, 1);
    });
  });

  test('uploading an image from the media button patches the option', async () => {
    const user = userEvent.setup();
    renderWithRouter('/list/7/settings');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Options in this list' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Choose photo for A/i }));
    const input = document.querySelector('input[type="file"][accept="image/*"]');
    expect(input).toBeTruthy();
    const file = new File(['x'], 'p.png', { type: 'image/png' });
    await user.upload(input, file);

    await waitFor(() => {
      expect(uploadHelpers.uploadPublicImage).toHaveBeenCalledWith(file);
      expect(listHelpers.patchItem).toHaveBeenCalledWith(7, 1, {
        image_url: 'https://cdn.example.com/up.jpg',
      });
    });
  });

  test('confirming thumbnail removal clears image_url', async () => {
    window.confirm = jest.fn(() => true);
    const user = userEvent.setup();
    listHelpers.fetchListByKey.mockResolvedValue(
      mockListDetail({
        items: [
          { item_id: 1, list_id: 7, label: 'A', image_url: 'https://example.com/a.jpg' },
          { item_id: 2, list_id: 7, label: 'B' },
        ],
      })
    );

    renderWithRouter('/list/7/settings');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Remove photo for A/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Remove photo for A/i }));

    await waitFor(() => {
      expect(listHelpers.patchItem).toHaveBeenCalledWith(7, 1, { image_url: null });
    });
  });

  test('redirects non-owner away from Settings', async () => {
    renderWithRouter('/list/7/settings', {
      user: { user_id: 2, username: 'guest' },
      isAuthenticated: true,
      loading: false,
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Snack bracket' })).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Choose' })).toHaveAttribute('aria-current', 'page');
    });
    expect(screen.queryByRole('heading', { name: 'List details' })).not.toBeInTheDocument();
  });
});
