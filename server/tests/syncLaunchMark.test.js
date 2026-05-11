const fs = require('fs');

const { main, SOURCE, DEST_IMAGE } = require('../../scripts/sync-launch-mark');

describe('sync-launch-mark', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('resources/icon.png is the expected source', () => {
    expect(fs.existsSync(SOURCE)).toBe(true);
    expect(SOURCE).toMatch(/resources[/\\]icon\.png$/);
  });

  test('main copies icon bytes into LaunchMark.imageset', () => {
    main();
    expect(fs.existsSync(DEST_IMAGE)).toBe(true);
    expect(fs.readFileSync(DEST_IMAGE).equals(fs.readFileSync(SOURCE))).toBe(true);
  });
});
