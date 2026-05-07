import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';

import Nav from '../components/Nav/Nav';
import authReducer from '../store/auth.reducer';
import globalReducer from '../store/global.reducer';
import { createMockUser } from './__mocks__/fetchMocks';

jest.mock('../helpers/authHelpers', () => ({
  logout: jest.fn(() => Promise.resolve()),
}));

jest.mock('react-hot-toast', () => ({ success: jest.fn(), error: jest.fn() }));

const routerFutureFlags = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
};

function renderNav(authPreload) {
  const store = configureStore({
    reducer: {
      auth: authReducer,
      global: globalReducer,
    },
    preloadedState: {
      auth: authPreload,
      global: { activeModal: null, loading: false },
    },
  });

  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/']} future={routerFutureFlags}>
        <Nav />
      </MemoryRouter>
    </Provider>
  );
}

describe('Nav', () => {
  test('guest mobile menu shows Home, Discover, and Sign up — not Lists or sidebar Sign in', async () => {
    const user = userEvent.setup();
    renderNav({ user: null, isAuthenticated: false, loading: false });

    await user.click(screen.getByRole('button', { name: /open menu/i }));

    const menu = screen.getByRole('menu');
    expect(within(menu).getByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(within(menu).getByRole('link', { name: 'Discover' })).toBeInTheDocument();
    expect(within(menu).queryByRole('link', { name: 'Lists' })).not.toBeInTheDocument();
    expect(within(menu).queryByRole('link', { name: 'Make New List' })).not.toBeInTheDocument();
    expect(within(menu).queryByRole('link', { name: 'Activity' })).not.toBeInTheDocument();
    expect(within(menu).getByRole('link', { name: /^Sign up$/i })).toBeInTheDocument();
    expect(within(menu).queryByRole('link', { name: /^Sign in$/i })).not.toBeInTheDocument();
  });

  test('signed-in mobile menu includes primary links, Profile, and Log out', async () => {
    const user = userEvent.setup();
    const me = createMockUser({ username: 'navuser' });
    renderNav({ user: me, isAuthenticated: true, loading: false });

    await user.click(screen.getByRole('button', { name: /open menu/i }));

    const menu = screen.getByRole('menu');
    expect(within(menu).getByRole('link', { name: 'Make New List' })).toBeInTheDocument();
    expect(within(menu).getByRole('link', { name: 'Lists' })).toBeInTheDocument();
    expect(within(menu).getByRole('link', { name: 'Profile' })).toBeInTheDocument();
    expect(within(menu).getByRole('button', { name: /log out/i })).toBeInTheDocument();
    expect(within(menu).queryByRole('link', { name: /^Sign up$/i })).not.toBeInTheDocument();
  });
});
