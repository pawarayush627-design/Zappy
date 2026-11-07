import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Mail,
  Copy,
  Check,
  ShieldCheck,
  FileText,
  Link2,
  ArrowLeft,
  Edit3,
  Save,
  RotateCcw,
  ExternalLink,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import {
  CODE_LEGAL_PAGES,
  OFFICIAL_CONTACT_EMAIL,
  OFFICIAL_WEBSITE_URL,
  LEGAL_ROUTE_SLUGS,
  normalizeLegalPagesConfig,
  resolveLegalSectionFromLocation,
  LegalPageContent,
  LegalPagesConfig,
  LegalSectionKey,
  InfoModalType,
} from '../data/legalDocuments';

export {
  CODE_LEGAL_PAGES,
  CODE_LEGAL_PAGES as DEFAULT_LEGAL_PAGES,
  OFFICIAL_CONTACT_EMAIL,
  OFFICIAL_WEBSITE_URL,
  LEGAL_ROUTE_SLUGS,
  normalizeLegalPagesConfig,
  resolveLegalSectionFromLocation,
};

export type {
  LegalPageContent,
  LegalPagesConfig,
  LegalSectionKey,
  InfoModalType,
};

const LEGAL_NAV_ITEMS: {
  id: LegalSectionKey;
  label: string;
  slug: string;
}[] = [
  { id: 'terms', label: 'Terms of Use', slug: '/Terms-of-use' },
  { id: 'privacy', label: 'Privacy Policy', slug: '/Privacy-policy' },
  { id: 'about', label: 'About', slug: '/About' },
  {
    id: 'disclaimer',
    label: 'Disclaimer & Copyright Policy',
    slug: '/Disclaimer-and-copyright-policy',
  },
  { id: 'advertising', label: 'Cookie Policy', slug: '/Cookie-policy' },
];

interface LegalDocumentPageProps {
  section: LegalSectionKey;
  legalPages: LegalPagesConfig;
  adsEnabled: boolean;
  isAdmin: boolean;
  onSelectSection: (section: LegalSectionKey) => void;
  onBackHome: () => void;
  onOpenSupport: () => void;
  onToggleAds: () => void;
  onSaveLegalPages: (nextLegal: LegalPagesConfig) => Promise<void> | void;
}

/**
 * Full-Page Dedicated Legal Document View
 * Renders /Terms-of-use, /Privacy-policy, /About, /Disclaimer-and-copyright-policy, and /Cookie-policy
 * as a clean, non-overlapping full page with direct source-code synchronization on edit.
 */
