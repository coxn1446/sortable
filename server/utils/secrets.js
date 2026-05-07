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
    if (process.env[secretName]) {
      continue;
    }
    try {
      const [version] = await client.accessSecretVersion({
        name: `projects/${process.env.GOOGLE_CLOUD_PROJECT}/secrets/${secretName}/versions/latest`,
      });
      const secretData = version.payload.data;
      const value = Buffer.isBuffer(secretData)
        ? secretData.toString('utf8')
        : String(secretData);
      process.env[secretName] = value.trim();

      if (secretName === 'FIREBASE_SERVICE_ACCOUNT_JSON' || secretName === 'GOOGLE_CLOUD_STORAGE_KEY') {
        const raw = process.env[secretName];
        if (!raw || raw.toLowerCase() === 'placeholder') {
          process.env[secretName] = '';
        }
      }
    } catch (error) {
      // Missing secrets are non-fatal; downstream code logs warnings when required.
    }
  }
}

module.exports = { loadSecrets, SECRETS_TO_LOAD };
