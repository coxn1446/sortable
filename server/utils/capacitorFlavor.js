/**
 * Capacitor iOS/Android bundle + hosted WebView URL per environment (AuraSphere-style).
 * Uses CAP_APP_ENV — not NODE_ENV — so `npx cap sync` does not accidentally follow Node production mode.
 */

const { isCapacitorCleartextForServerUrl } = require('./capacitorDevServerUrl');

const DEFAULT_PROD_URL = 'https://sortable.net';
const DEFAULT_QA_URL = 'https://qa.sortable.net';

const DEFAULT_ALLOW_NAVIGATION_HOSTS = [
  'sortable.net',
  'qa.sortable.net',
  'www.sortable.net',
  /** Google / Apple OAuth redirects from `/api/auth/google` and `/api/auth/apple` (WKWebView must be allowed to follow IdP URLs). */
  'accounts.google.com',
  'appleid.apple.com',
];

/**
 * @param {string | undefined} raw
 * @returns {'prod' | 'qa' | 'dev'}
 */
function normalizeCapAppEnv(raw) {
  const v = String(raw ?? '').trim().toLowerCase();
  if (v === 'prod' || v === 'production') return 'prod';
  if (v === 'qa') return 'qa';
  return 'dev';
}

function getDevServerUrl(env) {
  const candidates = [env.CAP_DEV_URL, env.CAP_SERVER_URL_DEV, env.CAPACITOR_DEV_SERVER_URL];
  const first = candidates.find((x) => typeof x === 'string' && x.trim());
  return first ? first.trim() : 'http://localhost:3000';
}

/**
 * Hostnames the WKWebView may navigate to (IdP + dev tunnel), merged into Capacitor config.
 *
 * @param {Record<string, string | undefined>} env
 * @returns {string[]}
 */
function getCapacitorAllowNavigationHosts(env = process.env) {
  const hosts = new Set(DEFAULT_ALLOW_NAVIGATION_HOSTS);
  const extras = String(env.CAP_ALLOW_NAVIGATION_HOSTS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  extras.forEach((h) => hosts.add(h));

  if (normalizeCapAppEnv(env.CAP_APP_ENV) === 'dev') {
    try {
      const host = new URL(getDevServerUrl(env)).hostname;
      if (host) hosts.add(host);
    } catch {
      /* ignore invalid dev URL */
    }
  }

  return [...hosts];
}

/**
 * @param {Record<string, string | undefined>} [env]
 * @returns {{
 *   flavor: 'prod' | 'qa' | 'dev',
 *   appId: string,
 *   appName: string,
 *   serverUrl: string,
 *   cleartext: boolean,
 *   allowNavigationHosts: string[],
 * }}
 */
function getCapacitorFlavorConfig(env = process.env) {
  const flavor = normalizeCapAppEnv(env.CAP_APP_ENV);
  const prodUrl = (env.CAP_PROD_URL || env.CAP_SERVER_URL_PROD || '').trim();
  const qaUrl = (env.CAP_QA_URL || env.CAP_SERVER_URL_QA || '').trim();
  const devUrl = getDevServerUrl(env);

  /** @type {{ appId: string, appName: string, serverUrl: string }} */
  let resolved;
  switch (flavor) {
    case 'prod':
      resolved = {
        appId: 'net.sortable.prod',
        appName: 'Sortable Prod',
        serverUrl: prodUrl || DEFAULT_PROD_URL,
      };
      break;
    case 'qa':
      resolved = {
        appId: 'net.sortable.qa',
        appName: 'Sortable QA',
        serverUrl: qaUrl || DEFAULT_QA_URL,
      };
      break;
    default:
      resolved = {
        appId: 'net.sortable.dev',
        appName: 'Sortable Dev',
        serverUrl: devUrl,
      };
      break;
  }

  return {
    flavor,
    appId: resolved.appId,
    appName: resolved.appName,
    serverUrl: resolved.serverUrl,
    cleartext: isCapacitorCleartextForServerUrl(resolved.serverUrl),
    allowNavigationHosts: getCapacitorAllowNavigationHosts(env),
  };
}

module.exports = {
  normalizeCapAppEnv,
  getCapacitorFlavorConfig,
  getCapacitorAllowNavigationHosts,
  getDevServerUrl,
  DEFAULT_PROD_URL,
  DEFAULT_QA_URL,
};
