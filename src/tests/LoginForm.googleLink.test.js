import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';

import LoginForm from '../components/Auth/LoginForm';
import authReducer from '../store/auth.reducer';
import * as authHelpers from '../helpers/authHelpers';

jest.mock('../helpers/authHelpers', () => ({
  ...jest.requireActual('../helpers/authHelpers'),
  login: jest.fn(),
  fetchGoogleLinkPending: jest.fn(() => Promise.resolve({ pending: false })),
  completeGoogleLink: jest.fn(),
  cancelGoogleLink: jest.fn(),
}));

jest.mock('react-hot-toast', () => ({ success: jest.fn(), error: jest.fn() }));

const routerFutureFlags = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
};

function renderLoginForm(initialPath = '/login') {
  const store = configureStore({
    reducer: { auth: authReducer },
    preloadedState: {
      auth: { user: null, isAuthenticated: false, loading: false },
    },
  });

  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[initialPath]} future={routerFutureFlags}>
        <LoginForm />
      </MemoryRouter>
    </Provider>
  );
}

describe('LoginForm Google link', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authHelpers.fetchGoogleLinkPending.mockResolvedValue({ pending: false });
  });

  test('shows password-only link form when Google link is pending', async () => {
    authHelpers.fetchGoogleLinkPending.mockResolvedValue({
      pending: true,
      email: 'pat@example.com',
      username: 'pat',
    });

    renderLoginForm();

    expect(
      await screen.findByText(/link google sign-in to your existing account/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/pat@example.com/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /link google and sign in/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/^username$/i)).not.toBeInTheDocument();
  });

  test('shows standard username field when no link is pending', async () => {
    renderLoginForm();

    await waitFor(() => {
      expect(screen.queryByText(/loading sign-in options/i)).not.toBeInTheDocument();
    });

    expect(screen.getByLabelText(/^username$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument();
  });
});

describe('LoginForm OAuth error query', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authHelpers.fetchGoogleLinkPending.mockResolvedValue({ pending: false });
  });

  test('toasts Apple-specific message for ?error=apple', async () => {
    renderLoginForm('/login?error=apple');

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Apple sign-in did not complete. Please try again.'
      );
    });
  });

  test('toasts generic fallback for unknown OAuth error key', async () => {
    renderLoginForm('/login?error=unknown_oauth_key');

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Sign-in with Google or Apple did not complete. Please try again.'
      );
    });
  });
});
