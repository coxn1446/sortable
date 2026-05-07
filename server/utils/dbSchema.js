/**
 * Database schema resolution - derived from environment, not a secret.
 * sortable.net    (ENVIRONMENT=production)  -> public schema
 * qa.sortable.net (ENVIRONMENT=qa)          -> qa schema
 * Local dev defaults to the public schema.
 */
function getDbSchema() {
  const environment = process.env.ENVIRONMENT || process.env.NODE_ENV;
  return environment === 'qa' ? 'qa' : 'public';
}

function isQaEnvironment() {
  return getDbSchema() === 'qa';
}

module.exports = { getDbSchema, isQaEnvironment };
