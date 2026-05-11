jest.mock('../queries/userQueries', () => ({
  findUserById: jest.fn(),
  findUserByIdWithPassword: jest.fn(),
  updateUser: jest.fn(),
  patchPolicyAgreement: jest.fn(),
  findOtherUserWithUsername: jest.fn(),
  findOtherUserWithEmail: jest.fn(),
  unlinkGoogle: jest.fn(),
  unlinkApple: jest.fn(),
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

describe('userService.acceptUpdatedPolicies', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns without patch when fully agreed', async () => {
    userQueries.findUserById.mockResolvedValue({
      user_id: 1,
      privacy_policy_agreed: true,
      terms_agreed: true,
    });

    const row = await userService.acceptUpdatedPolicies(1, {
      accept_privacy: false,
      accept_terms: false,
    });

    expect(row?.privacy_policy_agreed).toBe(true);
    expect(userQueries.patchPolicyAgreement).not.toHaveBeenCalled();
  });

  test('patches when both pending and body accepts both', async () => {
    userQueries.findUserById.mockResolvedValue({
      user_id: 1,
      privacy_policy_agreed: false,
      terms_agreed: false,
    });
    userQueries.patchPolicyAgreement.mockResolvedValue({
      user_id: 1,
      privacy_policy_agreed: true,
      terms_agreed: true,
    });

    await userService.acceptUpdatedPolicies(1, {
      accept_privacy: true,
      accept_terms: true,
    });

    expect(userQueries.patchPolicyAgreement).toHaveBeenCalledWith(1, true, true);
  });

  test('rejects when privacy pending but accept_privacy false', async () => {
    userQueries.findUserById.mockResolvedValue({
      user_id: 1,
      privacy_policy_agreed: false,
      terms_agreed: true,
    });

    await expect(
      userService.acceptUpdatedPolicies(1, { accept_privacy: false, accept_terms: false })
    ).rejects.toMatchObject({ code: 'PRIVACY_ACCEPTANCE_REQUIRED' });

    expect(userQueries.patchPolicyAgreement).not.toHaveBeenCalled();
  });

  test('rejects when terms pending but accept_terms false', async () => {
    userQueries.findUserById.mockResolvedValue({
      user_id: 1,
      privacy_policy_agreed: true,
      terms_agreed: false,
    });

    await expect(
      userService.acceptUpdatedPolicies(1, { accept_privacy: false, accept_terms: false })
    ).rejects.toMatchObject({ code: 'TERMS_ACCEPTANCE_REQUIRED' });

    expect(userQueries.patchPolicyAgreement).not.toHaveBeenCalled();
  });

  test('patches only terms when privacy already agreed', async () => {
    userQueries.findUserById.mockResolvedValue({
      user_id: 1,
      privacy_policy_agreed: true,
      terms_agreed: false,
    });
    userQueries.patchPolicyAgreement.mockResolvedValue({
      user_id: 1,
      privacy_policy_agreed: true,
      terms_agreed: true,
    });

    await userService.acceptUpdatedPolicies(1, {
      accept_privacy: false,
      accept_terms: true,
    });

    expect(userQueries.patchPolicyAgreement).toHaveBeenCalledWith(1, true, true);
  });
});

describe('userService.changePassword', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('sets password when user has none', async () => {
    userQueries.findUserByIdWithPassword.mockResolvedValue({
      user_id: 1,
      password: null,
    });
    userQueries.updateUser.mockResolvedValue({ user_id: 1 });

    await userService.changePassword(1, { new_password: 'newpass12' });

    expect(userQueries.findUserByIdWithPassword).toHaveBeenCalledWith(1);
    expect(userQueries.updateUser).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ password: expect.any(String) })
    );
  });

  test('requires current password when one exists', async () => {
    userQueries.findUserByIdWithPassword.mockResolvedValue({
      user_id: 1,
      password: '$2b$12$existinghashherenotrealvalue',
    });

    await expect(
      userService.changePassword(1, { new_password: 'newpass12' })
    ).rejects.toMatchObject({ code: 'CURRENT_PASSWORD_REQUIRED' });

    expect(userQueries.updateUser).not.toHaveBeenCalled();
  });
});

describe('userService.unlinkOAuthProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('removes Google when password remains', async () => {
    userQueries.findUserById.mockResolvedValue({
      user_id: 1,
      google_id: 'g',
      apple_id: null,
      password: 'hash',
    });
    userQueries.unlinkGoogle.mockResolvedValue({ user_id: 1, google_id: null });

    const u = await userService.unlinkOAuthProvider(1, 'google');

    expect(u.user_id).toBe(1);
    expect(userQueries.unlinkGoogle).toHaveBeenCalledWith(1);
  });

  test('rejects unlinking Google when it is the only credential', async () => {
    userQueries.findUserById.mockResolvedValue({
      user_id: 1,
      google_id: 'g',
      apple_id: null,
      password: null,
    });

    await expect(userService.unlinkOAuthProvider(1, 'google')).rejects.toMatchObject({
      code: 'SET_PASSWORD_REQUIRED',
    });

    expect(userQueries.unlinkGoogle).not.toHaveBeenCalled();
  });
});
