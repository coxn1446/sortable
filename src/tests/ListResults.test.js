import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';

import authReducer from '../store/auth.reducer';
import globalReducer from '../store/global.reducer';
import nativeReducer from '../store/native.reducer';
import listsReducer from '../store/lists.reducer';
import { ListResultsPanel } from '../routes/ListResults';
import * as listHelpers from '../helpers/listHelpers';
import * as rankingHelpers from '../helpers/rankingHelpers';
import * as clipboardHelpers from '../helpers/clipboardHelpers';
import toast from 'react-hot-toast';

jest.mock('../helpers/listHelpers', () => ({
  fetchListById: jest.fn(),
}));
jest.mock('../helpers/rankingHelpers', () => ({
  fetchRanking: jest.fn(),
}));
jest.mock('../helpers/clipboardHelpers', () => ({
  copyTextToClipboard: jest.fn(),
}));
jest.mock('@ionic/react', () => ({ setupIonicReact: () => {} }));

const routerFutureFlags = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
};

const buildStore = (authState) =>
  configureStore({
    reducer: {
      auth: authReducer,
      global: globalReducer,
      native: nativeReducer,
      lists: listsReducer,
    },
    preloadedState: {
      auth:
        authState ||
        {
          user: { user_id: 1, username: 'me' },
          isAuthenticated: true,
          loading: false,
        },
    },
  });

describe('ListResults', () => {
  beforeEach(() => {
    jest.resetAllMocks();

    clipboardHelpers.copyTextToClipboard.mockResolvedValue(undefined);

    listHelpers.fetchListById.mockResolvedValue({
      list: {
        list_id: 5,
        title: 'Tastes',
        description: null,
        is_public: true,
        share_slug: 'abc99',
      },
      items: [],
    });
    rankingHelpers.fetchRanking.mockResolvedValue({
      aggregate: [
        {
          rank: 1,
          id: 10,
          label: 'One',
          elo_rating: 1500,
        },
      ],
      personal: [{ rank: 1, id: 10, label: 'One' }],
      is_finalized: true,
      participants: [
        { user_id: 1, username: 'me', is_finalized: true },
        { user_id: 2, username: 'them', is_finalized: false },
      ],
    });
  });

  test('authenticated user sees result tabs and aggregate content', async () => {
    render(
      <Provider store={buildStore()}>
        <MemoryRouter initialEntries={['/r']} future={routerFutureFlags}>
          <Routes>
            <Route path="/r" element={<ListResultsPanel listId={5} />} />
          </Routes>
        </MemoryRouter>
      </Provider>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Tastes' })).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /My results/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Someone else/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Aggregate/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Reset your ranking/i })).toHaveAttribute(
      'href',
      '/list/5?reset=1'
    );
  });

  test('Share link copies the public URL and toasts success', async () => {
    const user = userEvent.setup();
    toast.success = jest.fn();

    render(
      <Provider store={buildStore()}>
        <MemoryRouter initialEntries={['/r']} future={routerFutureFlags}>
          <Routes>
            <Route path="/r" element={<ListResultsPanel listId={5} />} />
          </Routes>
        </MemoryRouter>
      </Provider>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Share link/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Share link/i }));

    await waitFor(() => {
      expect(clipboardHelpers.copyTextToClipboard).toHaveBeenCalledWith(
        `${window.location.origin}/list/5`
      );
      expect(toast.success).toHaveBeenCalledWith('Link copied to clipboard');
    });
  });

  test('Share link shows an error toast when clipboard write fails', async () => {
    const user = userEvent.setup();
    clipboardHelpers.copyTextToClipboard.mockRejectedValue(new Error('blocked'));
    toast.error = jest.fn();

    render(
      <Provider store={buildStore()}>
        <MemoryRouter initialEntries={['/r']} future={routerFutureFlags}>
          <Routes>
            <Route path="/r" element={<ListResultsPanel listId={5} />} />
          </Routes>
        </MemoryRouter>
      </Provider>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Share link/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Share link/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Could not copy link');
    });
  });

  test('anonymous viewer only sees aggregate ranking', async () => {
    rankingHelpers.fetchRanking.mockResolvedValue({
      aggregate: [{ rank: 1, id: 10, label: 'One', elo_rating: 1500 }],
      personal: null,
      is_finalized: false,
      participants: [],
    });

    render(
      <Provider
        store={buildStore({
          user: null,
          isAuthenticated: false,
          loading: false,
        })}
      >
        <MemoryRouter initialEntries={['/r']} future={routerFutureFlags}>
          <Routes>
            <Route path="/r" element={<ListResultsPanel listId={5} />} />
          </Routes>
        </MemoryRouter>
      </Provider>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Aggregate/i })).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /My results/i })).not.toBeInTheDocument();
  });
});