export const LegalDocumentPage: React.FC<LegalDocumentPageProps> = ({
  section,
  legalPages,
  adsEnabled,
  isAdmin,
  onSelectSection,
  onBackHome,
  onOpenSupport,
  onToggleAds,
  onSaveLegalPages,
}) => {
  const mergedLegal = normalizeLegalPagesConfig(legalPages);
  const activeDoc: LegalPageContent =
    mergedLegal[section] || CODE_LEGAL_PAGES[section];

  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [isEditingInline, setIsEditingInline] = useState(false);
  const [draftTitle, setDraftTitle] = useState(activeDoc.title);
  const [draftSubtitle, setDraftSubtitle] = useState(activeDoc.subtitle);
  const [draftBody, setDraftBody] = useState(activeDoc.body);
  const [draftEmail, setDraftEmail] = useState(mergedLegal.contactEmail);
  const [isSavingCode, setIsSavingCode] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  useEffect(() => {
    setDraftTitle(activeDoc.title);
    setDraftSubtitle(activeDoc.subtitle);
    setDraftBody(activeDoc.body);
    setDraftEmail(mergedLegal.contactEmail);
  }, [
    section,
    activeDoc.title,
    activeDoc.subtitle,
    activeDoc.body,
    mergedLegal.contactEmail,
  ]);

  const canonicalSlug = LEGAL_ROUTE_SLUGS[section] || '/Terms-of-use';
  const fullPageUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${canonicalSlug}`
      : canonicalSlug;

  const paragraphs = String(activeDoc.body || '')
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  const handleCopyEmail = () => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(mergedLegal.contactEmail);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2500);
    }
  };

  const handleCopyPageUrl = () => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(fullPageUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2500);
    }
  };

  const handleSaveInlineEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingCode(true);
    setSaveNotice(null);
    try {
      const updatedConfig: LegalPagesConfig = normalizeLegalPagesConfig({
        ...mergedLegal,
        contactEmail: draftEmail.trim() || OFFICIAL_CONTACT_EMAIL,
        updatedAtMs: Date.now(),
        [section]: {
          title: draftTitle.trim() || activeDoc.title,
          subtitle: draftSubtitle.trim() || activeDoc.subtitle,
          slug: canonicalSlug,
          body: draftBody,
        },
      });
      await onSaveLegalPages(updatedConfig);
      setIsEditingInline(false);
      setSaveNotice(
        'Saved! Updated directly in source code (/src/data/legalDocuments.ts) and live application.'
      );
      setTimeout(() => setSaveNotice(null), 5000);
    } finally {
      setIsSavingCode(false);
    }
  };

  return (
    <motion.div
      key={`legal-page-${section}`}
      data-legal-page="true"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.22 }}
      className="w-full max-w-5xl mx-auto space-y-6 pb-12"
    >
      {/* Top Navigation & Route Bar */}
      <div className="rounded-2xl bg-[#14161D] border border-[#292C35] p-4 sm:p-5 space-y-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onBackHome}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#08090D] hover:bg-[#252832] border border-[#292C35] hover:border-[#FFC400] text-white text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-[#FFC400] shrink-0" />
              <span>Back to Home</span>
            </button>

            <div className="px-3 py-2 rounded-xl bg-[#08090D] border border-[#292C35] flex items-center gap-2 text-xs font-mono-tabular text-[#A7A9B4]">
              <Link2 className="w-3.5 h-3.5 text-[#FFC400] shrink-0" />
              <span className="truncate max-w-[220px] sm:max-w-[360px] text-white">
                {canonicalSlug}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopyPageUrl}
              className="min-h-[38px] px-3.5 py-2 rounded-xl bg-[#08090D] hover:bg-[#252832] border border-[#292C35] text-xs font-semibold text-[#D4D6DF] hover:text-white flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              {copiedUrl ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#FFC400]" />
                  <span className="text-[#FFC400]">URL Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-[#FFC400]" />
                  <span>Copy Page URL</span>
                </>
              )}
            </button>

            <a
              href={canonicalSlug}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[38px] px-3.5 py-2 rounded-xl bg-[#08090D] hover:bg-[#252832] border border-[#292C35] text-xs font-semibold text-[#D4D6DF] hover:text-white flex items-center gap-1.5 transition-colors"
              title="Open this legal page in a new browser tab"
            >
              <ExternalLink className="w-3.5 h-3.5 text-[#FFC400]" />
              <span>New Tab</span>
            </a>

            {isAdmin && (
              <button
                type="button"
                onClick={() => setIsEditingInline((prev) => !prev)}
                className={`min-h-[38px] px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                  isEditingInline
                    ? 'bg-[#FFC400] text-[#08090D]'
                    : 'bg-[#252832] hover:bg-[#292C35] border border-[#FFC400]/40 text-[#FFC400]'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>
                  {isEditingInline ? 'Close Editor' : 'Edit in Code'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Dedicated Legal Pages Tab Switcher */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[#292C35]">
          {LEGAL_NAV_ITEMS.map((item) => {
            const isActive = section === item.id;
            return (
              <a
                key={item.id}
                href={item.slug}
                onClick={(e) => {
                  e.preventDefault();
                  onSelectSection(item.id);
                }}
                className={`min-h-[38px] px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#FFC400] text-[#08090D] shadow-md shadow-[#FFC400]/15'
                    : 'bg-[#08090D] hover:bg-[#252832] border border-[#292C35] text-[#A7A9B4] hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span>{item.label}</span>
              </a>
            );
          })}
        </div>
      </div>

      {/* Save Confirmation Banner */}
      {saveNotice && (
        <div
          role="status"
          className="rounded-xl bg-emerald-500/10 border border-emerald-500/40 p-4 flex items-center gap-2.5 text-xs sm:text-sm text-emerald-200"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{saveNotice}</span>
        </div>
      )}

      {/* Inline Admin Code-Sync Editor (When Active) */}
      {isAdmin && isEditingInline && (
        <form
          onSubmit={handleSaveInlineEdit}
          className="rounded-2xl bg-[#14161D] border-2 border-[#FFC400]/60 p-5 sm:p-6 space-y-4 shadow-2xl"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#292C35] pb-3">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white font-display flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#FFC400]" />
                <span>
                  Editing {activeDoc.title} ({canonicalSlug})
                </span>
              </h2>
              <p className="text-xs text-[#A7A9B4] mt-0.5">
                Saving updates both the live app and writes directly into{' '}
                <code className="text-[#FFC400]">
                  /src/data/legalDocuments.ts
                </code>{' '}
                in your codebase.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const def = CODE_LEGAL_PAGES[section];
                  setDraftTitle(def.title);
                  setDraftSubtitle(def.subtitle);
                  setDraftBody(def.body);
                  setDraftEmail(CODE_LEGAL_PAGES.contactEmail);
                }}
                className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#08090D] hover:bg-[#252832] border border-[#292C35] text-xs font-semibold text-[#A7A9B4] hover:text-white flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#FFC400]" />
                <span>Reset Default</span>
              </button>

              <button
                type="submit"
                disabled={isSavingCode}
                className="min-h-[36px] px-4 py-1.5 rounded-xl bg-[#FFC400] hover:bg-[#FFD54A] text-[#08090D] text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-[#FFC400]/20 disabled:opacity-60"
              >
                {isSavingCode ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Updating Code...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save &amp; Update in Code</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#A7A9B4]">
                Document Title
              </label>
              <input
                type="text"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                className="w-full min-h-[40px] px-3.5 rounded-xl bg-[#08090D] border border-[#292C35] text-xs sm:text-sm text-white font-bold focus:outline-none focus:border-[#FFC400]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#A7A9B4]">
                Subtitle / Effective Date
              </label>
              <input
                type="text"
                value={draftSubtitle}
                onChange={(e) => setDraftSubtitle(e.target.value)}
                className="w-full min-h-[40px] px-3.5 rounded-xl bg-[#08090D] border border-[#292C35] text-xs sm:text-sm text-[#FFC400] focus:outline-none focus:border-[#FFC400]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#A7A9B4]">
                Official Contact Email
              </label>
              <input
                type="email"
                value={draftEmail}
                onChange={(e) => setDraftEmail(e.target.value)}
                className="w-full min-h-[40px] px-3.5 rounded-xl bg-[#08090D] border border-[#292C35] text-xs sm:text-sm text-white focus:outline-none focus:border-[#FFC400]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#A7A9B4]">
              Full Document Content (Separate sections with a blank line)
            </label>
            <textarea
              rows={14}
              value={draftBody}
              onChange={(e) => setDraftBody(e.target.value)}
              className="w-full p-4 rounded-xl bg-[#08090D] border border-[#292C35] text-xs sm:text-sm text-white leading-relaxed focus:outline-none focus:border-[#FFC400]"
            />
          </div>
        </form>
      )}

      {/* Main Legal Document Article (Clean, Spacious, Zero Overlap) */}
      <article className="rounded-2xl bg-[#14161D] border border-[#292C35] p-6 sm:p-8 lg:p-10 space-y-6 shadow-2xl">
        {/* Document Header */}
        <header className="space-y-2 border-b border-[#292C35] pb-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-[#08090D] border border-[#292C35] text-[11px] font-bold text-[#FFC400] uppercase tracking-wider">
            <FileText className="w-3.5 h-3.5 shrink-0" />
            <span>Official ZappyFun Legal Document</span>
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white font-display tracking-tight leading-tight break-words">
            {activeDoc.title}
          </h1>

          {activeDoc.subtitle && (
            <p className="text-xs sm:text-sm text-[#FFC400] font-semibold leading-relaxed">
              {activeDoc.subtitle}
            </p>
          )}
        </header>

        {/* Document Body Blocks */}
        <div className="space-y-5 text-sm sm:text-base text-[#D4D6DF] leading-relaxed break-words">
          {paragraphs.map((block, idx) => {
            const lines = block
              .split('\n')
              .map((l) => l.trim())
              .filter(Boolean);
            const firstLine = lines[0] || '';
            const isNumberedHeading =
              /^\d+\.\s+/.test(firstLine) && lines.length > 1;

            if (isNumberedHeading) {
              const restLines = lines.slice(1);
              return (
                <section
                  key={idx}
                  className="rounded-xl bg-[#08090D]/70 border border-[#292C35] p-4 sm:p-5 space-y-2.5"
                >
                  <h2 className="text-base sm:text-lg font-bold text-white font-display leading-snug">
                    {firstLine}
                  </h2>
                  <div className="space-y-2 text-xs sm:text-sm text-[#D4D6DF] leading-relaxed">
                    {restLines.map((line, lineIdx) => (
                      <p key={lineIdx} className="whitespace-pre-wrap">
                        {line}
                      </p>
                    ))}
                  </div>
                </section>
              );
            }

            return (
              <div
                key={idx}
                className="rounded-xl bg-[#08090D]/50 border border-[#292C35]/70 p-4 sm:p-5 space-y-1.5 text-xs sm:text-sm text-[#D4D6DF] leading-relaxed"
              >
                {lines.map((line, lineIdx) => (
                  <p key={lineIdx} className="whitespace-pre-wrap">
                    {line}
                  </p>
                ))}
              </div>
            );
          })}
        </div>

        {/* Companion Display Banner Toggle on Cookie Policy */}
        {section === 'advertising' && (
          <div className="p-4 sm:p-5 rounded-xl bg-[#08090D] border border-[#292C35] flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-[#FFC400] shrink-0" />
              <div>
                <p className="text-xs sm:text-sm font-bold text-white">
                  Companion Display Banner Slots
                </p>
                <p className="text-xs text-[#A7A9B4]">
                  Control whether optional companion display slots are shown during your session.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onToggleAds}
              className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                adsEnabled
                  ? 'bg-[#FFC400] text-[#08090D]'
                  : 'bg-[#14161D] text-[#A7A9B4] hover:text-white border border-[#292C35]'
              }`}
            >
              {adsEnabled ? 'Enabled (Showing Slots)' : 'Disabled (Hidden)'}
            </button>
          </div>
        )}

        {/* Official Contact & Support Card */}
        <footer className="pt-4 border-t border-[#292C35] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#FFC400]/15 border border-[#FFC400]/30 text-[#FFC400] flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="block text-[10px] uppercase tracking-wider text-[#747784] font-bold">
                Official Legal &amp; Support Contact
              </span>
              <a
                href={`mailto:${mergedLegal.contactEmail}`}
                className="text-xs sm:text-sm font-bold text-white hover:text-[#FFC400] truncate block transition-colors"
              >
                {mergedLegal.contactEmail}
              </a>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleCopyEmail}
              className="min-h-[38px] px-3.5 py-2 rounded-xl bg-[#08090D] hover:bg-[#252832] border border-[#292C35] text-xs font-semibold text-[#FFC400] flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              {copiedEmail ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Email Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Email</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onOpenSupport}
              className="min-h-[38px] px-4 py-2 rounded-xl bg-[#FFC400] hover:bg-[#FFD54A] text-xs font-bold text-[#08090D] cursor-pointer transition-colors"
            >
              Open Support Form
            </button>
          </div>
        </footer>
      </article>
    </motion.div>
  );
};

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
  legalPages = CODE_LEGAL_PAGES,
  onToggleAds,
  onClose,
}) => {
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const mergedLegal = normalizeLegalPagesConfig(legalPages);

  const getActiveContent = (): {
    title: string;
    subtitle: string;
    slug: string;
    paragraphs: string[];
  } | null => {
    if (!modalType) return null;

    if (modalType === 'contact') {
      return {
        title: 'Help & Contact',
        subtitle: 'Direct contact with ZappyFun administration.',
        slug: '/About',
        paragraphs: [
          'Use our Support page to send a direct message to the ZappyFun administration team. Submitted messages are sent to the Admin Studio support inbox.',
          `Official Contact Email: ${mergedLegal.contactEmail}`,
        ],
      };
    }

    const pageObj: LegalPageContent =
      mergedLegal[modalType] || CODE_LEGAL_PAGES[modalType];
    const paragraphs = String(pageObj?.body || '')
      .split(/\n+/)
      .map((p) => p.trim())
      .filter(Boolean);

    return {
      title: pageObj?.title || 'Information',
      subtitle: pageObj?.subtitle || '',
      slug: LEGAL_ROUTE_SLUGS[modalType] || '/Terms-of-use',
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
    if (!modalType || !activeContent) return;
    const url = `${window.location.origin}${activeContent.slug}`;
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
          data-info-modal="true"
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
            className="w-full max-w-2xl rounded-2xl bg-[#14161D] border border-[#292C35] p-5 sm:p-6 space-y-4 shadow-2xl my-auto max-h-[88vh] flex flex-col"
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

            <div className="space-y-3 text-xs sm:text-sm text-[#D4D6DF] leading-relaxed overflow-y-auto min-h-0 pr-1 flex-1 break-words">
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
