import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

export type InfoModalType =
  | 'about'
  | 'contact'
  | 'privacy'
  | 'terms'
  | 'advertising'
  | null;

interface InfoModalProps {
  modalType: InfoModalType;
  adsEnabled: boolean;
  onToggleAds: () => void;
  onClose: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({
  modalType,
  adsEnabled,
  onToggleAds,
  onClose,
}) => {
  const contentMap: Record<
    Exclude<InfoModalType, null>,
    { title: string; subtitle: string; paragraphs: string[] }
  > = {
    about: {
      title: 'About ZAPPY',
      subtitle: 'Firebase-powered streaming platform with CineSrc.st & JustWatch integration.',
      paragraphs: [
        'ZAPPY is a full-stack movie and TV streaming web application powered by Firebase Authentication (Google Sign-In) and Cloud Firestore.',
        'Admins can publish movies and TV shows directly from the Admin Panel using CineSrc.st embed links and JustWatch URLs to automatically extract posters, banners, and widescreen backdrops.',
      ],
    },
    contact: {
      title: 'Contact & Admin Access',
      subtitle: 'Get in touch with ZAPPY administration.',
      paragraphs: [
        'Sign in with Google using the authorized administrator account (pawarayushai1@gmail.com) to unlock the ZAPPY Admin Panel and publish new movies or series.',
        'Admin Contact: pawarayushai1@gmail.com',
      ],
    },
    privacy: {
      title: 'Privacy & Firebase Security',
      subtitle: 'How ZAPPY protects user accounts and Cloud Firestore data.',
      paragraphs: [
        'ZAPPY uses Firebase Authentication with Google Sign-In and enforces strict Cloud Firestore Security Rules so only verified administrators can create, update, or remove catalog entries.',
        'Signed-in users have private Cloud Firestore watchlists scoped strictly to their authenticated UID.',
      ],
    },
    terms: {
      title: 'Terms of Use',
      subtitle: 'Streaming embeds and metadata artwork.',
      paragraphs: [
        'Titles added via the ZAPPY Admin Studio use CineSrc.st embed links (https://cinesrc.st/embed/movie/:tmdbId or /tv/:tmdbId) and artwork fetched via JustWatch metadata.',
        'All demo placeholder movies and shows have been removed so your catalog contains exclusively the titles published by the administrator.',
      ],
    },
    advertising: {
      title: 'Display Banner Placeholders',
      subtitle: 'Configurable display banner slots.',
      paragraphs: [
        'ZAPPY includes optional display banner slots that can be toggled on or off at any time.',
        'You can enable or disable page banner slots below.',
      ],
    },
  };

  const activeContent = modalType ? contentMap[modalType] : null;

  return (
    <AnimatePresence>
      {modalType && activeContent && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl bg-[#161220] border border-white/15 p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="modal-title"
                  className="text-xl font-bold text-white font-display"
                >
                  {activeContent.title}
                </h2>
                <p className="text-xs text-[#B892FF] mt-0.5">
                  {activeContent.subtitle}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="min-h-[40px] min-w-[40px] rounded-lg bg-[#1E192B] border border-white/10 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-sm text-zinc-300 leading-relaxed">
              {activeContent.paragraphs.map((p, idx) => (
                <p key={idx}>{p}</p>
              ))}
            </div>

            {modalType === 'advertising' && (
              <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-4">
                <span className="text-xs text-zinc-300">
                  Page Display Banner Placeholders:
                </span>
                <button
                  type="button"
                  onClick={onToggleAds}
                  className={`min-h-[38px] px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    adsEnabled
                      ? 'bg-[#B892FF] text-[#110E17] font-bold'
                      : 'bg-[#1E192B] text-zinc-300 hover:text-white'
                  }`}
                >
                  {adsEnabled ? 'Enabled (Showing Slots)' : 'Disabled (Hidden)'}
                </button>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[40px] px-5 py-2 rounded-xl bg-[#1E192B] text-xs font-semibold text-white hover:bg-[#282238] transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
