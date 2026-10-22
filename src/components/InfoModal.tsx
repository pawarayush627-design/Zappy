import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Mail, Copy, Check, ShieldCheck, FileText, Link2 } from 'lucide-react';

export type InfoModalType =
  | 'about'
  | 'contact'
  | 'privacy'
  | 'terms'
  | 'advertising'
  | 'disclaimer'
  | null;

export interface LegalPageContent {
  title: string;
  subtitle: string;
  body: string;
}

export interface LegalPagesConfig {
  terms: LegalPageContent;
  privacy: LegalPageContent;
  advertising: LegalPageContent;
  disclaimer: LegalPageContent;
  about: LegalPageContent;
  contactEmail: string;
  updatedAtMs?: number;
}

export const OFFICIAL_CONTACT_EMAIL = 'ContactZappyFun@gmail.com';

const LEGACY_BOILERPLATE_SNIPPETS: Record<
  'terms' | 'privacy' | 'advertising' | 'disclaimer' | 'about',
  string
> = {
  terms:
    'Your personal watchlist and playback progress are synced automatically across sessions',
  privacy:
    'Signed-in users have private Cloud Firestore watchlists scoped strictly to their authenticated account. We do not sell your personal data to third parties.',
  advertising:
    'ZappyFun uses essential browser local storage to remember your playback progress, audio/video track selection, and display preferences across sessions.',
  disclaimer:
    'ZappyFun indexes publicly available metadata and embeds third-party streaming players. ZappyFun does not host media files on its own servers.',
  about:
    'ZappyFun is a modern movie and TV series streaming platform powered by Firebase Authentication and Cloud Firestore.',
};

