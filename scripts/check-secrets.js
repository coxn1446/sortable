#!/usr/bin/env node
require('dotenv').config({ quiet: true });

const REQUIRED = ['SESSION_SECRET', 'DB_USER', 'DB_PASSWORD', 'DB_DATABASE'];
const OPTIONAL = [
  'DB_HOST',
  'DB_PORT',
  'DEFAULT_CLIENT_URL',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'APPLE_CLIENT_ID',
  'APPLE_TEAM_ID',
  'APPLE_KEY_ID',
  'APPLE_KEY',
  'GOOGLE_CLOUD_PROJECT',
  'GOOGLE_CLOUD_STORAGE_BUCKET',
  'GOOGLE_CLOUD_STORAGE_KEY',
  'FIREBASE_SERVICE_ACCOUNT_JSON',
];

function check(name, list, required) {
  const missing = list.filter((k) => !process.env[k]);
  const present = list.filter((k) => Boolean(process.env[k]));
  console.log(`\n${name}:`);
  if (present.length) console.log('  set:    ', present.join(', '));
  if (missing.length) console.log('  missing:', missing.join(', '));
  return required ? missing : [];
}

const missingRequired = check('Required', REQUIRED, true);
check('Optional', OPTIONAL, false);

if (missingRequired.length > 0) {
  console.error(`\nMissing required environment variables: ${missingRequired.join(', ')}`);
  process.exit(1);
}

console.log('\nAll required secrets are present.');
