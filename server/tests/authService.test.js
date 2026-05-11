jest.mock('bcrypt', () => ({
  hash: jest.fn(() => Promise.resolve('hashed-password')),
}));

jest.mock('../queries/authQueries', () => ({
  findUserByUsername: jest.fn(),
  findUserByEmail: jest.fn(),
  createLocalUser: jest.fn(),
}));

const bcrypt = require('bcrypt');
const authQueries = require('../queries/authQueries');
const { registerUser, toPublicUser, userRowHasPassword } = require('../services/authService');

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
