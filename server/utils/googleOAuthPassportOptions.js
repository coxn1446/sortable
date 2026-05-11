/**
 * Options passed to `passport.authenticate('google', opts)` for the authorization redirect.
 *
 * `prompt: 'select_account'` forces Google’s account chooser on every sign-in/link start so the
 * IdP does not silently reuse the last session account (common in embedded / in-app browsers).
 *
 * @see https://developers.google.com/identity/protocols/oauth2/openid-connect#authenticationuriparameters
 */

const GOOGLE_PASSPORT_AUTHENTICATE_DEFAULTS = Object.freeze({
  scope: ['profile', 'email'],
  prompt: 'select_account',
});

/**
 * @param {Record<string, unknown>} [overrides] e.g. `{ state: signedJwt }` for native return
 * @returns {Record<string, unknown>}
 */
function buildGoogleAuthenticateOptions(overrides = {}) {
  return {
    ...GOOGLE_PASSPORT_AUTHENTICATE_DEFAULTS,
    ...overrides,
  };
}

module.exports = {
  GOOGLE_PASSPORT_AUTHENTICATE_DEFAULTS,
  buildGoogleAuthenticateOptions,
};
