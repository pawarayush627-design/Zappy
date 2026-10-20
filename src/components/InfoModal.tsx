import React from 'react';
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
  if (!modalType) return null;

  const contentMap: Record<
    Exclude<InfoModalType, null>,
    { title: string; subtitle: string; paragraphs: string[] }
  > = {
    about: {
      title: 'About CineWave',
      subtitle: 'Free, ad-supported cinema and television discovery.',
      paragraphs: [
        'CineWave is a modern, full-stack movie and TV streaming web application designed for Android mobile devices, tablets, laptops, and desktop browsers.',
        'Our catalog architecture strictly separates movie metadata from playable video stream records. Only verified open-licensed films (such as Blender Foundation Creative Commons open movies and public demo streams) are marked as playable in this environment, while additional catalog entries clearly display their metadata preview status without fabricating unauthorized streams.',
      ],
    },
    contact: {
      title: 'Contact & Technical Support',
      subtitle: 'Get in touch with the CineWave editorial and engineering team.',
      paragraphs: [
        'For catalog licensing inquiries, open-movie submissions, or playback diagnostics across Android and desktop browsers, reach our team via our support desk.',
        'Editorial & Licensing Desk: licensing@cinewave.example.com · Technical Operations: support@cinewave.example.com',
      ],
    },
    privacy: {
      title: 'Privacy Policy',
      subtitle: 'How CineWave handles local preferences and watchlist storage.',
      paragraphs: [
        'CineWave stores your "My List" watchlist and ad-placeholder visibility preferences locally in your browser using HTML5 localStorage under the key "cinewave_watchlist_v1".',
        'No personal viewing history or account credentials are transmitted to third-party trackers. When an external movie metadata API is configured on the server, requests are proxied server-side so browser clients never expose API secrets.',
      ],
    },
    terms: {
      title: 'Terms of Use & Content Licensing',
      subtitle: 'Transparent rules on authorized playback and catalog metadata.',
      paragraphs: [
        'Playable demo streams featured on CineWave are distributed under Creative Commons Attribution licenses (CC-BY 2.5 / CC-BY 3.0) from the Blender Foundation or authorized public sample repositories.',
        'Titles marked "Catalog Preview Only" are provided strictly for search, filtering, and watchlist testing; CineWave never claims unauthorized copyrighted movies are available for streaming.',
      ],
    },
    advertising: {
      title: 'Free, Ad-Supported Streaming Architecture',
      subtitle: 'Transparent ad placeholder slots with zero fake claims or video interruptions.',
      paragraphs: [
        'CineWave is architected for a free, ad-supported streaming model (FAST / AVOD). In this environment, designated banner slots are clearly labeled as architectural placeholders.',
        'We do not display fabricated commercial advertisements, misleading buttons, or unverified advertiser claims, and we never interrupt demo video playback with fake ad breaks. No ad revenue is active until a legitimate ad provider approves and configures the site.',
      ],
    },
  };

  const activeContent = contentMap[modalType];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="w-full max-w-lg rounded-2xl bg-[#131318] border border-zinc-800 p-6 space-y-4 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="modal-title"
              className="text-xl font-bold text-white font-display"
            >
              {activeContent.title}
            </h2>
            <p className="text-xs text-[#FF6B00] mt-0.5">
              {activeContent.subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer"
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
          <div className="pt-3 border-t border-zinc-800 flex items-center justify-between gap-4">
            <span className="text-xs text-zinc-300">
              Ad Slot Placeholders Visibility:
            </span>
            <button
              type="button"
              onClick={onToggleAds}
              className={`min-h-[38px] px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                adsEnabled
                  ? 'bg-[#FF6B00] text-black'
                  : 'bg-zinc-800 text-zinc-300 hover:text-white'
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
            className="min-h-[40px] px-5 py-2 rounded-xl bg-zinc-800 text-xs font-semibold text-white hover:bg-zinc-700 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
