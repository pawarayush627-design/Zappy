import React, { useState } from 'react';
import {
  Download,
  Smartphone,
  X,
  CheckCircle2,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { usePWAInstall, isAppEnvironment } from '../hooks/usePWAInstall';
import {
  ApkReleaseConfig,
  triggerDirectApkDownload,
} from '../utils/apkReleaseManager';

interface PWAInstallButtonProps {
  variant?: 'header' | 'banner' | 'card';
  className?: string;
  apkRelease?: ApkReleaseConfig | null;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'header',
  className = '',
  apkRelease = null,
}) => {
  const { isInstallable, install } = usePWAInstall();
  const [isDownloading, setIsDownloading] = useState(false);
  const [showFallbackModal, setShowFallbackModal] = useState(false);

  // Strictly hide ONLY inside the native Android/iOS APK app.
  // Always display on the website (mobile & desktop browsers).
  if (isAppEnvironment()) {
    return null;
  }

  const versionLabel = apkRelease?.version
    ? `v${apkRelease.version.replace(/^v/i, '')}`
    : '';

  const handleInstallClick = async () => {
    if (isDownloading) return;
    setIsDownloading(true);

    try {
      const started = await triggerDirectApkDownload(apkRelease, () => {
        setShowFallbackModal(true);
      });
      if (started) {
        setTimeout(() => setIsDownloading(false), 1800);
        return;
      }
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <>
      {/* Header / Navbar Variant */}
      {variant === 'header' && (
        <button
          type="button"
          onClick={handleInstallClick}
          title={
            versionLabel
              ? `Download ZappyFun APK (${versionLabel})`
              : 'Download ZappyFun APK'
          }
          className={`px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#FFB800] via-[#FF5A36] to-[#FF168B] hover:brightness-110 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-[#FF5A36]/25 transition-all cursor-pointer select-none active:scale-95 whitespace-nowrap shrink-0 ${className}`}
        >
          {isDownloading ? (
            <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5 shrink-0" />
          )}
          <span className="hidden sm:inline">
            {isDownloading ? 'Downloading APK...' : 'Install App'}
          </span>
          <span className="sm:hidden">
            {isDownloading ? 'Downloading...' : 'Install'}
          </span>
        </button>
      )}

      {/* Card Variant for My Space / Home */}
      {variant === 'card' && (
        <div
          className={`p-4 rounded-2xl bg-gradient-to-br from-[#16131F] to-[#0D0B12] border border-[#2A2338] shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 ${className}`}
        >
          <div className="flex items-center gap-3.5 text-center sm:text-left">
            <div className="w-12 h-12 rounded-xl bg-black border border-[#332B45] p-2 flex items-center justify-center shrink-0 shadow-lg shadow-[#FF5A36]/20">
              <Smartphone className="w-6 h-6 text-[#FFB800]" />
            </div>
            <div>
              <h4 className="text-sm font-black text-white font-display">
                Download ZappyFun Android APK{' '}
                {versionLabel ? `(${versionLabel})` : ''}
              </h4>
              <p className="text-xs text-[#A7A9B4] mt-0.5">
                Install the official ZappyFun APK for full-screen 4K cinema streaming.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleInstallClick}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#FFB800] via-[#FF5A36] to-[#FF168B] hover:brightness-110 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#FF5A36]/25 transition-all cursor-pointer shrink-0 active:scale-95 whitespace-nowrap"
          >
            {isDownloading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>
              {isDownloading ? 'Downloading APK...' : 'Download APK'}
            </span>
          </button>
        </div>
      )}

      {/* Fallback Modal only if Admin has not uploaded an APK binary/URL yet */}
      {showFallbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-md rounded-2xl bg-[#14161D] border border-[#292C35] p-6 shadow-2xl text-white">
            <button
              type="button"
              onClick={() => setShowFallbackModal(false)}
              className="absolute top-4 right-4 p-2 rounded-xl text-[#7A7686] hover:text-white hover:bg-[#1F1B2B] transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center mb-4">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-[#FF5A36]/15 border border-[#FF5A36]/30 p-2.5 mb-3 flex items-center justify-center">
                <Smartphone className="w-6 h-6 text-[#FFB800]" />
              </div>
              <h3 className="text-base font-black text-white font-display">
                Install ZappyFun
              </h3>
              <p className="text-xs text-[#A7A9B4] mt-1">
                {isInstallable
                  ? 'Tap below to install ZappyFun directly to your device.'
                  : 'Admin can attach the latest APK file inside Admin Studio → APK & Updates for instant 1-tap APK downloads.'}
              </p>
            </div>

            {isInstallable && (
              <button
                type="button"
                onClick={async () => {
                  const ok = await install();
                  if (ok) setShowFallbackModal(false);
                }}
                className="w-full py-3 px-4 mb-3 rounded-xl bg-gradient-to-r from-[#FFB800] via-[#FF5A36] to-[#FF168B] hover:brightness-110 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Install to Home Screen Now</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowFallbackModal(false)}
              className="w-full py-2.5 rounded-xl bg-[#232632] hover:bg-[#2C303E] text-xs font-bold text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-[#FFB800]" />
              <span>Got It</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};
