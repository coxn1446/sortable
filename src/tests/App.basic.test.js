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
import { createAuthFetchMock } from './__mocks__/fetchMocks';

// Mock the NativeProvider so we don't have to wire up Capacitor in jsdom.
jest.mock('../utils/NativeContext', () => ({
  NativeProvider: ({ children }) => <>{children}</>,
  useNative: () => ({ isNative: false, platform: 'web', deviceInfo: null }),
}));

// Mock the Ionic setup helper since Ionic CSS isn't transformed in jest.
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

describe('App - basic rendering', () => {
  beforeEach(() => {
    global.fetch = jest.fn(createAuthFetchMock(false));
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('renders the home route with the Sortable headline when unauthenticated', async () => {
    const App = require('../components/App').default;
    const store = buildStore({
      auth: { user: null, isAuthenticated: false, loading: false },
    });

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/']} future={routerFutureFlags}>
          <App />
        </MemoryRouter>
      </Provider>
    );

    await waitFor(() => {
      // Multiple "Sortable" appear (nav + heading); just assert at least one.
      expect(screen.getAllByText(/Sortable/i).length).toBeGreaterThan(0);
    });
  });

  test('shows sign in / sign up entry points when unauthenticated', async () => {
    const App = require('../components/App').default;
    const store = buildStore({
      auth: { user: null, isAuthenticated: false, loading: false },
    });

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/']} future={routerFutureFlags}>
          <App />
        </MemoryRouter>
      </Provider>
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Sign in/i).length).toBeGreaterThan(0);
    });
  });
});
