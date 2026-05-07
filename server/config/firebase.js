const admin = require('firebase-admin');

let firebaseInitialized = false;

function initializeFirebase() {
  if (firebaseInitialized) {
    return admin;
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    return null;
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(serviceAccountJson);
  } catch (error) {
    console.warn('[firebase] FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON; skipping init.');
    return null;
  }

  if (!serviceAccount.project_id || !serviceAccount.private_key || !serviceAccount.client_email) {
    console.warn('[firebase] Service account is missing required fields; skipping init.');
    return null;
  }

  try {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    firebaseInitialized = true;
    console.log('[firebase] Firebase Admin initialized.');
    return admin;
  } catch (error) {
    console.error('[firebase] Failed to initialize Firebase Admin:', error.message);
    return null;
  }
}

function getFirebaseAdmin() {
  if (!firebaseInitialized) {
    return initializeFirebase();
  }
  return admin;
}

module.exports = { initializeFirebase, getFirebaseAdmin };
