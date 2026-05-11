import React from 'react';
import ReactDOM from 'react-dom/client';
import { createPortal } from 'react-dom';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { setupIonicReact } from '@ionic/react';
import { Toaster } from 'react-hot-toast';

import { store } from './store/rootReducer';
import App from './components/App';
import { ensureToastPortalHost } from './utils/ensureToastPortalHost';

import './index.css';

const routerFutureFlags = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
};

if (typeof document !== 'undefined' && Capacitor.isNativePlatform()) {
  document.documentElement.classList.add('capacitor-native');
  document.getElementById('initial-loader')?.remove();
}

setupIonicReact(
  Capacitor.isNativePlatform()
    ? {
        scrollAssist: false,
        scrollPadding: false,
      }
    : undefined,
);

function ToasterPortal() {
  const host = ensureToastPortalHost();
  if (!host) {
    return null;
  }
  return createPortal(<Toaster position="top-center" />, host);
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter future={routerFutureFlags}>
        <App />
        <ToasterPortal />
      </BrowserRouter>
    </Provider>
  </React.StrictMode>,
);
