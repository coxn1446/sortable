jest.mock('../queries/userQueries', () => ({
  findUserById: jest.fn(),
  updateUser: jest.fn(),
  findOtherUserWithUsername: jest.fn(),
  findOtherUserWithEmail: jest.fn(),
}));

const userQueries = require('../queries/userQueries');
const userService = require('../services/userService');

describe('userService.updateUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    userQueries.updateUser.mockResolvedValue({ user_id: 1, username: 'new' });
  });

  test('updates when username is free (case-insensitive check)', async () => {
    userQueries.findOtherUserWithUsername.mockResolvedValue(null);
    await userService.updateUser(1, { username: 'FreshName' });
    expect(userQueries.findOtherUserWithUsername).toHaveBeenCalledWith(1, 'FreshName');
    expect(userQueries.updateUser).toHaveBeenCalledWith(1, { username: 'FreshName' });
  });

  test('rejects duplicate username with 409', async () => {
    userQueries.findOtherUserWithUsername.mockResolvedValue({ user_id: 99 });
    await expect(userService.updateUser(1, { username: 'taken' })).rejects.toMatchObject({
      status: 409,
      code: 'USERNAME_TAKEN',
    });
    expect(userQueries.updateUser).not.toHaveBeenCalled();
  });

  test('rejects blank username with 400', async () => {
    await expect(userService.updateUser(1, { username: '   ' })).rejects.toMatchObject({ status: 400 });
    expect(userQueries.updateUser).not.toHaveBeenCalled();
  });

  test('rejects duplicate email with 409', async () => {
    userQueries.findOtherUserWithEmail.mockResolvedValue({ user_id: 88 });
    await expect(userService.updateUser(1, { email: 'other@example.com' })).rejects.toMatchObject({
      status: 409,
      code: 'EMAIL_TAKEN',
    });
    expect(userQueries.updateUser).not.toHaveBeenCalled();
  });

  test('allows clearing email when no conflict', async () => {
    userQueries.findOtherUserWithEmail.mockResolvedValue(null);
    await userService.updateUser(1, { email: null });
    expect(userQueries.updateUser).toHaveBeenCalledWith(1, { email: null });
  });
});
