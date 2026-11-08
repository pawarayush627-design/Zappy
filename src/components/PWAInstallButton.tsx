import React, { useState } from 'react';
import { Download, Smartphone, X, CheckCircle, ExternalLink } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'header' | 'banner' | 'card';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'header',
  className = '',
}) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // If already installed and running standalone, do not clutter the UI
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      setIsInstalling(true);
      try {
        await install();
      } finally {
        setIsInstalling(false);
      }
    } else {
      setShowGuideModal(true);
    }
  };

  return (
    <>
      {variant === 'header' && (
        <button
          type="button"
          onClick={handleInstallClick}
          title="Install ZappyFun Android App"
          className={`px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#FFB800] via-[#FF5A36] to-[#FF168B] hover:brightness-110 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-[#FF5A36]/20 transition-all cursor-pointer select-none active:scale-95 ${className}`}
        >
          <Smartphone className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">Install Android App</span>
          <span className="sm:hidden">Install</span>
        </button>
      )}

      {variant === 'card' && (
        <div
          className={`p-4 rounded-2xl bg-gradient-to-br from-[#16131F] to-[#0D0B12] border border-[#2A2338] shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 ${className}`}
        >
          <div className="flex items-center gap-3.5 text-center sm:text-left">
            <div className="w-12 h-12 rounded-xl bg-black border border-[#332B45] p-2 flex items-center justify-center shrink-0">
              <img
                src="/pwa-192x192.png"
                alt="ZappyFun Logo"
                className="w-full h-full object-contain rounded-lg"
              />
            </div>
            <div>
              <h4 className="text-sm font-black text-white font-display">
                Install ZappyFun on Android
              </h4>
              <p className="text-xs text-[#A7A9B4] mt-0.5">
                Enjoy full-screen cinema streaming, instant loading, and zero address bars.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleInstallClick}
            disabled={isInstalling}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#FFB800] via-[#FF5A36] to-[#FF168B] hover:brightness-110 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#FF5A36]/25 transition-all cursor-pointer shrink-0 disabled:opacity-60"
          >
            <Download className="w-4 h-4" />
            <span>{isInstalling ? 'Installing...' : 'Get Android App'}</span>
          </button>
        </div>
      )}

      {/* Guide Modal for Browsers needing manual tap or iOS */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-sm rounded-3xl bg-[#15121D] border border-[#231E30] p-6 shadow-2xl text-white">
            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="absolute top-4 right-4 p-2 rounded-xl text-[#7A7686] hover:text-white hover:bg-[#1F1B2B] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center mb-4">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-black border border-[#231E30] p-2 mb-2 flex items-center justify-center">
                <img
                  src="/pwa-192x192.png"
                  alt="ZappyFun"
                  className="w-full h-full object-contain rounded-xl"
                />
              </div>
              <h3 className="text-base font-black text-white">
                {isIOS ? 'Install on iPhone & iPad' : 'Install on Android'}
              </h3>
              <p className="text-xs text-[#A7A9B4] mt-1">
                Install ZappyFun to your device home screen for the full app experience.
              </p>
            </div>

            <div className="space-y-3 p-3.5 rounded-2xl bg-[#0D0B12] border border-[#231E30] text-xs text-[#D1CED9]">
              {isIOS ? (
                <>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#FFB800]/20 text-[#FFB800] font-bold flex items-center justify-center shrink-0 text-[11px]">
                      1
                    </span>
                    <span>
                      Tap the <strong>Share</strong> button at the bottom of Safari.
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#FFB800]/20 text-[#FFB800] font-bold flex items-center justify-center shrink-0 text-[11px]">
                      2
                    </span>
                    <span>
                      Scroll down and tap <strong>Add to Home Screen</strong>.
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#FF5A36]/20 text-[#FF5A36] font-bold flex items-center justify-center shrink-0 text-[11px]">
                      1
                    </span>
                    <span>
                      Tap the <strong>three dots (⋮)</strong> menu in Chrome.
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#FF5A36]/20 text-[#FF5A36] font-bold flex items-center justify-center shrink-0 text-[11px]">
                      2
                    </span>
                    <span>
                      Select <strong>Install app</strong> or <strong>Add to Home screen</strong>.
                    </span>
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="mt-4 w-full py-2.5 rounded-xl bg-[#231E30] hover:bg-[#2C273C] text-xs font-bold text-white transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
};