export const DEFAULT_LEGAL_PAGES: LegalPagesConfig = {
  contactEmail: OFFICIAL_CONTACT_EMAIL,
  terms: {
    title: 'Terms of Use',
    subtitle: 'Effective Date: October 2026 · Platform usage terms and disclosures.',
    body: `Effective Date: October 2026\nOperator Details: [Owner Input Required: Legal Entity / Operator Name and Registered Address]\n\nWelcome to ZappyFun. By accessing or using this web application, you agree to these Terms of Use and applicable laws.\n\n1. Service Architecture & Third-Party Playback: ZappyFun is a catalog discovery interface that indexes publicly available metadata and embeds third-party iframe video players (currently vidly.pro). ZappyFun does not host video files and does not claim or independently verify licensing rights for streams served by third-party embed providers.\n\n2. Accounts, Watchlists & Local Progress: You may browse without an account or sign in using Google Sign-In via Firebase Authentication. When signed in with a verified email, your saved Watchlist items are stored in Cloud Firestore (/watchlists). Playback progress ("Continue Watching") and completed-title markers are stored locally in your browser's localStorage on your current device only and are not synced across devices.\n\n3. Age & Content Ratings: Displayed maturity ratings (such as PG-13 or TV-14) are informational metadata sourced from third-party databases; ZappyFun does not enforce technical age-gate verification.\n\n4. Contact: For questions regarding these Terms, contact ${OFFICIAL_CONTACT_EMAIL}.`,
  },
  privacy: {
    title: 'Privacy Policy',
    subtitle: 'Effective Date: October 2026 · Data collection, storage, and deletion disclosures.',
    body: `Effective Date: October 2026\nData Controller & Grievance Contact: [Owner Input Required: Operator / Grievance Officer Name and Physical Address] · Email: ${OFFICIAL_CONTACT_EMAIL}\n\n1. Authentication Data: When you sign in with Google via Firebase Authentication, Firebase processes your Google account identifier (UID), email address, display name, profile photo URL, and email-verification status.\n\n2. Cloud Firestore Data: Signed-in users with verified emails can save titles to Cloud Firestore under /watchlists/{uid}_{mediaId} (storing mediaId, ownerId, and createdAt). Access to watchlist documents is restricted by Firestore Security Rules to the document owner and verified administrators.\n\n3. Support Form Data & Retention: Submitting the Support & Contact form transmits your First Name, Last Name, Email, Phone Number (optional), Message, sender UID (or "guest"), and timestamp to our Express server endpoint (POST /api/support), which holds tickets in server memory until server restart or administrative deletion. If you are signed in with a verified email, a copy is also stored in Cloud Firestore (/support_messages/{messageId}) until deleted by a verified administrator. Support messages are accessible only to verified administrators.\n\n4. Third-Party Embeds & Metadata Providers: Starting playback loads a third-party iframe from vidly.pro, which receives your IP address and browser request headers and may set its own cookies or local storage under its own privacy policy. Artwork, fonts, and metadata requests may connect to JustWatch, TMDB (image.tmdb.org), IMDb, TVMaze, Wikipedia/Wikimedia, and Google Fonts.\n\n5. Self-Service Account & Data Deletion: Signed-in users can delete their Cloud Firestore watchlist records, device-local watch progress/watchlist caches, and Firebase Authentication user account in My Space ("Delete Account & Data"). Previously submitted support tickets cannot be deleted via self-service and require emailing ${OFFICIAL_CONTACT_EMAIL}.`,
  },
  advertising: {
    title: 'Cookie & Local Storage Policy',
    subtitle: 'Browser localStorage keys, third-party embeds, and display preferences.',
    body: `1. First-Party Browser Storage: ZappyFun does not set first-party HTTP tracking or analytics cookies. Instead, the application uses browser localStorage on your device for essential functionality:\n• zappy_watch_progress_v2, zappy_watchlist_v2, zappy_completed_v1: Stores your device-local Continue Watching progress, local watchlist cache, and completed titles.\n• zappy_ads_enabled_v1: Remembers whether optional companion display banner slots are shown or hidden.\n• zappy_legal_pages_v1, zappy_hero_8movie_cycle_v1, zappy_visual_ui_overrides_v1, zappy_active_firebase_project_v1: Caches application configuration and UI layout settings.\n\n2. Third-Party Cookies & Storage: Google Sign-In (Firebase Authentication) and third-party embedded video players (vidly.pro) operate in their own contexts and may set cookies or local storage governed by their respective policies.\n\n3. Companion Display Slots: You can toggle optional page display banner placeholders on or off below.`,
  },
  disclaimer: {
    title: 'Legal Disclaimer & DMCA',
    subtitle: 'Third-party streaming embeds, metadata attribution, and copyright notices.',
    body: `Designated Copyright / DMCA Contact: ${OFFICIAL_CONTACT_EMAIL}\n[Owner Input Required: Designated Agent Name, Physical Mailing Address, and Phone Number]\n\n1. No Media Hosting or Licensing Claim: ZappyFun does not host, upload, or transcode video files on its own servers. Playback links point to third-party embed providers (vidly.pro). ZappyFun makes no representation or warranty that third-party embedded streams are licensed or authorized by copyright holders.\n\n2. Metadata & Trademarks: Movie and series titles, synopses, ratings, cast portraits, and artwork are retrieved from public metadata interfaces including JustWatch, TMDB, IMDb Suggestion API, TVMaze, and Wikipedia/Wikimedia. All trademarks and copyrights belong to their respective owners.\n\n3. Copyright & Takedown Requests: Rightsholders requesting removal of a catalog entry or embed reference from ZappyFun may send a written notice identifying the catalog title and URL to ${OFFICIAL_CONTACT_EMAIL}.`,
  },
  about: {
    title: 'About ZappyFun',
    subtitle: 'Catalog discovery and streaming web application.',
    body: `ZappyFun is a web-based movie and TV series discovery application built with React, TypeScript, Express, Firebase Authentication, and Cloud Firestore.\n\nKey Features:\n• Browse and search catalog metadata by genre, release year, and popularity.\n• Device-local Continue Watching progress saved in browser localStorage.\n• Cloud Firestore watchlist synchronization for users signed in with Google.\n• Direct support messaging and customizable legal disclosures via the Admin Studio.\n\nOfficial Contact: ${OFFICIAL_CONTACT_EMAIL}`,
  },
};

