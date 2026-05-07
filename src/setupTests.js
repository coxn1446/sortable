import '@testing-library/jest-dom';

// jsdom does not implement Web Animations; RankedList uses HTMLElement.animate.
if (typeof Element !== 'undefined' && !Element.prototype.animate) {
  Element.prototype.animate = function mockAnimate() {
    return { cancel: () => {}, finished: Promise.resolve() };
  };
}

// Polyfill TextEncoder/TextDecoder for jsdom (some Node ESM builds need this).
if (typeof globalThis.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  globalThis.TextEncoder = TextEncoder;
  globalThis.TextDecoder = TextDecoder;
}

// Mock matchMedia (used by Ionic and a number of UI libs).
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

// Mock Capacitor so components that import it work in jsdom.
jest.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => false,
    getPlatform: () => 'web',
  },
}));
