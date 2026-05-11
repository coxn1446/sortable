jest.mock('bcrypt', () => ({
  hash: jest.fn(() => Promise.resolve('hashed-password')),
  compare: jest.fn(),
}));

jest.mock('../queries/authQueries', () => ({
  findUserByEmailWithPassword: jest.fn(),
  attachGoogleToUser: jest.fn(),
}));

const bcrypt = require('bcrypt');
const authQueries = require('../queries/authQueries');
const {
  completeGoogleAccountLink,
  getPendingGoogleLinkForClient,
} = require('../services/authService');

describe('Google account link (authService)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPendingGoogleLinkForClient', () => {
    test('returns pending false when session has no payload', () => {
      expect(getPendingGoogleLinkForClient({})).toEqual({ pending: false });
    });

    test('returns pending with email and username before expiry', () => {
      const session = {
        pendingGoogleLink: {
          email: 'a@b.com',
          username: 'alice',
          google_id: 'g1',
          expiresAt: Date.now() + 60_000,
        },
      };
      expect(getPendingGoogleLinkForClient(session)).toEqual({
        pending: true,
        email: 'a@b.com',
        username: 'alice',
      });
    });

    test('clears session and returns expired after TTL', () => {
      const session = {
        pendingGoogleLink: {
          email: 'a@b.com',
          username: 'alice',
          google_id: 'g1',
          expiresAt: Date.now() - 1,
        },
      };
      expect(getPendingGoogleLinkForClient(session)).toEqual({
        pending: false,
        expired: true,
      });
      expect(session.pendingGoogleLink).toBeUndefined();
    });
  });

  describe('completeGoogleAccountLink', () => {
    test('throws when no pending link in session', async () => {
      await expect(completeGoogleAccountLink({}, 'secret')).rejects.toMatchObject({
        code: 'GOOGLE_LINK_NOT_PENDING',
      });
    });

    test('throws when pending link expired', async () => {
      const session = {
        pendingGoogleLink: {
          email: 'a@b.com',
          google_id: 'g1',
          expiresAt: Date.now() - 1,
        },
      };
      await expect(completeGoogleAccountLink(session, 'secret')).rejects.toMatchObject({
        code: 'GOOGLE_LINK_EXPIRED',
      });
      expect(session.pendingGoogleLink).toBeUndefined();
    });

    test('rejects wrong password without clearing pending', async () => {
      const session = {
        pendingGoogleLink: {
          email: 'a@b.com',
          google_id: 'g-new',
          expiresAt: Date.now() + 60_000,
        },
      };
      authQueries.findUserByEmailWithPassword.mockResolvedValue({
        user_id: 1,
        email: 'a@b.com',
        username: 'alice',
        password: 'hash',
        google_id: null,
      });
      bcrypt.compare.mockResolvedValue(false);

      await expect(completeGoogleAccountLink(session, 'wrong')).rejects.toMatchObject({
        code: 'GOOGLE_LINK_BAD_PASSWORD',
      });
      expect(session.pendingGoogleLink).toBeDefined();
    });

    test('attaches Google id and clears session on success', async () => {
      const session = {
        pendingGoogleLink: {
          email: 'a@b.com',
          google_id: 'g-new',
          profile_picture: 'https://ex/p.png',
          expiresAt: Date.now() + 60_000,
        },
      };
      authQueries.findUserByEmailWithPassword.mockResolvedValue({
        user_id: 1,
        email: 'a@b.com',
        username: 'alice',
        password: 'hash',
        google_id: null,
      });
      bcrypt.compare.mockResolvedValue(true);
      authQueries.attachGoogleToUser.mockResolvedValue({
        user_id: 1,
        username: 'alice',
        email: 'a@b.com',
        profile_picture: 'https://ex/p.png',
        privacy_policy_agreed: true,
        terms_agreed: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const user = await completeGoogleAccountLink(session, 'ok');

      expect(user).toMatchObject({ user_id: 1, email: 'a@b.com' });
      expect(user.google_id).toBeUndefined();
      expect(session.pendingGoogleLink).toBeUndefined();
      expect(authQueries.attachGoogleToUser).toHaveBeenCalledWith({
        userId: 1,
        google_id: 'g-new',
        profile_picture: 'https://ex/p.png',
        google_email: 'a@b.com',
      });
    });

    test('when google_id already matches, verifies password then returns public user', async () => {
      const session = {
        pendingGoogleLink: {
          email: 'a@b.com',
          google_id: 'g-same',
          expiresAt: Date.now() + 60_000,
        },
      };
      authQueries.findUserByEmailWithPassword.mockResolvedValue({
        user_id: 1,
        email: 'a@b.com',
        username: 'alice',
        password: 'hash',
        google_id: 'g-same',
      });
      bcrypt.compare.mockResolvedValue(true);

      const user = await completeGoogleAccountLink(session, 'ok');

      expect(user.user_id).toBe(1);
      expect(authQueries.attachGoogleToUser).not.toHaveBeenCalled();
      expect(session.pendingGoogleLink).toBeUndefined();
    });

    test('throws conflict when account is linked to a different Google id', async () => {
      const session = {
        pendingGoogleLink: {
          email: 'a@b.com',
          google_id: 'g-new',
          expiresAt: Date.now() + 60_000,
        },
      };
      authQueries.findUserByEmailWithPassword.mockResolvedValue({
        user_id: 1,
        email: 'a@b.com',
        username: 'alice',
        password: 'hash',
        google_id: 'g-other',
      });

      await expect(completeGoogleAccountLink(session, 'ok')).rejects.toMatchObject({
        code: 'GOOGLE_LINK_CONFLICT',
      });
      expect(session.pendingGoogleLink).toBeUndefined();
    });
  });
});