function fixTypoEmail(text: string): string {
  return text.replace(/ContactZappyFun@gamil\.com/gi, OFFICIAL_CONTACT_EMAIL);
}

/**
 * Normalizes stored or incoming LegalPagesConfig:
 * - Replaces any erroneous ContactZappyFun@gamil.com references with ContactZappyFun@gmail.com
 * - Preserves intentionally customized admin legal page content
 * - Upgrades unedited legacy default boilerplate to the updated code-accurate disclosures
 */
export function normalizeLegalPagesConfig(
  raw?: Partial<LegalPagesConfig> | null
): LegalPagesConfig {
  if (!raw || typeof raw !== 'object') {
    return DEFAULT_LEGAL_PAGES;
  }

  const rawEmail = typeof raw.contactEmail === 'string' ? raw.contactEmail.trim() : '';
  const contactEmail =
    !rawEmail || /^ContactZappyFun@gamil\.com$/i.test(rawEmail)
      ? OFFICIAL_CONTACT_EMAIL
      : fixTypoEmail(rawEmail);

  const sections = ['terms', 'privacy', 'advertising', 'disclaimer', 'about'] as const;
  const result: LegalPagesConfig = {
    ...DEFAULT_LEGAL_PAGES,
    contactEmail,
    updatedAtMs: raw.updatedAtMs,
  };

  for (const key of sections) {
    const incomingSec = raw[key];
    const defaultSec = DEFAULT_LEGAL_PAGES[key];
    if (
      !incomingSec ||
      typeof incomingSec !== 'object' ||
      !incomingSec.body ||
      !incomingSec.body.trim()
    ) {
      result[key] = defaultSec;
      continue;
    }

    const trimmedBody = incomingSec.body.trim();
    const isUneditedLegacyBoilerplate =
      trimmedBody.includes(LEGACY_BOILERPLATE_SNIPPETS[key]) &&
      !trimmedBody.includes('Effective Date:') &&
      !trimmedBody.includes('First-Party Browser Storage:') &&
      !trimmedBody.includes('No Media Hosting or Licensing Claim:') &&
      !trimmedBody.includes('Key Features:');

    if (isUneditedLegacyBoilerplate) {
      result[key] = defaultSec;
    } else {
      result[key] = {
        title: fixTypoEmail(incomingSec.title?.trim() || defaultSec.title),
        subtitle: fixTypoEmail(
          incomingSec.subtitle?.trim() || defaultSec.subtitle
        ),
        body: fixTypoEmail(incomingSec.body),
      };
    }
  }

  return result;
}

