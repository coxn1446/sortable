jest.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => true,
    getPlatform: () => 'ios',
  },
}));

jest.mock('../utils/api', () => ({
  api: {
    post: jest.fn(),
    get: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

import { Browser } from '@capacitor/browser';
import { api } from '../utils/api';
import {
  appleLoginUrl,
  fetchNativeAppleLinkBootstrapUrl,
  fetchNativeGoogleLinkBootstrapUrl,
  googleLoginUrl,
  openSystemBrowserForOAuthStart,
} from '../helpers/authHelpers';

describe('authHelpers native OAuth', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, origin: 'https://qa.sortable.net' },
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
      writable: true,
    });
  });

  test('googleLoginUrl appends return_native=1 on native', () => {
    expect(googleLoginUrl()).toBe('/api/auth/google?return_native=1');
  });

  test('googleLoginUrl link-account still appends return_native=1 on native', () => {
    expect(googleLoginUrl({ linkAccount: true })).toBe('/api/auth/google/link-account?return_native=1');
  });

  test('appleLoginUrl appends return_native=1 on native', () => {
    expect(appleLoginUrl()).toBe('/api/auth/apple?return_native=1');
  });

  test('openSystemBrowserForOAuthStart uses full origin URL and Browser.open', async () => {
    const opened = await openSystemBrowserForOAuthStart('/api/auth/google?return_native=1');
    expect(opened).toBe(true);
    expect(Browser.open).toHaveBeenCalledWith({
      url: 'https://qa.sortable.net/api/auth/google?return_native=1',
    });
  });

  test('openSystemBrowserForOAuthStart returns false for linkAccount (use native-link-bootstrap + Browser.open in UI)', async () => {
    const opened = await openSystemBrowserForOAuthStart('/api/auth/google/link-account?return_native=1', {
      linkAccount: true,
    });
    expect(opened).toBe(false);
    expect(Browser.open).not.toHaveBeenCalled();
  });

  test('fetchNativeGoogleLinkBootstrapUrl POSTs and returns absolute open URL', async () => {
    api.post.mockResolvedValueOnce({
      url: 'https://qa.sortable.net/api/auth/google/link-account/native-bridge?token=jwt&return_native=1',
    });
    const url = await fetchNativeGoogleLinkBootstrapUrl();
    expect(url).toContain('native-bridge');
    expect(api.post).toHaveBeenCalledWith('/api/auth/google/native-link-bootstrap');
  });

  test('fetchNativeAppleLinkBootstrapUrl POSTs and returns absolute open URL', async () => {
    api.post.mockResolvedValueOnce({
      url: 'https://qa.sortable.net/api/auth/apple/link-account/native-bridge?token=jwt&return_native=1',
    });
    const url = await fetchNativeAppleLinkBootstrapUrl();
    expect(url).toContain('native-bridge');
    expect(api.post).toHaveBeenCalledWith('/api/auth/apple/native-link-bootstrap');
  });

  test('openSystemBrowserForOAuthStart returns false when origin is missing', async () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { origin: '' },
      writable: true,
    });
    const opened = await openSystemBrowserForOAuthStart('/api/auth/google?return_native=1');
    expect(opened).toBe(false);
    expect(Browser.open).not.toHaveBeenCalled();
  });
});
