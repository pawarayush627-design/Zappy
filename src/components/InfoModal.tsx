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
      title: 'About Zappy',
      subtitle: 'Next-generation 4K UHD streaming platform.',
      paragraphs: [
        'Zappy is a full-stack movie and TV series streaming platform powered by Firebase Authentication and Cloud Firestore.',
        'Enjoy instant high-speed playback and authentic JustWatch metadata, cast & director profiles, and synchronized watchlists.',
      ],
    },
    contact: {
      title: 'Help & Support',
      subtitle: 'Get in touch with administration.',
      paragraphs: [
        'Use our Support page to send a direct message to the Zappy administration team. All submitted messages appear directly in the Admin Studio inbox.',
        'Support Contact: pawarayushai1@gmail.com',
      ],
    },
    privacy: {
      title: 'Privacy Policy',
      subtitle: 'How we protect user accounts and Cloud Firestore data.',
      paragraphs: [
        'We use Firebase Authentication with Google Sign-In and enforce strict Cloud Firestore Security Rules so only verified administrators can create, update, or remove catalog entries.',
        'Signed-in users have private Cloud Firestore watchlists scoped strictly to their authenticated account.',
      ],
    },
    terms: {
      title: 'Terms of Use',
      subtitle: 'Streaming and catalog guidelines.',
      paragraphs: [
        'Titles published via the Admin Studio include high-definition widescreen posters, backdrops, cast portraits, and instant playback.',
        'Your personal watchlist and playback progress are synced automatically across sessions, and completed titles are automatically cleared from your watchlist.',
      ],
    },
    advertising: {
      title: 'Display & Playback Preferences',
      subtitle: 'Configurable display banner slots.',
      paragraphs: [
        'Optional companion display slots can be toggled on or off at any time.',
        'You can enable or disable companion display slots below.',
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
            className="w-full max-w-lg rounded-2xl bg-[#16181F] border border-white/15 p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="modal-title"
                  className="text-xl font-bold text-white font-display"
                >
                  {activeContent.title}
                </h2>
                <p className="text-xs text-[#E50000] mt-0.5">
                  {activeContent.subtitle}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="min-h-[40px] min-w-[40px] rounded-lg bg-[#0F1014] border border-white/10 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer"
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
                  Companion Display Banner Slots:
                </span>
                <button
                  type="button"
                  onClick={onToggleAds}
                  className={`min-h-[38px] px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    adsEnabled
                      ? 'bg-[#E50000] text-white font-bold'
                      : 'bg-[#0F1014] text-zinc-300 hover:text-white border border-white/10'
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
                className="min-h-[40px] px-5 py-2 rounded-xl bg-[#0F1014] border border-white/10 text-xs font-semibold text-white hover:bg-white/10 transition-colors cursor-pointer"
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
