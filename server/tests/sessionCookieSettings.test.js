const { getSessionCookieSameSiteAndSecure } = require('../utils/sessionCookieSettings');

describe('getSessionCookieSameSiteAndSecure', () => {
  test('uses None + Secure for https DEFAULT_CLIENT_URL', () => {
    expect(
      getSessionCookieSameSiteAndSecure({
        isProduction: false,
        defaultClientUrl: 'https://qa.sortable.net',
      })
    ).toEqual({ sameSite: 'none', secure: true });
  });

  test('trims https URL before deciding', () => {
    expect(
      getSessionCookieSameSiteAndSecure({
        defaultClientUrl: '  https://sortable.net/  ',
      })
    ).toEqual({ sameSite: 'none', secure: true });
  });

  test('uses Lax + non-secure for http localhost', () => {
    expect(
      getSessionCookieSameSiteAndSecure({
        isProduction: false,
        defaultClientUrl: 'http://localhost:3000',
      })
    ).toEqual({ sameSite: 'lax', secure: false });
  });

  test('defaults to Lax + non-secure when URL is missing or empty', () => {
    expect(getSessionCookieSameSiteAndSecure({})).toEqual({ sameSite: 'lax', secure: false });
    expect(getSessionCookieSameSiteAndSecure({ defaultClientUrl: '' })).toEqual({
      sameSite: 'lax',
      secure: false,
    });
    expect(getSessionCookieSameSiteAndSecure({ defaultClientUrl: '   ' })).toEqual({
      sameSite: 'lax',
      secure: false,
    });
  });

  test('treats non-string defaultClientUrl as empty', () => {
    expect(getSessionCookieSameSiteAndSecure({ defaultClientUrl: null })).toEqual({
      sameSite: 'lax',
      secure: false,
    });
    expect(getSessionCookieSameSiteAndSecure({ defaultClientUrl: 123 })).toEqual({
      sameSite: 'lax',
      secure: false,
    });
  });

  test('http stays Lax even in production flag', () => {
    expect(
      getSessionCookieSameSiteAndSecure({
        isProduction: true,
        defaultClientUrl: 'http://127.0.0.1:3000',
      })
    ).toEqual({ sameSite: 'lax', secure: false });
  });
});
