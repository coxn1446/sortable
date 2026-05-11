import { api } from '../utils/api';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';

function appendReturnNativeIfCapacitor(path) {
  if (!Capacitor.isNativePlatform()) return path;
  const sep = path.includes('?') ? '&' : '?';
  const next = `${path}${sep}return_native=1`;
  try {
    // QA / device troubleshooting — visible in Safari Web Inspector attached to the WKWebView
    console.log('[oauth-native-client] OAuth href: native platform, appending return_native=1', {
      platform: Capacitor.getPlatform?.() ?? null,
      path: next,
    });
  } catch {
    /* no Capacitor in test / SSR */
  }
  return next;
}

export async function fetchCurrentUser() {
  try {
    const data = await api.get('/api/auth/me');
    return data?.user || null;
  } catch (error) {
    if (error.status === 401) return null;
    throw error;
  }
}

export async function login({ username, password }) {
  const data = await api.post('/api/auth/login', { username, password });
  return data?.user || null;
}

export async function register({ username, password }) {
  const data = await api.post('/api/auth/register', { username, password });
  return data?.user || null;
}

export async function acceptUpdatedPolicies({ accept_privacy, accept_terms }) {
  const data = await api.post('/api/users/me/accept-policies', {
    accept_privacy,
    accept_terms,
  });
  return data?.user ?? null;
}

export async function completeNativeOAuthSessionHandoff(token) {
  const data = await api.post('/api/auth/native-session-handoff', { token });
  return data?.user ?? null;
}

export async function logout() {
  await api.post('/api/auth/logout');
}

export async function fetchGoogleLinkPending() {
  const data = await api.get('/api/auth/google/link-pending');
  return data ?? { pending: false };
}

export async function completeGoogleLink({ password }) {
  const data = await api.post('/api/auth/google/complete-link', { password });
  return data?.user ?? null;
}

export async function cancelGoogleLink() {
  await api.post('/api/auth/google/cancel-link');
}

export async function fetchNativeGoogleLinkBootstrapUrl() {
  const data = await api.post('/api/auth/google/native-link-bootstrap');
  if (!data?.url || typeof data.url !== 'string') {
    throw new Error('Could not start Google link');
  }
  return data.url;
}

export async function fetchNativeAppleLinkBootstrapUrl() {
  const data = await api.post('/api/auth/apple/native-link-bootstrap');
  if (!data?.url || typeof data.url !== 'string') {
    throw new Error('Could not start Apple link');
  }
  return data.url;
}

export function googleLoginUrl(options = {}) {
  const base = options.linkAccount ? '/api/auth/google/link-account' : '/api/auth/google';
  return appendReturnNativeIfCapacitor(base);
}

export function appleLoginUrl(options = {}) {
  const base = options.linkAccount ? '/api/auth/apple/link-account' : '/api/auth/apple';
  return appendReturnNativeIfCapacitor(base);
}

/**
 * Opens the OAuth start URL in the system browser (e.g. SFSafariViewController on iOS).
 * Full-screen Google/Apple OAuth inside WKWebView often ends with WebKit error 102 / “Frame load interrupted”.
 * Callback still hits `https://…/api/auth/…/callback` and redirects to `Sortable://…` as today.
 *
 * On **native**, sign-in uses this helper; **link-account** uses POST …/native-link-bootstrap and
 * `Browser.open` on the returned URL (Google disallows OAuth in embedded WKWebView; `disallowed_useragent`).
 *
 * @param {string} relativeHref e.g. `/api/auth/google?return_native=1`
 * @param {{ linkAccount?: boolean }} opts
 * @returns {Promise<boolean>} true when the system browser was opened (caller should preventDefault on the anchor)
 */
export async function openSystemBrowserForOAuthStart(relativeHref, opts = {}) {
  if (!Capacitor.isNativePlatform()) return false;
  if (opts.linkAccount) {
    // Native link-account uses fetchNativeGoogleLinkBootstrapUrl / fetchNativeAppleLinkBootstrapUrl instead.
    return false;
  }
  const path = relativeHref.startsWith('/') ? relativeHref : `/${relativeHref}`;
  const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
  if (!origin) return false;
  const url = `${origin}${path}`;
  console.log('[oauth-native-client] Browser.open for OAuth', {
    url: url.slice(0, 200),
    platform: Capacitor.getPlatform?.() ?? null,
  });
  await Browser.open({ url });
  return true;
}