interface InfoModalProps {
  modalType: InfoModalType;
  adsEnabled: boolean;
  legalPages?: LegalPagesConfig;
  onToggleAds: () => void;
  onClose: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({
  modalType,
  adsEnabled,
  legalPages = DEFAULT_LEGAL_PAGES,
  onToggleAds,
  onClose,
}) => {
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const mergedLegal = normalizeLegalPagesConfig(legalPages);

  const getActiveContent = (): {
    title: string;
    subtitle: string;
    paragraphs: string[];
  } | null => {
    if (!modalType) return null;

    if (modalType === 'contact') {
      return {
        title: 'Help & Contact',
        subtitle: 'Direct contact with ZappyFun administration.',
        paragraphs: [
          'Use our Support page to send a direct message to the ZappyFun administration team. Submitted messages are sent to the Admin Studio support inbox.',
          `Official Contact Email: ${mergedLegal.contactEmail}`,
        ],
      };
    }

    const pageObj: LegalPageContent =
      mergedLegal[modalType] || DEFAULT_LEGAL_PAGES[modalType];
    const paragraphs = String(pageObj?.body || '')
      .split(/\n+/)
      .map((p) => p.trim())
      .filter(Boolean);

    return {
      title: pageObj?.title || 'Information',
      subtitle: pageObj?.subtitle || '',
      paragraphs:
        paragraphs.length > 0
          ? paragraphs
          : ['No additional details available.'],
    };
  };

  const activeContent = getActiveContent();

  const handleCopyEmail = () => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(mergedLegal.contactEmail);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2500);
    }
  };

  const handleCopyDirectLink = () => {
    if (!modalType) return;
    const paramValue = modalType === 'advertising' ? 'cookies' : modalType;
    const url = `${window.location.origin}${window.location.pathname}?legal=${encodeURIComponent(
      paramValue
    )}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  return (
    <AnimatePresence>
      {modalType && activeContent && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
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
            className="w-full max-w-xl rounded-2xl bg-[#14161D] border border-[#292C35] p-5 sm:p-6 space-y-4 shadow-2xl my-auto max-h-[88vh] flex flex-col"
          >
            <div className="flex items-start justify-between gap-4 shrink-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#FFC400] shrink-0" />
                  <h2
                    id="modal-title"
                    className="text-lg sm:text-xl font-bold text-white font-display truncate"
                  >
                    {activeContent.title}
                  </h2>
                </div>
                {activeContent.subtitle && (
                  <p className="text-xs text-[#FFC400] mt-0.5 font-semibold">
                    {activeContent.subtitle}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCopyDirectLink}
                  className="min-h-[40px] px-3 rounded-xl bg-[#08090D] border border-[#292C35] text-xs font-semibold text-[#A7A9B4] hover:text-white flex items-center gap-1.5 cursor-pointer transition-colors"
                  title="Copy direct link to this policy"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#FFC400]" />
                      <span className="text-[#FFC400]">Link Copied</span>
                    </>
                  ) : (
                    <>
                      <Link2 className="w-3.5 h-3.5 text-[#FFC400]" />
                      <span className="hidden sm:inline">Direct Link</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[40px] min-w-[40px] rounded-xl bg-[#08090D] border border-[#292C35] text-[#A7A9B4] hover:text-white flex items-center justify-center cursor-pointer shrink-0 transition-colors"
                  aria-label="Close dialog"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-3 text-xs sm:text-sm text-[#D4D6DF] leading-relaxed overflow-y-auto pr-1 flex-1">
              {activeContent.paragraphs.map((p, idx) => (
                <p key={idx} className="whitespace-pre-wrap">
                  {p}
                </p>
              ))}
            </div>

            {/* Official Contact Email Box */}
            <div className="p-3.5 rounded-xl bg-[#08090D] border border-[#292C35] flex flex-wrap items-center justify-between gap-2.5 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Mail className="w-4 h-4 text-[#FFC400] shrink-0" />
                <div className="min-w-0">
                  <span className="block text-[10px] uppercase tracking-wider text-[#747784] font-bold">
                    Official Contact
                  </span>
                  <a
                    href={`mailto:${mergedLegal.contactEmail}`}
                    className="text-xs sm:text-sm font-bold text-white hover:text-[#FFC400] truncate block transition-colors"
                  >
                    {mergedLegal.contactEmail}
                  </a>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCopyEmail}
                className="min-h-[34px] px-3 py-1.5 rounded-lg bg-[#14161D] hover:bg-[#252832] border border-[#292C35] text-xs font-semibold text-[#FFC400] flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors"
              >
                {copiedEmail ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Email</span>
                  </>
                )}
              </button>
            </div>

            {modalType === 'advertising' && (
              <div className="pt-3 border-t border-[#292C35] flex flex-wrap items-center justify-between gap-3 shrink-0">
                <span className="text-xs text-[#A7A9B4] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#FFC400]" />
                  <span>Companion Display Banner Slots:</span>
                </span>
                <button
                  type="button"
                  onClick={onToggleAds}
                  className={`min-h-[38px] px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    adsEnabled
                      ? 'bg-[#FFC400] text-[#08090D] font-bold'
                      : 'bg-[#08090D] text-[#A7A9B4] hover:text-white border border-[#292C35]'
                  }`}
                >
                  {adsEnabled ? 'Enabled (Showing Slots)' : 'Disabled (Hidden)'}
                </button>
              </div>
            )}

            <div className="pt-1 flex justify-end shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[40px] px-5 py-2 rounded-xl bg-[#FFC400] hover:bg-[#FFD54A] text-xs font-bold text-[#08090D] transition-colors cursor-pointer"
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
