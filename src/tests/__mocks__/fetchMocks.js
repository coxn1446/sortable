/**
 * Shared fetch mocking utilities for tests.
 * Use these to spin up a `global.fetch` mock that handles common endpoints.
 */

function jsonResponse(payload, { ok = true, status = 200 } = {}) {
  return Promise.resolve({
    ok,
    status,
    text: async () => JSON.stringify(payload),
    json: async () => payload,
  });
}

export const createDefaultFetchMock = () => (url) => {
  if (url === '/api/health') {
    return jsonResponse({ status: 'healthy' });
  }
  if (url === '/api/lists/me') {
    return jsonResponse({ lists: [] });
  }
  if (url === '/api/lists/discover') {
    return jsonResponse({ lists: [] });
  }
  if (typeof url === 'string' && url.startsWith('/api/lists/activity')) {
    return jsonResponse({ comparisons: [], has_more: false });
  }
  return jsonResponse({ error: 'Endpoint not mocked' }, { ok: false, status: 404 });
};

export const createAuthFetchMock = (authenticated = false, user = null) => {
  const defaultMock = createDefaultFetchMock();
  return (url) => {
    if (url === '/api/auth/me') {
      if (authenticated && user) {
        return jsonResponse({ user });
      }
      return jsonResponse({ user: null }, { ok: false, status: 401 });
    }
    return defaultMock(url);
  };
};

export const createMockUser = (overrides = {}) => ({
  user_id: 1,
  username: 'testuser',
  email: 'test@example.com',
  profile_picture: null,
  privacy_policy_agreed: true,
  terms_agreed: true,
  created_at: '2026-05-06T00:00:00.000Z',
  updated_at: '2026-05-06T00:00:00.000Z',
  ...overrides,
});
