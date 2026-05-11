/**
 * Blocks authenticated API use until current policies are acknowledged.
 * Place after `requireAuth` on routes that should not run while flags are false.
 */
function requirePolicyConsent(req, res, next) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return next();
  }
  const u = req.user;
  if (!u) return next();
  if (u.privacy_policy_agreed === false || u.terms_agreed === false) {
    return res.status(403).json({
      error: 'Updated policies require your acknowledgment',
      code: 'POLICY_CONSENT_REQUIRED',
      needs_privacy: u.privacy_policy_agreed === false,
      needs_terms: u.terms_agreed === false,
    });
  }
  return next();
}

module.exports = { requirePolicyConsent };
