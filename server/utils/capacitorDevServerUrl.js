/**
 * Dev-only WebView URL for Capacitor (see capacitor.config.ts).
 * Override with CAPACITOR_DEV_SERVER_URL when testing on a physical device (use your Mac's LAN IP or tunnel).
 */
function getCapacitorDevServerUrl(env = process.env) {
  const v = env.CAPACITOR_DEV_SERVER_URL;
  if (typeof v === 'string' && v.trim()) return v.trim();
  return 'http://localhost:3000';
}

/** Capacitor `server.cleartext` must be false when loading `https://` (e.g. LAN dev with self-signed cert). */
function isCapacitorCleartextForServerUrl(url) {
  return !/^https:\/\//i.test(String(url ?? '').trim());
}

module.exports = { getCapacitorDevServerUrl, isCapacitorCleartextForServerUrl };
