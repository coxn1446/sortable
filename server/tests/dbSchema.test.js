const dbSchema = require('../utils/dbSchema');

describe('dbSchema', () => {
  const snapshotEnv = process.env.ENVIRONMENT;

  afterEach(() => {
    if (snapshotEnv === undefined) {
      delete process.env.ENVIRONMENT;
    } else {
      process.env.ENVIRONMENT = snapshotEnv;
    }
  });

  test('returns public when ENVIRONMENT is unset', () => {
    delete process.env.ENVIRONMENT;
    expect(dbSchema.getDbSchema()).toBe('public');
    expect(dbSchema.isQaEnvironment()).toBe(false);
  });

  test('returns qa when ENVIRONMENT is qa (case-insensitive, trimmed)', () => {
    process.env.ENVIRONMENT = ' QA ';
    expect(dbSchema.getDbSchema()).toBe('qa');
    expect(dbSchema.isQaEnvironment()).toBe(true);
  });

  test('returns public for other ENVIRONMENT values including production', () => {
    process.env.ENVIRONMENT = 'production';
    expect(dbSchema.getDbSchema()).toBe('public');
    expect(dbSchema.isQaEnvironment()).toBe(false);

    process.env.ENVIRONMENT = 'development';
    expect(dbSchema.getDbSchema()).toBe('public');
  });

  test('returns public when ENVIRONMENT is empty string', () => {
    process.env.ENVIRONMENT = '';
    expect(dbSchema.getDbSchema()).toBe('public');
  });
});
