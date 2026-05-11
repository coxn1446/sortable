const { requirePolicyConsent } = require('../middleware/requirePolicyConsent');

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe('requirePolicyConsent', () => {
  test('passes when unauthenticated', () => {
    const req = { isAuthenticated: () => false };
    const res = mockRes();
    const next = jest.fn();
    requirePolicyConsent(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('passes when both flags true', () => {
    const req = {
      isAuthenticated: () => true,
      user: { privacy_policy_agreed: true, terms_agreed: true },
    };
    const res = mockRes();
    const next = jest.fn();
    requirePolicyConsent(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('403 with code when privacy not agreed', () => {
    const req = {
      isAuthenticated: () => true,
      user: { privacy_policy_agreed: false, terms_agreed: true },
    };
    const res = mockRes();
    const next = jest.fn();
    requirePolicyConsent(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'POLICY_CONSENT_REQUIRED', needs_privacy: true })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test('flags both pending when both columns false', () => {
    const req = {
      isAuthenticated: () => true,
      user: { privacy_policy_agreed: false, terms_agreed: false },
    };
    const res = mockRes();
    requirePolicyConsent(req, res, jest.fn());
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ needs_privacy: true, needs_terms: true })
    );
  });
});
