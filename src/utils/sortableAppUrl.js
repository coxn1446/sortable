/** Matches server deep links in `server/services/authService.js` and `capacitor.config.ts`. */
export const SORTABLE_NATIVE_URL_HOST = 'sortable.net';
export const SORTABLE_NATIVE_URL_SCHEME = 'Sortable';

/**
 * @param {string} url
 * @returns {string|null} pathname + search for React Router, or null if not our app deep link
 */
export function pathFromSortableAppUrl(url) {
  if (url == null || typeof url !== 'string' || !url.trim()) {
    return null;
  }
  let parsed;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  const scheme = parsed.protocol.replace(/:$/, '').toLowerCase();
  if (scheme !== 'sortable') {
    return null;
  }
  if (parsed.hostname.toLowerCase() !== SORTABLE_NATIVE_URL_HOST) {
    return null;
  }
  const pathPart = parsed.pathname === '' ? '/' : parsed.pathname;
  return `${pathPart}${parsed.search || ''}`;
}

/**
 * @param {string} path pathname + search from `pathFromSortableAppUrl`
 * @returns {string} same path without `oauth_handoff` query param
 */
export function stripOAuthHandoffFromInternalPath(path) {
  if (path == null || typeof path !== 'string') {
    return '/';
  }
  const q = path.indexOf('?');
  if (q === -1) {
    return path || '/';
  }
  const pathname = path.slice(0, q) || '/';
  const sp = new URLSearchParams(path.slice(q + 1));
  sp.delete('oauth_handoff');
  const rest = sp.toString();
  if (!rest) {
    return pathname;
  }
  return `${pathname}?${rest}`;
}
