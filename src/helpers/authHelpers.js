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

export async function logout() {
  await api.post('/api/auth/logout');
}

export function googleLoginUrl() {
  return '/api/auth/google';
}

export function appleLoginUrl() {
  return '/api/auth/apple';
}
