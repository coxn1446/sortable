const {
  getCapacitorDevServerUrl,
  isCapacitorCleartextForServerUrl,
} = require('../utils/capacitorDevServerUrl');

describe('getCapacitorDevServerUrl', () => {
  it('defaults when env var is missing', () => {
    expect(getCapacitorDevServerUrl({})).toBe('http://localhost:3000');
  });

  it('trims a custom URL', () => {
    expect(
      getCapacitorDevServerUrl({
        CAPACITOR_DEV_SERVER_URL: '  http://192.168.1.10:3000  ',
      })
    ).toBe('http://192.168.1.10:3000');
  });

  it('ignores non-string values', () => {
    expect(
      getCapacitorDevServerUrl({ CAPACITOR_DEV_SERVER_URL: 123 })
    ).toBe('http://localhost:3000');
  });

  it('falls back when env is only whitespace', () => {
    expect(
      getCapacitorDevServerUrl({ CAPACITOR_DEV_SERVER_URL: '   ' })
    ).toBe('http://localhost:3000');
  });
});

describe('isCapacitorCleartextForServerUrl', () => {
  it('is false for https URLs', () => {
    expect(isCapacitorCleartextForServerUrl('https://192.168.0.171:3000')).toBe(false);
  });

  it('is true for http URLs', () => {
    expect(isCapacitorCleartextForServerUrl('http://192.168.0.171:3000')).toBe(true);
  });

  it('is true for empty or non-https', () => {
    expect(isCapacitorCleartextForServerUrl('')).toBe(true);
    expect(isCapacitorCleartextForServerUrl(null)).toBe(true);
  });
});
