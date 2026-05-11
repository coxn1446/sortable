const fs = require('fs');
const path = require('path');

describe('scripts/init.sql session table', () => {
  const initSqlPath = path.join(__dirname, '../../scripts/init.sql');

  test('adds PRIMARY KEY on session using per-table check (supports qa after public)', () => {
    const sql = fs.readFileSync(initSqlPath, 'utf8');

    expect(sql).toContain("'session'::regclass");
    expect(sql).toContain("c.contype = 'p'");
    expect(sql).not.toContain("WHERE conname = 'session_pkey'");
  });

  test('migration 04_session_primary_key_fix.sql matches init.sql PK guard pattern', () => {
    const migrationPath = path.join(__dirname, '../db/archive/migrations/04_session_primary_key_fix.sql');
    const migration = fs.readFileSync(migrationPath, 'utf8');

    expect(migration).toContain("'session'::regclass");
    expect(migration).toContain("c.contype = 'p'");
  });
});
