import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';

const routerFutureFlags = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
};
import { configureStore } from '@reduxjs/toolkit';

import authReducer from '../store/auth.reducer';
import globalReducer from '../store/global.reducer';
import nativeReducer from '../store/native.reducer';
import listsReducer from '../store/lists.reducer';
import { createAuthFetchMock, createMockUser } from './__mocks__/fetchMocks';

jest.mock('../utils/NativeContext', () => ({
  NativeProvider: ({ children }) => <>{children}</>,
  useNative: () => ({ isNative: false, platform: 'web', deviceInfo: null }),
}));

jest.mock('@ionic/react', () => ({ setupIonicReact: () => {} }));

const buildStore = (preloadedState) =>
  configureStore({
    reducer: {
      auth: authReducer,
      global: globalReducer,
      native: nativeReducer,
      lists: listsReducer,
    },
    preloadedState,
  });

describe('App - auth-aware behavior', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  test('redirects unauthenticated users away from /profile', async () => {
    global.fetch = jest.fn(createAuthFetchMock(false));
    const App = require('../components/App').default;
    const store = buildStore({
      auth: { user: null, isAuthenticated: false, loading: false },
    });

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/profile']} future={routerFutureFlags}>
          <App />
        </MemoryRouter>
      </Provider>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Sign in/i })).toBeInTheDocument();
    });
  });

  test('renders the profile page for an authenticated user', async () => {
    const user = createMockUser({ username: 'sortableuser' });
    global.fetch = jest.fn(createAuthFetchMock(true, user));

    const App = require('../components/App').default;
    const store = buildStore({
      auth: { user, isAuthenticated: true, loading: false },
    });

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/profile']} future={routerFutureFlags}>
          <App />
        </MemoryRouter>
      </Provider>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /^Account$/i })).toBeInTheDocument();
      expect(screen.getByDisplayValue('sortableuser')).toBeInTheDocument();
    });
  });
});
