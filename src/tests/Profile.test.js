import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';

import authReducer from '../store/auth.reducer';
import globalReducer from '../store/global.reducer';
import nativeReducer from '../store/native.reducer';
import listsReducer from '../store/lists.reducer';
import Profile from '../routes/Profile';

jest.mock('../utils/NativeContext', () => ({
  NativeProvider: ({ children }) => <>{children}</>,
  useNative: () => ({ isNative: false, platform: 'web', deviceInfo: null }),
}));

jest.mock('@ionic/react', () => ({ setupIonicReact: () => {} }));
jest.mock('react-hot-toast', () => ({ success: jest.fn(), error: jest.fn() }));

const routerFutureFlags = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
};

function buildProfileFetch(listsMe, comparisons = [], patchHandler) {
  return jest.fn((url, init) => {
    if (url === '/api/lists/me') {
      return Promise.resolve({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ lists: listsMe }),
        json: async () => ({ lists: listsMe }),
      });
    }
    if (typeof url === 'string' && url.startsWith('/api/lists/activity')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            comparisons,
            has_more: false,
          }),
        json: async () => ({
          comparisons,
          has_more: false,
        }),
      });
    }
    if (url === '/api/users/me' && init && init.method === 'PATCH') {
      if (patchHandler) return patchHandler(init);
      return Promise.resolve({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            user: { user_id: 1, username: 'patched', email: 't@e.com', profile_picture: null, created_at: '2026-01-01T00:00:00.000Z' },
          }),
        json: async () => ({
          user: { user_id: 1, username: 'patched', email: 't@e.com', profile_picture: null, created_at: '2026-01-01T00:00:00.000Z' },
        }),
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

describe('Profile', () => {
  test('your lists cards link to numeric /list/:id as View', async () => {
    global.fetch = buildProfileFetch([
      {
        list_id: 1,
        title: 'Mine',
        description: null,
        is_public: false,
        share_slug: 'x',
        owner_user_id: 1,
        my_rank_complete: false,
      },
    ]);

    const store = configureStore({
      reducer: {
        auth: authReducer,
        global: globalReducer,
        native: nativeReducer,
        lists: listsReducer,
      },
      preloadedState: {
        auth: {
          user: { user_id: 1, username: 't', email: 't@e.com', created_at: '2026-01-01T00:00:00.000Z' },
          isAuthenticated: true,
          loading: false,
        },
      },
    });

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/profile']} future={routerFutureFlags}>
          <Profile />
        </MemoryRouter>
      </Provider>
    );

    await waitFor(() => {
      expect(screen.getByText('Mine')).toBeInTheDocument();
    });

    const links = screen.getAllByRole('link', { name: 'View' });
    expect(links.some((el) => el.getAttribute('href') === '/list/1')).toBe(true);
    const viewMore = screen.getAllByRole('link', { name: /View more/i });
    expect(viewMore.some((el) => el.getAttribute('href') === '/lists')).toBe(true);
    expect(viewMore.some((el) => el.getAttribute('href') === '/activity')).toBe(true);
  });

  test('does not surface internal user id in Account', async () => {
    global.fetch = buildProfileFetch([]);

    const store = configureStore({
      reducer: {
        auth: authReducer,
        global: globalReducer,
        native: nativeReducer,
        lists: listsReducer,
      },
      preloadedState: {
        auth: {
          user: { user_id: 1, username: 't', email: 't@e.com', created_at: '2026-01-01T00:00:00.000Z' },
          isAuthenticated: true,
          loading: false,
        },
      },
    });

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/profile']} future={routerFutureFlags}>
          <Profile />
        </MemoryRouter>
      </Provider>
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    });

    expect(screen.queryByText('User ID')).not.toBeInTheDocument();
  });

  test('shows Save changes after editing username and saves via PATCH', async () => {
    const user = userEvent.setup();
    global.fetch = buildProfileFetch([]);

    const store = configureStore({
      reducer: {
        auth: authReducer,
        global: globalReducer,
        native: nativeReducer,
        lists: listsReducer,
      },
      preloadedState: {
        auth: {
          user: { user_id: 1, username: 'old', email: 'old@e.com', profile_picture: null, created_at: '2026-01-01T00:00:00.000Z' },
          isAuthenticated: true,
          loading: false,
        },
      },
    });

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/profile']} future={routerFutureFlags}>
          <Profile />
        </MemoryRouter>
      </Provider>
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    });

    const input = screen.getByLabelText(/username/i);
    await user.clear(input);
    await user.type(input, 'newname');

    expect(await screen.findByRole('button', { name: /save changes/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/users/me',
        expect.objectContaining({ method: 'PATCH', body: expect.stringContaining('newname') })
      );
    });
  });
});
