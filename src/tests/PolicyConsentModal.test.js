import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import PolicyConsentModal from '../components/legal/PolicyConsentModal';

const routerFutureFlags = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
};

describe('PolicyConsentModal', () => {
  test('shows reader controls for pending policies only', () => {
    render(
      <MemoryRouter future={routerFutureFlags}>
        <PolicyConsentModal
          open
          needsPrivacy
          needsTerms={false}
          onAgree={jest.fn()}
          onSignOut={jest.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: /privacy policy/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /terms & conditions/i })).not.toBeInTheDocument();
  });

  test('opens stacked privacy reader with shared policy content', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter future={routerFutureFlags}>
        <PolicyConsentModal
          open
          needsPrivacy
          needsTerms={false}
          onAgree={jest.fn()}
          onSignOut={jest.fn()}
        />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: /privacy policy/i }));
    expect(screen.getByRole('heading', { name: /^Privacy Policy$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^Introduction$/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^close$/i }));
    expect(screen.queryByRole('heading', { name: /^Introduction$/i })).not.toBeInTheDocument();
  });

  test('fires onAgree when primary button is used', async () => {
    const user = userEvent.setup();
    const onAgree = jest.fn(async () => {});

    render(
      <MemoryRouter future={routerFutureFlags}>
        <PolicyConsentModal
          open
          needsPrivacy
          needsTerms
          onAgree={onAgree}
          onSignOut={jest.fn()}
        />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: /i agree and want to continue/i }));
    expect(onAgree).toHaveBeenCalledTimes(1);
  });
});
