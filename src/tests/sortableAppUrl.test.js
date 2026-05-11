import {
  pathFromSortableAppUrl,
  stripOAuthHandoffFromInternalPath,
  SORTABLE_NATIVE_URL_HOST,
  SORTABLE_NATIVE_URL_SCHEME,
} from '../utils/sortableAppUrl';

describe('sortableAppUrl', () => {
  test('exports match capacitor / server constants', () => {
    expect(SORTABLE_NATIVE_URL_HOST).toBe('sortable.net');
    expect(SORTABLE_NATIVE_URL_SCHEME).toBe('Sortable');
  });

  describe('pathFromSortableAppUrl', () => {
    test('returns pathname + search for Sortable://sortable.net', () => {
      expect(pathFromSortableAppUrl('Sortable://sortable.net/?signed_in=1')).toBe('/?signed_in=1');
    });

    test('accepts lowercase sortable scheme', () => {
      expect(pathFromSortableAppUrl('sortable://sortable.net/login?error=apple')).toBe(
        '/login?error=apple'
      );
    });

    test('normalizes empty pathname to /', () => {
      expect(pathFromSortableAppUrl('Sortable://sortable.net')).toBe('/');
    });

    test('returns null for wrong host', () => {
      expect(pathFromSortableAppUrl('Sortable://evil.example/path')).toBeNull();
    });

    test('returns null for http(s) URLs', () => {
      expect(pathFromSortableAppUrl('https://qa.sortable.net/')).toBeNull();
      expect(pathFromSortableAppUrl('http://localhost:3000/')).toBeNull();
    });

    test('returns null for empty or invalid input', () => {
      expect(pathFromSortableAppUrl('')).toBeNull();
      expect(pathFromSortableAppUrl('   ')).toBeNull();
      expect(pathFromSortableAppUrl(null)).toBeNull();
      expect(pathFromSortableAppUrl('not a url')).toBeNull();
    });
  });

  describe('stripOAuthHandoffFromInternalPath', () => {
    test('removes oauth_handoff and keeps other params', () => {
      expect(
        stripOAuthHandoffFromInternalPath('/?signed_in=1&oauth_handoff=abc&x=1')
      ).toBe('/?signed_in=1&x=1');
    });

    test('handles oauth_handoff only', () => {
      expect(stripOAuthHandoffFromInternalPath('/?oauth_handoff=tok')).toBe('/');
    });

    test('no query unchanged', () => {
      expect(stripOAuthHandoffFromInternalPath('/profile')).toBe('/profile');
    });

    test('no oauth_handoff param unchanged', () => {
      expect(stripOAuthHandoffFromInternalPath('/?signed_in=1')).toBe('/?signed_in=1');
    });

    test('handles empty path input', () => {
      expect(stripOAuthHandoffFromInternalPath('')).toBe('/');
    });
  });
});
