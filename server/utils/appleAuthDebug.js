const crypto = require('crypto');

function countLiteralBackslashN(str) {
  let n = 0;
  for (let i = 0; i < str.length - 1; i += 1) {
    if (str.charCodeAt(i) === 92 && str.charCodeAt(i + 1) === 110) n += 1;
  }
  return n;
}

/**
 * Logs non-secret shape checks for Sign in with Apple config.
 * Opt-in only: set DEBUG_APPLE_AUTH=1 (any environment).
 */
function logAppleSignInDiagnostics() {
  if (process.env.DEBUG_APPLE_AUTH !== '1') {
    return;
  }

  const clientId = process.env.APPLE_CLIENT_ID || '';
  const teamId = process.env.APPLE_TEAM_ID || '';
  const keyId = process.env.APPLE_KEY_ID || '';
  const key = process.env.APPLE_KEY;
  const baseUrl = process.env.DEFAULT_CLIENT_URL || '(unset)';

  console.log('[apple-auth] Sign in with Apple — env diagnostics (key contents never logged):');
  console.log(`  DEFAULT_CLIENT_URL: ${baseUrl}`);
  console.log(`  OAuth redirect / token callback (must match Apple Services ID): ${baseUrl}/api/auth/apple/callback`);
  console.log(`  APPLE_CLIENT_ID: ${clientId || '(missing)'}`);
  console.log(`  APPLE_TEAM_ID: ${teamId || '(missing)'}`);
  console.log(`  APPLE_KEY_ID: ${keyId || '(missing)'}`);
  if (process.env.APPLE_KEY_FILE && String(process.env.APPLE_KEY_FILE).trim()) {
    const f = String(process.env.APPLE_KEY_FILE).trim();
    console.log(`  APPLE_KEY_FILE: ${f}`);
    const idFromFile = f.match(/AuthKey_([A-Za-z0-9]+)\.p8/i);
    if (idFromFile && keyId.trim() && idFromFile[1].toUpperCase() !== keyId.trim().toUpperCase()) {
      console.warn(
        `  WARNING: APPLE_KEY_ID (${keyId.trim()}) does not match key file (${idFromFile[1]}). The Key ID in .env must match Apple's AuthKey_<KEYID>.p8 filename — mismatch causes Apple invalid_client.`
      );
    }
  }

  if (typeof key !== 'string' || !key.trim()) {
    console.log('  APPLE_KEY: (missing or empty)');
    return;
  }

  const pem = key.trim();
  const lines = pem.split(/\r?\n/);
  const newlineCount = (pem.match(/\n/g) || []).length;
  const literalBackslashN = countLiteralBackslashN(pem);
  const hasBegin = pem.includes('-----BEGIN');
  const hasEnd = pem.includes('-----END');
  console.log(`  APPLE_KEY length (chars): ${pem.length}`);
  console.log(`  APPLE_KEY PEM lines (split on newline): ${lines.length}`);
  console.log(`  APPLE_KEY newline count (\\n chars): ${newlineCount}`);
  console.log(`  APPLE_KEY literal backslash-n pairs (0x5C 0x6E): ${literalBackslashN}`);
  console.log(`  APPLE_KEY has BEGIN/END markers: ${hasBegin && hasEnd}`);

  if (literalBackslashN > 0 && newlineCount === 0) {
    console.warn(
      '  APPLE_KEY: contains backslash-n pairs but no real newline bytes — escapes may be wrong in .env. Prefer APPLE_KEY_FILE=./AuthKey_xxx.p8 or a properly quoted multiline value.'
    );
  }

  if (hasBegin && !hasEnd) {
    console.warn(
      '  APPLE_KEY: PEM has BEGIN but no END — often caused by unquoted multiline .env. Use quoted multiline or one line with \\n (see .env.example).'
    );
  }

  if (pem.length < 80) {
    console.warn(
      `  APPLE_KEY: very short (${pem.length} chars); real .p8 PEMs are usually hundreds of characters.`
    );
  }

  try {
    crypto.createPrivateKey(pem);
    console.log('  APPLE_KEY: Node.js createPrivateKey: OK (usable for ES256 client secret JWT)');
  } catch (err) {
    console.warn(`  APPLE_KEY: Node.js createPrivateKey failed: ${err.message}`);
    console.warn(
      '  Hint: download `AuthKey_<KEYID>.p8` from Apple, place it in the repo root (gitignored), set APPLE_KEY_FILE=./AuthKey_xxx.p8, and omit APPLE_KEY. Or run: openssl pkey -in AuthKey.p8 -text -noout'
    );
  }
}

module.exports = { logAppleSignInDiagnostics };
