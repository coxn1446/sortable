/**
 * Database schema resolution - derived from environment, not a secret.
 * sortable.net    (ENVIRONMENT=production or unset) -> public schema
 * qa.sortable.net (ENVIRONMENT=qa, case-insensitive) -> qa schema
 * Local dev defaults to the public schema unless ENVIRONMENT selects qa.
 *
 * Only `ENVIRONMENT` selects the qa schema; NODE_ENV is never used for this
 * (NODE_ENV is typically development|production|test, never qa).
 */
function getDbSchema() {
  const raw = process.env.ENVIRONMENT;
  if (raw === undefined || raw === null) {
    return 'public';
  }
  return String(raw).trim().toLowerCase() === 'qa' ? 'qa' : 'public';
}

function isQaEnvironment() {
  return getDbSchema() === 'qa';
}

module.exports = { getDbSchema, isQaEnvironment };
