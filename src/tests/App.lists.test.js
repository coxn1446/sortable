import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';

import authReducer from '../store/auth.reducer';
import globalReducer from '../store/global.reducer';
import nativeReducer from '../store/native.reducer';
import listsReducer from '../store/lists.reducer';
import Home from '../routes/Home';

jest.mock('../utils/NativeContext', () => ({
  NativeProvider: ({ children }) => <>{children}</>,
  useNative: () => ({ isNative: false, platform: 'web', deviceInfo: null }),
}));

jest.mock('@ionic/react', () => ({ setupIonicReact: () => {} }));

const routerFutureFlags = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
};

function buildFetch(listsMe, discover) {
  return jest.fn((url) => {
    if (url === '/api/auth/me') {
      return Promise.resolve({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ user: { user_id: 1, username: 't' } }),
        json: async () => ({ user: { user_id: 1, username: 't' } }),
      });
    }
    if (url === '/api/lists/me') {
      return Promise.resolve({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ lists: listsMe }),
        json: async () => ({ lists: listsMe }),
      });
    }
    if (url === '/api/lists/discover') {
      return Promise.resolve({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ lists: discover }),
        json: async () => ({ lists: discover }),
      });
    }
    return Promise.resolve({
      ok: false,
      status: 404,
      text: async () => '{}',
      json: async () => ({}),
    });
  });
}

describe('App - lists home', () => {
  test('shows hero with Create List and discover preview for authenticated user', async () => {
    global.fetch = buildFetch(
      [],
      [{ list_id: 2, title: 'Community picks', description: null, is_public: true, share_slug: 'y' }]
    );

    const store = configureStore({
      reducer: {
        auth: authReducer,
        global: globalReducer,
        native: nativeReducer,
        lists: listsReducer,
      },
      preloadedState: {
        auth: {
          user: { user_id: 1, username: 't' },
          isAuthenticated: true,
          loading: false,
        },
      },
    });

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/']} future={routerFutureFlags}>
          <Home />
        </MemoryRouter>
      </Provider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Clarity through choice/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { name: /Make hard decisions feel easy/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Create List/i })).toHaveAttribute('href', '/lists/new');

    await waitFor(() => {
      expect(screen.getByText('Community picks')).toBeInTheDocument();
      expect(screen.getByText(/^Public$/)).toBeInTheDocument();
    });

    expect(screen.getByRole('link', { name: /View more/i })).toHaveAttribute('href', '/discover');
  });

  test('discover preview cards link to numeric /list/:id as View', async () => {
    global.fetch = buildFetch(
      [],
      [
        {
          list_id: 1,
          title: 'Done',
          description: null,
          is_public: true,
          share_slug: 'done1',
          my_rank_complete: true,
        },
      ]
    );

    const store = configureStore({
      reducer: {
        auth: authReducer,
        global: globalReducer,
        native: nativeReducer,
        lists: listsReducer,
      },
      preloadedState: {
        auth: {
          user: { user_id: 1, username: 't' },
          isAuthenticated: true,
          loading: false,
        },
      },
    });

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/']} future={routerFutureFlags}>
          <Home />
        </MemoryRouter>
      </Provider>
    );

    await waitFor(() => {
      const links = screen.getAllByRole('link', { name: 'View' });
      expect(links.some((el) => el.getAttribute('href') === '/list/1')).toBe(true);
    });
  });
});
