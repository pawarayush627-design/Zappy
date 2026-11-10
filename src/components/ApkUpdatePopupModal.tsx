import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Download,
  Sparkles,
  X,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import {
  ApkReleaseConfig,
  markApkReleaseSeen,
  triggerDirectApkDownload,
} from '../utils/apkReleaseManager';

interface ApkUpdatePopupModalProps {
  isOpen: boolean;
  apkRelease: ApkReleaseConfig | null;
  onClose: () => void;
}

export const ApkUpdatePopupModal: React.FC<ApkUpdatePopupModalProps> = ({
  isOpen,
  apkRelease,
  onClose,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);

  if (!isOpen || !apkRelease || !apkRelease.releaseId) {
    return null;
  }

  const versionClean = apkRelease.version.replace(/^v/i, '');
  const improvementLines = (apkRelease.whatsImproved || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const handleDismiss = () => {
    markApkReleaseSeen(apkRelease.releaseId);
    onClose();
  };

  const handleDownloadUpdate = async () => {
    markApkReleaseSeen(apkRelease.releaseId);
    setIsDownloading(true);
    try {
      await triggerDirectApkDownload(apkRelease);
      setTimeout(() => {
        setIsDownloading(false);
        onClose();
      }, 900);
    } catch {
      setIsDownloading(false);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-md rounded-2xl bg-[#14161D] border border-[#292C35] p-6 shadow-2xl text-white overflow-hidden"
        >
          <button
            type="button"
            onClick={handleDismiss}
            className="absolute top-4 right-4 min-h-[36px] min-w-[36px] rounded-xl text-[#A7A9B4] hover:text-white hover:bg-[#232632] flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close update notification"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Header & Version */}
          <div className="flex items-center gap-3.5 mb-5">
            <div className="w-12 h-12 rounded-2xl bg-[#08090D] border border-[#292C35] p-2 flex items-center justify-center shrink-0">
              <img
                src="/assets/aistudio/20261023_170257_6e6b6602.png"
                alt="ZappyFun"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <p className="text-xs font-bold text-[#FFB800] tracking-wide">
                New App Update · Version {versionClean}
              </p>
              <h3 className="text-lg font-black text-white font-display tracking-tight">
                ZappyFun v{versionClean} is Here
              </h3>
            </div>
          </div>

          {/* What's Improved Section */}
          <div className="rounded-xl bg-[#08090D] border border-[#232632] p-4 mb-5">
            <div className="flex items-center gap-2 text-xs font-bold text-white mb-2.5">
              <Sparkles className="w-3.5 h-3.5 text-[#FFB800]" />
              <span>What&apos;s Improved in v{versionClean}</span>
            </div>

            {improvementLines.length > 0 ? (
              <ul className="space-y-2 text-xs sm:text-sm text-[#D4D6DF] leading-relaxed max-h-52 overflow-y-auto pr-1">
                {improvementLines.map((line, idx) => {
                  const cleaned = line.replace(/^[•\-*]\s*/, '');
                  return (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#FFB800] shrink-0 mt-0.5" />
                      <span>{cleaned}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-xs sm:text-sm text-[#D4D6DF] leading-relaxed">
                Performance improvements, faster 4K playback, and latest catalog updates.
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center gap-2.5">
            <button
              type="button"
              onClick={handleDownloadUpdate}
              disabled={isDownloading}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#FFB800] via-[#FF5A36] to-[#FF168B] hover:brightness-110 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#FF5A36]/25 transition-all cursor-pointer active:scale-98"
            >
              {isDownloading ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              ) : (
                <Download className="w-4 h-4 shrink-0" />
              )}
              <span>
                {isDownloading
                  ? 'Downloading Update...'
                  : `Download APK (v${versionClean})`}
              </span>
            </button>

            <button
              type="button"
              onClick={handleDismiss}
              className="w-full sm:w-auto min-w-[110px] py-3 px-4 rounded-xl bg-[#232632] hover:bg-[#2C303E] text-xs sm:text-sm font-bold text-white transition-colors cursor-pointer"
            >
              Got It
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
