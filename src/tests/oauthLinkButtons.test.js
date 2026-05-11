import { render, screen } from '@testing-library/react';

import GoogleButton from '../components/Auth/GoogleButton';
import AppleButton from '../components/Auth/AppleButton';

describe('OAuth buttons (link-account / Log in Settings)', () => {
  test('GoogleButton with linkAccount shows link label and link-account path', () => {
    render(<GoogleButton linkAccount />);
    const link = screen.getByRole('link', { name: /link google account/i });
    expect(link.getAttribute('href')).toBe('/api/auth/google/link-account');
  });

  test('AppleButton with linkAccount shows link label and link-account path', () => {
    render(<AppleButton linkAccount />);
    const link = screen.getByRole('link', { name: /link apple account/i });
    expect(link.getAttribute('href')).toBe('/api/auth/apple/link-account');
  });

  test('GoogleButton without linkAccount keeps sign-in label for mode signIn', () => {
    render(<GoogleButton mode="signIn" />);
    expect(screen.getByRole('link', { name: /sign in with google/i })).toBeInTheDocument();
  });
});
