/**
 * AuraSphere-compatible dev TLS: writes self-signed cert/key under certs/ (gitignored).
 *
 * Usage: npm run generate-cert:selfsigned  |  npm run cert
 * Then set SSL_CRT_FILE and SSL_KEY_FILE in .env.
 *
 * subjectAltName entries are either DNS (dNSName) or IP (iPAddress). Hostnames such as
 * *.ngrok-free.app must be DNS only; node-forge rejects type 7 (IP) for non-IP strings.
 */
require('dotenv').config({ quiet: true });
const selfsigned = require('selfsigned');
const fs = require('fs');
const net = require('net');
const path = require('path');
const { exec } = require('child_process');

/** Default SANs; IPs from historical Sortable dev machines. Merge env-driven hostnames below. */
const DEFAULT_SAN_CANDIDATES = [
  'localhost',
  '127.0.0.1',
  '10.232.177.44',
  '192.168.1.183',
  '0.0.0.0',
  '172.20.10.3',
  '192.168.0.153',
  '192.168.86.51',
  '100.68.155.71',
  '192.168.0.170',
  '172.20.10.5',
  '192.168.1.199',
  '10.0.0.76',
  '192.168.1.182',
  '192.168.0.171',
  '10.13.68.122',
];

function tryHostnameFromUrl(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') return null;
  try {
    const u = new URL(String(urlStr).trim());
    return u.hostname || null;
  } catch {
    return null;
  }
}

function extraSansFromEnv() {
  const out = [];
  for (const key of ['CAP_DEV_URL', 'CAPACITOR_DEV_SERVER_URL', 'CAP_SERVER_URL_DEV']) {
    const h = tryHostnameFromUrl(process.env[key]);
    if (h) out.push(h);
  }
  const rawExtra = process.env.DEV_TLS_EXTRA_SANS;
  if (rawExtra && typeof rawExtra === 'string') {
    rawExtra.split(',').forEach((s) => {
      const t = s.trim();
      if (t) out.push(t);
    });
  }
  return out;
}

/**
 * @param {string[]} candidates
 * @returns {Array<{ type: 2; value: string } | { type: 7; ip: string }>}
 */
function buildAltNames(candidates) {
  const seen = new Set();
  const altNames = [];
  for (const raw of candidates) {
    const s = String(raw ?? '').trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    if (net.isIP(s)) {
      altNames.push({ type: 7, ip: s });
    } else {
      altNames.push({ type: 2, value: s });
    }
  }
  return altNames;
}

const attrs = [
  { name: 'commonName', value: 'localhost' },
  { name: 'countryName', value: 'US' },
  { name: 'organizationName', value: 'Sortable Development' },
  { name: 'organizationalUnitName', value: 'Development' },
];

const pems = selfsigned.generate(attrs, {
  algorithm: 'sha256',
  keySize: 2048,
  days: 365,
  extensions: [
    {
      name: 'basicConstraints',
      cA: true,
    },
    {
      name: 'keyUsage',
      keyCertSign: true,
      digitalSignature: true,
      nonRepudiation: true,
      keyEncipherment: true,
      dataEncipherment: true,
    },
    {
      name: 'extKeyUsage',
      serverAuth: true,
      clientAuth: true,
    },
    {
      name: 'subjectAltName',
      altNames: buildAltNames([...DEFAULT_SAN_CANDIDATES, ...extraSansFromEnv()]),
    },
  ],
});

const certPath = path.join(__dirname, '..', 'certs');
if (!fs.existsSync(certPath)) {
  fs.mkdirSync(certPath, { recursive: true });
}

fs.writeFileSync(path.join(certPath, 'cert.pem'), pems.cert);
fs.writeFileSync(path.join(certPath, 'key.pem'), pems.private);
fs.writeFileSync(path.join(certPath, 'ca.pem'), pems.cert);

// eslint-disable-next-line no-console
console.log(`Wrote ${path.join(certPath, 'cert.pem')}, key.pem, ca.pem`);
// eslint-disable-next-line no-console
console.log('Add to .env:\n  SSL_CRT_FILE=./certs/cert.pem\n  SSL_KEY_FILE=./certs/key.pem');
// eslint-disable-next-line no-console
console.log(
  'Optional: set DEV_TLS_EXTRA_SANS=host1,host2 or rely on CAP_DEV_URL hostname for tunnel SANs.'
);
// eslint-disable-next-line no-console
console.log('Physical iOS: AirDrop ca.pem (or cert.pem) and enable in Settings → General → About → Certificate Trust Settings.');
// eslint-disable-next-line no-console
console.log('Capacitor: CAPACITOR_DEV_SERVER_URL=https://192.168.0.171:3000 (your Mac LAN IP), then npm run s:dev');

if (process.platform === 'darwin') {
  const certFile = path.join(certPath, 'cert.pem');
  exec(
    `security add-trusted-cert -d -r trustRoot -k ~/Library/Keychains/login.keychain-db "${certFile}"`,
    (error) => {
      if (error) {
        return;
      }
    }
  );
} else if (process.platform === 'win32') {
  const certFile = path.join(certPath, 'cert.pem');
  exec(`certutil -addstore -f "ROOT" "${certFile}"`, (error) => {
    if (error) {
      return;
    }
  });
}
