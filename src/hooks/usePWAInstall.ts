import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

/**
 * Checks if the user is running inside the native Capacitor Android app,
 * an Android WebView, or an installed standalone PWA.
 */
export function isAppEnvironment(): boolean {
  if (typeof window === 'undefined') return false;

  // 1. Capacitor Native Platform check (returns true in native Android APK)
  try {
    if (Capacitor.isNativePlatform()) return true;
    const platform = Capacitor.getPlatform();
    if (platform === 'android' || platform === 'ios') return true;
  } catch {}

  // 2. Global window Capacitor instance check
  const win = window as unknown as {
    Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
    navigator?: { standalone?: boolean };
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

  // 3. Capacitor internal scheme or localhost origin (Capacitor Android WebViews)
  if (
    window.location.protocol === 'capacitor:' ||
    window.location.hostname === 'localhost' ||
    window.location.origin.includes('localhost')
  ) {
    return true;
  }

  // 4. Android WebView Detection via User Agent
  const ua = (window.navigator?.userAgent || '').toLowerCase();
  if (
    ua.includes('capacitor') ||
    ua.includes('; wv') ||
    (ua.includes('android') && ua.includes('version/4.0') && ua.includes('chrome'))
  ) {
    return true;
  }

  // 5. PWA Standalone display mode check
  if (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    win.navigator?.standalone === true
  ) {
    return true;
  }

  return false;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => isAppEnvironment());
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    // Detect environment on mount
    const runningInApp = isAppEnvironment();
    setIsInstalled(runningInApp);

    const userAgent = (window.navigator?.userAgent || '').toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));
    setIsAndroid(/android/.test(userAgent));

    const handleBeforeInstallPrompt = (e: Event) => {
      // If already in the native app, suppress the prompt
      if (isAppEnvironment()) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt && !isInstalled,
    isInstalled,
    isIOS,
    isAndroid,
    install,
  };
}
