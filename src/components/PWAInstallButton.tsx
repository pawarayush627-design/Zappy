import React, { useState } from 'react';
import {
  Download,
  Smartphone,
  X,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Share2,
  Sparkles,
  AlertTriangle,
  Info,
} from 'lucide-react';
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
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [apkStatus, setApkStatus] = useState<'idle' | 'checking' | 'downloading' | 'not_ready'>('idle');

  // If already installed and running standalone, do not clutter the UI
  if (isInstalled) {
    return null;
  }

  const handleButtonClick = async () => {
    // If the browser natively supports 1-tap installation, trigger it directly!
    if (isInstallable) {
      const outcome = await install();
      if (outcome) return;
    }
    // Otherwise open the guided installation modal
    setShowInstallModal(true);
  };

  const handleDownloadApk = async () => {
    setApkStatus('checking');
    try {
      const res = await fetch('/zappyfun.apk', { method: 'HEAD' });
      if (res.ok && res.headers.get('content-type')?.includes('vnd.android.package-archive')) {
        setApkStatus('downloading');
        const link = document.createElement('a');
        link.href = '/zappyfun.apk';
        link.download = 'zappyfun.apk';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => setApkStatus('idle'), 4000);
      } else {
        // No compiled binary found on server
        setApkStatus('not_ready');
      }
    } catch {
      setApkStatus('not_ready');
    }
  };

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.origin).then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2500);
      });
    }
  };

  return (
    <>
      {/* Header / Navbar Variant */}
      {variant === 'header' && (
        <button
          type="button"
          onClick={handleButtonClick}
          title="Install ZappyFun Android App"
          className={`px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#FFB800] via-[#FF5A36] to-[#FF168B] hover:brightness-110 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-[#FF5A36]/25 transition-all cursor-pointer select-none active:scale-95 ${className}`}
        >
          <Smartphone className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">Install App</span>
          <span className="sm:hidden">Install</span>
        </button>
      )}

      {/* Card Variant for Home / Catalog */}
      {variant === 'card' && (
        <div
          className={`p-4 rounded-2xl bg-gradient-to-br from-[#16131F] to-[#0D0B12] border border-[#2A2338] shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 ${className}`}
        >
          <div className="flex items-center gap-3.5 text-center sm:text-left">
            <div className="w-12 h-12 rounded-xl bg-black border border-[#332B45] p-2 flex items-center justify-center shrink-0 shadow-lg shadow-[#FF5A36]/20">
              <Smartphone className="w-6 h-6 text-[#FFB800]" />
            </div>
            <div>
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <h4 className="text-sm font-black text-white font-display">
                  Install ZappyFun on Your Device
                </h4>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide bg-[#FFB800]/20 text-[#FFB800] border border-[#FFB800]/30">
                  Android & Web
                </span>
              </div>
              <p className="text-xs text-[#A7A9B4] mt-0.5">
                Enjoy full-screen 4K cinema streaming, instant loading, and zero address bars.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleButtonClick}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#FFB800] via-[#FF5A36] to-[#FF168B] hover:brightness-110 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#FF5A36]/25 transition-all cursor-pointer shrink-0 active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>Install App</span>
          </button>
        </div>
      )}

      {/* Guided Installation Modal */}
      {showInstallModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-md rounded-3xl bg-[#14161D] border border-[#292C35] p-6 shadow-2xl text-white max-h-[92vh] overflow-y-auto no-scrollbar">
            <button
              type="button"
              onClick={() => {
                setShowInstallModal(false);
                setApkStatus('idle');
              }}
              className="absolute top-4 right-4 p-2 rounded-xl text-[#7A7686] hover:text-white hover:bg-[#1F1B2B] transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Modal Header */}
            <div className="text-center mb-5">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-[#FF5A36]/20 via-[#FFB800]/20 to-[#FF168B]/20 border border-[#FF5A36]/30 p-3 mb-3 flex items-center justify-center shadow-lg shadow-[#FF5A36]/20">
                <Smartphone className="w-8 h-8 text-[#FFB800]" />
              </div>
              <h3 className="text-lg font-black text-white font-display">
                Install ZappyFun App
              </h3>
              <p className="text-xs text-[#A7A9B4] mt-1">
                Zero Parse Errors · Official Android & Mobile Setup
              </p>
            </div>

            {/* Recommended Action 1: Instant Native Install */}
            {isInstallable ? (
              <div className="mb-4">
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await install();
                    if (ok) setShowInstallModal(false);
                  }}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#FFB800] via-[#FF5A36] to-[#FF168B] hover:brightness-110 text-white font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-[#FF5A36]/30 transition-all cursor-pointer active:scale-98"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Tap to Install Instantly</span>
                </button>
                <p className="text-[11px] text-[#A7A9B4] text-center mt-1.5">
                  Direct Android installation with home screen shortcut & full offline support.
                </p>
              </div>
            ) : null}

            {/* Official Android Browser 2-Step Guide */}
            <div className="space-y-3 p-4 rounded-2xl bg-[#0D0F15] border border-[#232632] text-xs text-[#D1CED9] mb-4">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#FFB800] uppercase tracking-wider mb-0.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>How to Install on Android</span>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#FFB800]/20 text-[#FFB800] font-black flex items-center justify-center shrink-0 text-[11px]">
                  1
                </span>
                <span>
                  Tap the <strong>three dots menu (⋮)</strong> at the top right of Google Chrome.
                </span>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#FF5A36]/20 text-[#FF5A36] font-black flex items-center justify-center shrink-0 text-[11px]">
                  2
                </span>
                <span>
                  Select <strong>Install app</strong> or <strong>Add to Home screen</strong>.
                </span>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#FF168B]/20 text-[#FF168B] font-black flex items-center justify-center shrink-0 text-[11px]">
                  3
                </span>
                <span>
                  Tap <strong>Install</strong>. ZappyFun will install onto your phone with its own
                  app icon and full-screen cinema player!
                </span>
              </div>
            </div>

            {/* APK Status Notice & Info */}
            <div className="p-3.5 rounded-2xl bg-[#171922] border border-[#282C38] mb-4 text-xs text-[#A7A9B4]">
              <div className="flex items-center gap-2 text-white font-bold mb-1">
                <Info className="w-4 h-4 text-[#FFB800]" />
                <span>About the "Problem Parsing the Package" Error</span>
              </div>
              <p className="text-[11px] leading-relaxed text-[#8E92A2]">
                Android displays <em>"There was a problem parsing the package"</em> when a downloaded
                file is not a compiled native Android binary. Using the{' '}
                <strong className="text-white">"Install app"</strong> menu option above bypasses
                this error completely and installs the official app in 1 tap!
              </p>
            </div>

            {/* Action Footer */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleCopyLink}
                className="w-full py-2.5 px-3 rounded-xl bg-[#1A1D26] hover:bg-[#252834] border border-[#2E3240] text-xs font-semibold text-[#D1CED9] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedLink ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Website Link Copied!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Copy App Link to Phone</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowInstallModal(false);
                  setApkStatus('idle');
                }}
                className="w-full py-2.5 rounded-xl bg-[#232632] hover:bg-[#2C303E] text-xs font-bold text-white transition-colors cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
