import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import HomeHero from '../components/home/HomeHero';

const routerFutureFlags = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
};

describe('HomeHero guest splash', () => {
  test('Register choice navigates to /register after selection flash', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/']} future={routerFutureFlags}>
        <Routes>
          <Route path="/" element={<HomeHero isAuthenticated={false} splash />} />
          <Route path="/register" element={<h1>Register page</h1>} />
        </Routes>
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: /choose register/i }));

    await waitFor(
      () => {
        expect(screen.getByRole('heading', { name: /register page/i })).toBeInTheDocument();
      },
      { timeout: 400 }
    );
  });

  test('Sign In choice navigates to /login after selection flash', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/']} future={routerFutureFlags}>
        <Routes>
          <Route path="/" element={<HomeHero isAuthenticated={false} splash />} />
          <Route path="/login" element={<h1>Login page</h1>} />
        </Routes>
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: /choose sign in/i }));

    await waitFor(
      () => {
        expect(screen.getByRole('heading', { name: /login page/i })).toBeInTheDocument();
      },
      { timeout: 400 }
    );
  });
});
