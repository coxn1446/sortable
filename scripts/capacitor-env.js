/**
 * Capacitor iOS/Android flavor resolution for capacitor.config.ts.
 * Loads .env when present so `npx cap sync` picks up URLs and CAP_APP_ENV.
 */
require('dotenv').config({ quiet: true });

module.exports = require('../server/utils/capacitorFlavor.js');
