import { api } from '../utils/api';

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

export async function register({ username, email, password }) {
  const data = await api.post('/api/auth/register', { username, email, password });
  return data?.user || null;
}

export async function acceptUpdatedPolicies({ accept_privacy, accept_terms }) {
  const data = await api.post('/api/users/me/accept-policies', {
    accept_privacy,
    accept_terms,
  });
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

export function googleLoginUrl(options = {}) {
  return options.linkAccount ? '/api/auth/google/link-account' : '/api/auth/google';
}

export function appleLoginUrl(options = {}) {
  return options.linkAccount ? '/api/auth/apple/link-account' : '/api/auth/apple';
}
