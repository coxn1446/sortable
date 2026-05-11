/**
 * @jest-environment jsdom
 */

import {
  TOAST_PORTAL_HOST_ID,
  ensureToastPortalHost,
} from '../utils/ensureToastPortalHost';

describe('ensureToastPortalHost', () => {
  beforeEach(() => {
    document.getElementById(TOAST_PORTAL_HOST_ID)?.remove();
  });

  test('creates a host under documentElement and reuses it', () => {
    expect(document.getElementById(TOAST_PORTAL_HOST_ID)).toBeNull();

    const first = ensureToastPortalHost();
    expect(first).toBeTruthy();
    expect(first.id).toBe(TOAST_PORTAL_HOST_ID);
    expect(first.parentElement).toBe(document.documentElement);

    const second = ensureToastPortalHost();
    expect(second).toBe(first);
    expect(document.documentElement.querySelectorAll(`#${TOAST_PORTAL_HOST_ID}`)).toHaveLength(1);
  });

  test('appends after body so the host is not inside #root overflow chain', () => {
    const host = ensureToastPortalHost();
    const children = Array.from(document.documentElement.children);
    const bodyIndex = children.indexOf(document.body);
    const hostIndex = children.indexOf(host);
    expect(bodyIndex).toBeGreaterThanOrEqual(0);
    expect(hostIndex).toBeGreaterThan(bodyIndex);
  });
});
