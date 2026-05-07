import { api } from '../utils/api';

export async function fetchMe() {
  const data = await api.get('/api/users/me');
  return data?.user || null;
}

export async function updateMe(patch) {
  const data = await api.patch('/api/users/me', patch);
  return data?.user || null;
}
