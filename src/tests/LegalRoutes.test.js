import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { LEGAL_BOILERPLATE_EFFECTIVE_NOTICE } from '../legal/policyDocuments';
import Privacy from '../routes/Privacy';
import Terms from '../routes/Terms';

const routerFutureFlags = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
};

describe('Privacy & Terms routes', () => {
  test('privacy page renders title and cross-link to terms', () => {
    render(
      <MemoryRouter initialEntries={['/privacy']} future={routerFutureFlags}>
        <Routes>
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /privacy policy/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /terms & conditions/i })).toHaveAttribute('href', '/terms');
  });

  test('terms page renders title and cross-link to privacy', () => {
    render(
      <MemoryRouter initialEntries={['/terms']} future={routerFutureFlags}>
        <Routes>
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /terms & conditions/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /privacy policy/i })).toHaveAttribute('href', '/privacy');
  });

  test('privacy page shows shared effective-date line from policyDocuments', () => {
    render(
      <MemoryRouter initialEntries={['/privacy']} future={routerFutureFlags}>
        <Routes>
          <Route path="/privacy" element={<Privacy />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(LEGAL_BOILERPLATE_EFFECTIVE_NOTICE)).toBeInTheDocument();
  });

  test('terms page shows shared effective-date line from policyDocuments', () => {
    render(
      <MemoryRouter initialEntries={['/terms']} future={routerFutureFlags}>
        <Routes>
          <Route path="/terms" element={<Terms />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(LEGAL_BOILERPLATE_EFFECTIVE_NOTICE)).toBeInTheDocument();
  });
});
