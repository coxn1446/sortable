import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import Register from '../routes/Register';

jest.mock('../components/Auth/RegisterForm', () => ({
  __esModule: true,
  default: function MockRegisterForm() {
    return <div data-testid="mock-register-form" />;
  },
}));

const routerFutureFlags = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
};

describe('Register route', () => {
  test('wraps content in a full-height flex column centered on both axes', () => {
    const { container } = render(
      <MemoryRouter future={routerFutureFlags}>
        <Register />
      </MemoryRouter>
    );

    const outer = container.firstChild;
    expect(outer).toHaveClass('flex', 'min-h-full', 'w-full', 'flex-col', 'items-center', 'justify-center');
    expect(screen.getByRole('heading', { name: 'Create an account' })).toBeInTheDocument();
    expect(screen.getByTestId('mock-register-form')).toBeInTheDocument();
  });
});
