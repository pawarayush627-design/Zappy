import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

/**
 * Strictly checks if the user is running inside the native Capacitor Android/iOS APK.
 * Returns FALSE on all websites (mobile Chrome, desktop browsers, Netlify, etc.)
 * so the Install APK button is ALWAYS visible on the website and NEVER visible inside the native app.
 */
export function isAppEnvironment(): boolean {
  if (typeof window === 'undefined') return false;

  // 1. Official Capacitor Native Platform check (true only inside compiled Android/iOS APK)
  try {
    if (Capacitor.isNativePlatform()) return true;
    const platform = Capacitor.getPlatform();
    if (platform === 'android' || platform === 'ios') return true;
  } catch {}

  // 2. Global window Capacitor bridge check
  const win = window as unknown as {
    Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
    androidBridge?: unknown;
  };

  if (win.Capacitor?.isNativePlatform && win.Capacitor.isNativePlatform()) {
    return true;
  }
  if (
    win.Capacitor?.getPlatform &&
    (win.Capacitor.getPlatform() === 'android' || win.Capacitor.getPlatform() === 'ios')
  ) {
    return true;
  }
  if (typeof win.androidBridge !== 'undefined') {
    return true;
  }

  // 3. Capacitor internal protocol or Android WebView internal https://localhost (with no port)
  const ua = (window.navigator?.userAgent || '').toLowerCase();
  if (
    window.location.protocol === 'capacitor:' ||
    ua.includes('zappyfunnativeapp') ||
    (window.location.hostname === 'localhost' &&
      window.location.port === '' &&
      ua.includes('android'))
  ) {
    return true;
  }

  return false;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isNativeApp, setIsNativeApp] = useState<boolean>(() => isAppEnvironment());
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    const runningInApp = isAppEnvironment();
    setIsNativeApp(runningInApp);

    const userAgent = (window.navigator?.userAgent || '').toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));
    setIsAndroid(/android/.test(userAgent));

    const handleBeforeInstallPrompt = (e: Event) => {
      if (isAppEnvironment()) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt && !isNativeApp,
    isInstalled: isNativeApp,
    isIOS,
    isAndroid,
    install,
  };
}
