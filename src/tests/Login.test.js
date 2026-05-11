import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import Login from '../routes/Login';

jest.mock('../components/Auth/LoginForm', () => ({
  __esModule: true,
  default: function MockLoginForm() {
    return <div data-testid="mock-login-form" />;
  },
}));

const routerFutureFlags = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
};

describe('Login route', () => {
  test('wraps content in a full-height flex column centered on both axes', () => {
    const { container } = render(
      <MemoryRouter future={routerFutureFlags}>
        <Login />
      </MemoryRouter>
    );

    const outer = container.firstChild;
    expect(outer).toHaveClass('flex', 'min-h-full', 'w-full', 'flex-col', 'items-center', 'justify-center');
    expect(outer.querySelector('.max-w-2xl')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByTestId('mock-login-form')).toBeInTheDocument();
  });
});
