import React, { createContext, useContext, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { useDispatch } from 'react-redux';
import { setNativeInfo, setKeyboardVisible } from '../store/native.reducer';

const NativeContext = createContext(null);

export const useNative = () => {
  const ctx = useContext(NativeContext);
  if (!ctx) {
    throw new Error('useNative must be used within NativeProvider');
  }
  return ctx;
};

export const NativeProvider = ({ children }) => {
  const dispatch = useDispatch();
  const [isNative] = useState(() => Capacitor.isNativePlatform());
  const [platform] = useState(() => Capacitor.getPlatform());
  const [deviceInfo, setDeviceInfo] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let keyboardListeners = [];

    async function init() {
      if (!isNative) {
        dispatch(setNativeInfo({ isNative: false, platform: 'web', deviceInfo: null }));
        return;
      }
      try {
        const { Device } = await import('@capacitor/device');
        const info = await Device.getInfo();
        if (cancelled) return;
        setDeviceInfo(info);
        dispatch(setNativeInfo({ isNative: true, platform: info.platform, deviceInfo: info }));

        const { Keyboard, KeyboardResize } = await import('@capacitor/keyboard');
        if (info.platform === 'ios') {
          try {
            await Keyboard.setResizeMode({ mode: KeyboardResize.None });
            await Keyboard.getResizeMode();
          } catch {
            /* plugin or platform mismatch */
          }
          try {
            await Keyboard.setScroll({ isDisabled: true });
          } catch {
            /* plugin or platform mismatch */
          }
        }

        keyboardListeners = await Promise.all([
          Keyboard.addListener('keyboardWillShow', () => {
            dispatch(setKeyboardVisible(true));
          }),
          Keyboard.addListener('keyboardWillHide', () => {
            dispatch(setKeyboardVisible(false));
          }),
        ]);

        // Match the dark theme: light text on a dark status bar.
        try {
          const { StatusBar, Style } = await import('@capacitor/status-bar');
          await StatusBar.setStyle({ style: Style.Dark });
          await StatusBar.setBackgroundColor({ color: '#0F172A' });
        } catch {
          // status bar plugin may be unavailable on some platforms; not fatal
        }

        // Dismiss the native splash once we're ready.
        try {
          const { SplashScreen } = await import('@capacitor/splash-screen');
          await SplashScreen.hide();
        } catch {
          // splash screen plugin may be unavailable; not fatal
        }
      } catch (error) {
        console.error('[NativeContext] Failed to initialize native features:', error);
      }
    }

    init();

    return () => {
      cancelled = true;
      keyboardListeners.forEach((l) => l && l.remove && l.remove());
    };
  }, [isNative, dispatch]);

  return (
    <NativeContext.Provider value={{ isNative, platform, deviceInfo }}>
      {children}
    </NativeContext.Provider>
  );
};
