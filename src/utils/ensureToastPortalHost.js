/** DOM id for the node that holds `react-hot-toast` via `createPortal` (sibling of `body`, under `<html>`). */
export const TOAST_PORTAL_HOST_ID = 'sortable-toast-host';

/**
 * Ensures a portal host exists as the last child of `document.documentElement`.
 * Mounting here avoids WKWebView clipping `position: fixed` toasts under `#root`
 * when `html.capacitor-native #root { overflow: hidden }` is active.
 */
export function ensureToastPortalHost() {
  if (typeof document === 'undefined') {
    return null;
  }
  let el = document.getElementById(TOAST_PORTAL_HOST_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = TOAST_PORTAL_HOST_ID;
    document.documentElement.appendChild(el);
  }
  return el;
}
