const fs = require('fs');
const path = require('path');

const { logAppleSignInDiagnostics } = require('./appleAuthDebug');

function secretEnvIsSet(name) {
  const raw = process.env[name];
  if (raw == null) return false;
  const v = String(raw).trim();
  if (!v) return false;
  if (v.toLowerCase() === 'placeholder') return false;
  return true;
}

/**
 * .p8 PEM in Secret Manager / .env is often one line with literal `\n` sequences;
 * .env may add a BOM; Apple files use LF or CRLF.
 * @param {string} pem
 */
function normalizeApplePrivateKey(pem) {
  if (!pem) return pem;
  let s = String(pem).replace(/^\uFEFF/, '').trim();
  if (s.includes('\\n')) {
    s = s.replace(/\\n/g, '\n');
  }
  s = s.replace(/\r\n/g, '\n');
  return s.trim();
}

const SECRETS_TO_LOAD = [
  'SESSION_SECRET',
  'DB_PASSWORD',
  'DB_USER',
  'DB_DATABASE',
  'DB_HOST',
  'DB_PORT',
  'DB_INSTANCE_UNIX_SOCKET',
  'INSTANCE_CONNECTION_NAME',
  'DEFAULT_CLIENT_URL',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'APPLE_CLIENT_ID',
  'APPLE_TEAM_ID',
  'APPLE_KEY_ID',
  'APPLE_KEY',
  'GOOGLE_CLOUD_STORAGE_BUCKET',
  'GOOGLE_CLOUD_STORAGE_KEY',
  'FIREBASE_SERVICE_ACCOUNT_JSON',
];

async function loadSecrets() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    return;
  }

  if (!process.env.GOOGLE_CLOUD_PROJECT) {
    console.warn(
      '[secrets] GOOGLE_CLOUD_PROJECT is not set; Secret Manager is disabled. Falling back to process.env.'
    );
    return;
  }

  let SecretManagerServiceClient;
  try {
    ({ SecretManagerServiceClient } = require('@google-cloud/secret-manager'));
  } catch (error) {
    console.warn(
      '[secrets] @google-cloud/secret-manager not installed; using process.env values only.'
    );
    return;
  }

  const client = new SecretManagerServiceClient();

  for (const secretName of SECRETS_TO_LOAD) {
    if (secretEnvIsSet(secretName)) {
      if (secretName === 'APPLE_KEY') {
        process.env[secretName] = normalizeApplePrivateKey(String(process.env[secretName]).trim());
      }
      continue;
    }
    try {
      const [version] = await client.accessSecretVersion({
        name: `projects/${process.env.GOOGLE_CLOUD_PROJECT}/secrets/${secretName}/versions/latest`,
      });
      const secretData = version.payload.data;
      let value = Buffer.isBuffer(secretData)
        ? secretData.toString('utf8')
        : String(secretData);
      value = value.trim();
      if (secretName === 'APPLE_KEY') {
        value = normalizeApplePrivateKey(value);
      }
      process.env[secretName] = value;

      if (secretName === 'FIREBASE_SERVICE_ACCOUNT_JSON' || secretName === 'GOOGLE_CLOUD_STORAGE_KEY') {
        const raw = process.env[secretName];
        if (!raw || raw.toLowerCase() === 'placeholder') {
          process.env[secretName] = '';
        }
      }
    } catch (error) {
      console.warn(
        `[secrets] could not load "${secretName}" from Secret Manager:`,
        error && error.message ? error.message : error
      );
    }
  }
}

module.exports = {
  loadSecrets,
  SECRETS_TO_LOAD,
  /** Call after `dotenv.config` so dev `.env` PEMs using `\\n` work the same as Secret Manager. */
  applyAppleKeyFromProcessEnv,
};

function applyAppleKeyFromProcessEnv() {
  const keyFileRaw = process.env.APPLE_KEY_FILE && String(process.env.APPLE_KEY_FILE).trim();
  if (keyFileRaw) {
    try {
      const abs = path.isAbsolute(keyFileRaw) ? keyFileRaw : path.join(process.cwd(), keyFileRaw);
      process.env.APPLE_KEY = fs.readFileSync(abs, 'utf8');
    } catch (e) {
      console.warn(`[secrets] APPLE_KEY_FILE read failed (${keyFileRaw}):`, e.message);
    }
  }

  if (secretEnvIsSet('APPLE_KEY')) {
    process.env.APPLE_KEY = normalizeApplePrivateKey(process.env.APPLE_KEY);
  }

  if (process.env.APPLE_CLIENT_ID || secretEnvIsSet('APPLE_KEY') || (process.env.APPLE_KEY_FILE && process.env.APPLE_KEY_FILE.trim())) {
    logAppleSignInDiagnostics();
  }
}
