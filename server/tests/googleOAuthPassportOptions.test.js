const {
  GOOGLE_PASSPORT_AUTHENTICATE_DEFAULTS,
  buildGoogleAuthenticateOptions,
} = require('../utils/googleOAuthPassportOptions');

describe('googleOAuthPassportOptions', () => {
  test('defaults include select_account prompt and profile scopes', () => {
    expect(GOOGLE_PASSPORT_AUTHENTICATE_DEFAULTS.prompt).toBe('select_account');
    expect(GOOGLE_PASSPORT_AUTHENTICATE_DEFAULTS.scope).toEqual(['profile', 'email']);
  });

  test('buildGoogleAuthenticateOptions merges overrides without mutating defaults', () => {
    const opts = buildGoogleAuthenticateOptions({ state: 'jwt-here' });
    expect(opts.prompt).toBe('select_account');
    expect(opts.scope).toEqual(['profile', 'email']);
    expect(opts.state).toBe('jwt-here');
    expect(GOOGLE_PASSPORT_AUTHENTICATE_DEFAULTS).not.toHaveProperty('state');
  });
});
