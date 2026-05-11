jest.mock('bcrypt', () => ({
  hash: jest.fn(() => Promise.resolve('hashed-password')),
}));

jest.mock('../queries/authQueries', () => ({
  findUserByUsername: jest.fn(),
  findUserByEmail: jest.fn(),
  findUserById: jest.fn(),
  createLocalUser: jest.fn(),
}));

const bcrypt = require('bcrypt');
const authQueries = require('../queries/authQueries');
const {
  registerUser,
  toPublicUser,
  userRowHasPassword,
  captureOAuthReturnToNativeFromQuery,
  createOAuthReturnNativeState,
  hydrateOAuthReturnToNativeFromOAuthState,
  takeOAuthClientRedirect,
  verifyNativeOAuthSessionHandoffToken,
  getUserForNativeOAuthSessionHandoff,
  createNativeOAuthLinkBootstrapToken,
  verifyNativeOAuthLinkBootstrapToken,
} = require('../services/authService');

describe('authService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('toPublicUser', () => {
    test('exposes has_google, has_apple, and has_password without secrets', () => {
      const u = toPublicUser({
        user_id: 1,
        username: 'alice',
        email: 'a@b.com',
        profile_picture: null,
        google_id: 'gid',
        apple_id: null,
        has_password: true,
        privacy_policy_agreed: true,
        terms_agreed: true,
        created_at: '',
        updated_at: '',
      });
      expect(u).toMatchObject({
        user_id: 1,
        has_google: true,
        has_apple: false,
        has_password: true,
      });
      expect(u.google_id).toBeUndefined();
      expect(u.apple_id).toBeUndefined();
      expect(u.password).toBeUndefined();
    });

    test('derives has_password from hash when flag omitted', () => {
      const u = toPublicUser({
        user_id: 1,
        username: 'bob',
        password: 'hash',
        google_id: null,
        apple_id: null,
        privacy_policy_agreed: true,
        terms_agreed: true,
        created_at: '',
        updated_at: '',
      });
      expect(u.has_password).toBe(true);
    });

    test('coerces string has_password flags from drivers / serialization', () => {
      expect(
        toPublicUser({
          user_id: 1,
          username: 'c',
          email: null,
          profile_picture: null,
          google_id: 'g',
          apple_id: null,
          has_password: 'true',
          privacy_policy_agreed: true,
          terms_agreed: true,
          created_at: '',
          updated_at: '',
        }).has_password
      ).toBe(true);
    });
  });

  describe('userRowHasPassword', () => {
    test('uses has_password when password hash is omitted from row', () => {
      expect(userRowHasPassword({ user_id: 1, has_password: true })).toBe(true);
      expect(
        userRowHasPassword({
          user_id: 1,
          has_password: false,
          password: 'hash-in-row',
        })
      ).toBe(true);
    });
  });

  describe('native OAuth return (return_native)', () => {
    test('takeOAuthClientRedirect rewrites safe paths to Sortable deep link when requested', () => {
      const session = {};
      captureOAuthReturnToNativeFromQuery({
        query: { return_native: '1' },
        session,
      });
      expect(takeOAuthClientRedirect(session, '/?signed_in=1')).toBe('Sortable://sortable.net/?signed_in=1');
      expect(session.oauthReturnToNative).toBeUndefined();
    });

    test('takeOAuthClientRedirect leaves web URL unchanged without flag', () => {
      const session = {};
      expect(takeOAuthClientRedirect(session, '/?signed_in=1')).toBe('/?signed_in=1');
    });

    test('takeOAuthClientRedirect does not rewrite unsafe targets', () => {
      const session = { oauthReturnToNative: true };
      expect(takeOAuthClientRedirect(session, '//evil')).toBe('//evil');
      expect(session.oauthReturnToNative).toBeUndefined();
    });

    test('captureOAuthReturnToNativeFromQuery accepts return_native=true', () => {
      const session = {};
      captureOAuthReturnToNativeFromQuery({ query: { return_native: 'true' }, session });
      expect(takeOAuthClientRedirect(session, '/login?error=apple')).toBe(
        'Sortable://sortable.net/login?error=apple'
      );
    });
  });

  describe('OAuth return-native signed state (cross-browser callback)', () => {
    const prevSecret = process.env.SESSION_SECRET;

    afterEach(() => {
      process.env.SESSION_SECRET = prevSecret;
    });

    test('createOAuthReturnNativeState returns null without return_native', () => {
      process.env.SESSION_SECRET = 'unit-test-session-secret-value-32chars';
      expect(
        createOAuthReturnNativeState({ query: {}, path: '/api/auth/google', method: 'GET' })
      ).toBeNull();
    });

    test('takeOAuthClientRedirect uses signed-state option when session was reset (after logIn)', () => {
      expect(
        takeOAuthClientRedirect({}, '/?signed_in=1', { returnNativeFromSignedState: true })
      ).toBe('Sortable://sortable.net/?signed_in=1');
    });

    test('hydrate from query.state returns true and enables redirect with a fresh session object', () => {
      process.env.SESSION_SECRET = 'unit-test-session-secret-value-32chars';
      const token = createOAuthReturnNativeState({
        query: { return_native: '1' },
        path: '/api/auth/google',
        method: 'GET',
      });
      expect(typeof token).toBe('string');
      const session = {};
      expect(
        hydrateOAuthReturnToNativeFromOAuthState({
          query: { state: token },
          body: {},
          session,
          path: '/api/auth/google/callback',
          method: 'GET',
        })
      ).toBe(true);
      expect(takeOAuthClientRedirect(session, '/?signed_in=1', { returnNativeFromSignedState: true })).toBe(
        'Sortable://sortable.net/?signed_in=1'
      );
    });

    test('takeOAuthClientRedirect appends oauth_handoff when handoffUserId is set', () => {
      process.env.SESSION_SECRET = 'unit-test-session-secret-value-32chars';
      const url = takeOAuthClientRedirect(
        {},
        '/?signed_in=1',
        { returnNativeFromSignedState: true, handoffUserId: 42 }
      );
      expect(url.startsWith('Sortable://sortable.net/?signed_in=1&oauth_handoff=')).toBe(true);
    });

    test('verifyNativeOAuthSessionHandoffToken round-trips handoff from redirect URL', () => {
      process.env.SESSION_SECRET = 'unit-test-session-secret-value-32chars';
      const url = takeOAuthClientRedirect(
        {},
        '/?signed_in=1',
        { returnNativeFromSignedState: true, handoffUserId: 99 }
      );
      const raw = url.split('oauth_handoff=')[1];
      expect(raw).toBeTruthy();
      const token = decodeURIComponent(raw);
      expect(verifyNativeOAuthSessionHandoffToken(token).userId).toBe(99);
    });

    test('hydrate from body.state returns true (Apple callback)', () => {
      process.env.SESSION_SECRET = 'unit-test-session-secret-value-32chars';
      const token = createOAuthReturnNativeState({
        query: { return_native: '1' },
        path: '/api/auth/apple',
        method: 'GET',
      });
      const session = {};
      expect(
        hydrateOAuthReturnToNativeFromOAuthState({
          query: {},
          body: { state: token },
          session,
          path: '/api/auth/apple/callback',
          method: 'POST',
        })
      ).toBe(true);
      expect(session.oauthReturnToNative).toBe(true);
    });
  });

  describe('getUserForNativeOAuthSessionHandoff', () => {
    const prevSecret = process.env.SESSION_SECRET;

    afterEach(() => {
      process.env.SESSION_SECRET = prevSecret;
    });

    test('returns user when token verifies and user exists', async () => {
      process.env.SESSION_SECRET = 'unit-test-session-secret-value-32chars';
      const url = takeOAuthClientRedirect(
        {},
        '/?signed_in=1',
        { returnNativeFromSignedState: true, handoffUserId: 7 }
      );
      const raw = url.split('oauth_handoff=')[1];
      const token = decodeURIComponent(raw);
      authQueries.findUserById.mockResolvedValue({
        user_id: 7,
        username: 'native',
        email: null,
        profile_picture: null,
        google_id: null,
        apple_id: null,
        privacy_policy_agreed: true,
        terms_agreed: true,
        created_at: '',
        updated_at: '',
      });
      const user = await getUserForNativeOAuthSessionHandoff(token);
      expect(user.user_id).toBe(7);
      expect(authQueries.findUserById).toHaveBeenCalledWith(7);
    });

    test('throws NATIVE_HANDOFF_TOKEN_REQUIRED when token missing', async () => {
      await expect(getUserForNativeOAuthSessionHandoff('')).rejects.toMatchObject({
        code: 'NATIVE_HANDOFF_TOKEN_REQUIRED',
      });
      await expect(getUserForNativeOAuthSessionHandoff(null)).rejects.toMatchObject({
        code: 'NATIVE_HANDOFF_TOKEN_REQUIRED',
      });
    });

    test('throws when JWT is invalid (same as verify)', async () => {
      process.env.SESSION_SECRET = 'unit-test-session-secret-value-32chars';
      await expect(getUserForNativeOAuthSessionHandoff('not-a-jwt')).rejects.toThrow();
    });

    test('throws NATIVE_HANDOFF_UNKNOWN_USER when user row missing', async () => {
      process.env.SESSION_SECRET = 'unit-test-session-secret-value-32chars';
      const url = takeOAuthClientRedirect(
        {},
        '/?signed_in=1',
        { returnNativeFromSignedState: true, handoffUserId: 42 }
      );
      const token = decodeURIComponent(url.split('oauth_handoff=')[1]);
      authQueries.findUserById.mockResolvedValue(null);
      await expect(getUserForNativeOAuthSessionHandoff(token)).rejects.toMatchObject({
        code: 'NATIVE_HANDOFF_UNKNOWN_USER',
      });
    });
  });

  describe('native link bootstrap JWT (Capacitor link-account → system browser)', () => {
    const prevSecret = process.env.SESSION_SECRET;

    afterEach(() => {
      process.env.SESSION_SECRET = prevSecret;
    });

    test('create and verify round-trip for google', () => {
      process.env.SESSION_SECRET = 'unit-test-session-secret-value-32chars';
      const t = createNativeOAuthLinkBootstrapToken(5, 'google');
      expect(typeof t).toBe('string');
      expect(verifyNativeOAuthLinkBootstrapToken(t)).toEqual({ userId: 5, provider: 'google' });
    });

    test('create and verify round-trip for apple', () => {
      process.env.SESSION_SECRET = 'unit-test-session-secret-value-32chars';
      const t = createNativeOAuthLinkBootstrapToken(9, 'apple');
      expect(verifyNativeOAuthLinkBootstrapToken(t)).toEqual({ userId: 9, provider: 'apple' });
    });

    test('reject wrong shape token', () => {
      process.env.SESSION_SECRET = 'unit-test-session-secret-value-32chars';
      expect(() => verifyNativeOAuthLinkBootstrapToken('x')).toThrow();
    });
  });

  describe('registerUser', () => {
    test('creates a local user with null email when email is omitted', async () => {
      authQueries.findUserByUsername.mockResolvedValue(null);
      const created = {
        user_id: 1,
        username: 'alice',
        email: null,
        profile_picture: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      authQueries.createLocalUser.mockResolvedValue(created);

      const result = await registerUser({
        username: 'alice',
        password: 'password123',
      });

      expect(result).toEqual(created);
      expect(authQueries.findUserByEmail).not.toHaveBeenCalled();
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 12);
      expect(authQueries.createLocalUser).toHaveBeenCalledWith({
        username: 'alice',
        email: null,
        password: 'hashed-password',
      });
    });

    test('creates a local user when an email is provided', async () => {
      authQueries.findUserByUsername.mockResolvedValue(null);
      authQueries.findUserByEmail.mockResolvedValue(null);
      const created = {
        user_id: 2,
        username: 'bob',
        email: 'bob@example.com',
        profile_picture: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      authQueries.createLocalUser.mockResolvedValue(created);

      const result = await registerUser({
        username: 'bob',
        email: 'bob@example.com',
        password: 'password123',
      });

      expect(result).toEqual(created);
      expect(authQueries.findUserByEmail).toHaveBeenCalledWith('bob@example.com');
      expect(authQueries.createLocalUser).toHaveBeenCalledWith({
        username: 'bob',
        email: 'bob@example.com',
        password: 'hashed-password',
      });
    });

    test('rejects when username is already taken', async () => {
      authQueries.findUserByUsername.mockResolvedValue({ user_id: 99 });

      await expect(
        registerUser({ username: 'taken', password: 'password123' })
      ).rejects.toMatchObject({ code: 'USERNAME_TAKEN' });

      expect(authQueries.createLocalUser).not.toHaveBeenCalled();
    });

    test('rejects when email is already in use', async () => {
      authQueries.findUserByUsername.mockResolvedValue(null);
      authQueries.findUserByEmail.mockResolvedValue({ user_id: 88 });

      await expect(
        registerUser({
          username: 'newuser',
          email: 'exists@example.com',
          password: 'password123',
        })
      ).rejects.toMatchObject({ code: 'EMAIL_TAKEN' });

      expect(authQueries.createLocalUser).not.toHaveBeenCalled();
    });
  });
});
