const {
  normalizeCapAppEnv,
  getCapacitorFlavorConfig,
  getDevServerUrl,
  DEFAULT_PROD_URL,
  DEFAULT_QA_URL,
} = require('../utils/capacitorFlavor');

describe('normalizeCapAppEnv', () => {
  it('maps prod aliases', () => {
    expect(normalizeCapAppEnv('prod')).toBe('prod');
    expect(normalizeCapAppEnv('production')).toBe('prod');
    expect(normalizeCapAppEnv(' PRODUCTION ')).toBe('prod');
  });

  it('maps qa', () => {
    expect(normalizeCapAppEnv('qa')).toBe('qa');
  });

  it('defaults to dev', () => {
    expect(normalizeCapAppEnv(undefined)).toBe('dev');
    expect(normalizeCapAppEnv('')).toBe('dev');
    expect(normalizeCapAppEnv('dev')).toBe('dev');
  });
});

describe('getDevServerUrl', () => {
  it('prefers CAP_DEV_URL over CAP_SERVER_URL_DEV and CAPACITOR_DEV_SERVER_URL', () => {
    expect(
      getDevServerUrl({
        CAP_DEV_URL: 'https://a:3000',
        CAP_SERVER_URL_DEV: 'https://b:3000',
        CAPACITOR_DEV_SERVER_URL: 'https://c:3000',
      })
    ).toBe('https://a:3000');
  });

  it('falls back through CAP_SERVER_URL_DEV then CAPACITOR_DEV_SERVER_URL', () => {
    expect(
      getDevServerUrl({
        CAP_SERVER_URL_DEV: 'https://b:3000',
        CAPACITOR_DEV_SERVER_URL: 'https://c:3000',
      })
    ).toBe('https://b:3000');
  });

  it('defaults to localhost http', () => {
    expect(getDevServerUrl({})).toBe('http://localhost:3000');
  });
});

describe('getCapacitorFlavorConfig', () => {
  it('prod uses CAP_PROD_URL when set', () => {
    const c = getCapacitorFlavorConfig({
      CAP_APP_ENV: 'prod',
      CAP_PROD_URL: 'https://custom.example/',
    });
    expect(c.flavor).toBe('prod');
    expect(c.appId).toBe('net.sortable.prod');
    expect(c.appName).toBe('Sortable Prod');
    expect(c.serverUrl).toBe('https://custom.example/');
    expect(c.cleartext).toBe(false);
    expect(c.allowNavigationHosts).toEqual(
      expect.arrayContaining([
        'sortable.net',
        'qa.sortable.net',
        'www.sortable.net',
        'accounts.google.com',
        'appleid.apple.com',
      ])
    );
  });

  it('prod falls back to sortable.net', () => {
    const c = getCapacitorFlavorConfig({ CAP_APP_ENV: 'prod' });
    expect(c.appName).toBe('Sortable Prod');
    expect(c.serverUrl).toBe(DEFAULT_PROD_URL);
  });

  it('qa uses CAP_QA_URL when set', () => {
    const c = getCapacitorFlavorConfig({
      CAP_APP_ENV: 'qa',
      CAP_QA_URL: 'https://custom-qa.example/',
    });
    expect(c.flavor).toBe('qa');
    expect(c.appId).toBe('net.sortable.qa');
    expect(c.appName).toBe('Sortable QA');
    expect(c.serverUrl).toBe('https://custom-qa.example/');
  });

  it('qa falls back to qa.sortable.net', () => {
    const c = getCapacitorFlavorConfig({ CAP_APP_ENV: 'qa' });
    expect(c.appName).toBe('Sortable QA');
    expect(c.serverUrl).toBe(DEFAULT_QA_URL);
  });

  it('dev uses live reload URL and cleartext for http', () => {
    const c = getCapacitorFlavorConfig({
      CAP_APP_ENV: 'dev',
      CAPACITOR_DEV_SERVER_URL: 'http://192.168.1.5:3000',
    });
    expect(c.appId).toBe('net.sortable.dev');
    expect(c.appName).toBe('Sortable Dev');
    expect(c.serverUrl).toBe('http://192.168.1.5:3000');
    expect(c.cleartext).toBe(true);
  });

  it('dev uses https LAN with cleartext false', () => {
    const c = getCapacitorFlavorConfig({
      CAP_APP_ENV: 'dev',
      CAP_DEV_URL: 'https://192.168.0.171:3000',
    });
    expect(c.cleartext).toBe(false);
  });

  it('dev allowNavigation includes tunnel hostname from CAP_DEV_URL and CAP_ALLOW_NAVIGATION_HOSTS', () => {
    const c = getCapacitorFlavorConfig({
      CAP_APP_ENV: 'dev',
      CAP_DEV_URL: 'https://abc.ngrok-free.app',
      CAP_ALLOW_NAVIGATION_HOSTS: ' extra.example ,accounts.google.com ',
    });
    expect(c.allowNavigationHosts).toEqual(
      expect.arrayContaining([
        'sortable.net',
        'abc.ngrok-free.app',
        'extra.example',
        'accounts.google.com',
      ])
    );
  });

  it('honors CAP_SERVER_URL_* aliases', () => {
    const prod = getCapacitorFlavorConfig({
      CAP_APP_ENV: 'prod',
      CAP_SERVER_URL_PROD: 'https://p.example',
    });
    expect(prod.serverUrl).toBe('https://p.example');
    const qa = getCapacitorFlavorConfig({
      CAP_APP_ENV: 'qa',
      CAP_SERVER_URL_QA: 'https://q.example',
    });
    expect(qa.serverUrl).toBe('https://q.example');
  });
});
