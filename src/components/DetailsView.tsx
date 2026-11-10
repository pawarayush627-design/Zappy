import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  Plus,
  Check,
  Share2,
  Settings,
  Eye,
  Sparkles,
  Loader2,
  Star,
} from 'lucide-react';
import { MediaItem } from '../types/media';
import { VideoPlayer } from './VideoPlayer';
import { MovieCard } from './MovieCard';
import { getMovieShareUrl } from '../utils/movieUrl';

interface DetailsViewProps {
  item: MediaItem;
  relatedItems: MediaItem[];
  watchlistIds: string[];
  inWatchlist: boolean;
  isCompleted?: boolean;
  autoPlayInitial?: boolean;
  isAdmin?: boolean;
  isPreviewDraft?: boolean;
  isPublishingDraft?: boolean;
  hasProgress?: boolean;
  onBack: () => void;
  onSelectMedia: (item: MediaItem, autoPlay?: boolean, resumeSaved?: boolean) => void;
  onToggleWatchlist: (item: MediaItem, e: React.MouseEvent) => void;
  onMarkWatched: (item: MediaItem) => void;
  onSelectGenre: (genre: string) => void;
  onSearchQuery?: (query: string) => void;
  onOpenAdminStudio: (mediaItem: MediaItem) => void;
  onPublishPreviewDraft?: () => void;
  onReturnToAdminStudio?: () => void;
  onUpdateProgress?: (
    season: number,
    episode: number,
    progressPercent?: number,
    remainingMinutes?: number
  ) => void;
  onStartOver?: () => void;
}

function formatDurationDisplay(minutes: number): string {
  if (!minutes || minutes <= 0) return '';
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs <= 0) return `${mins}m`;
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

export const DetailsView: React.FC<DetailsViewProps> = ({
  item,
  relatedItems,
  watchlistIds,
  inWatchlist,
  isCompleted = false,
  autoPlayInitial = false,
  isAdmin = false,
  isPreviewDraft = false,
  isPublishingDraft = false,
  hasProgress = false,
  onBack,
  onSelectMedia,
  onToggleWatchlist,
  onMarkWatched,
  onSelectGenre,
  onOpenAdminStudio,
  onPublishPreviewDraft,
  onReturnToAdminStudio,
  onUpdateProgress,
}) => {
  const [copiedNotice, setCopiedNotice] = useState(false);

  const realImdbRating = useMemo(() => {
    const raw = (item as MediaItem & { imdbRating?: number }).imdbRating;
    if (typeof raw === 'number' && !Number.isNaN(raw) && raw > 0) {
      return raw.toFixed(1);
    }
    return null;
  }, [item]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [item.id, item.title]);

  const handleShare = () => {
    const shareUrl = getMovieShareUrl(item);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        setCopiedNotice(true);
        setTimeout(() => setCopiedNotice(false), 2500);
      });
    } else {
      setCopiedNotice(true);
      setTimeout(() => setCopiedNotice(false), 2500);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-x-hidden"
    >
      <div className="max-w-7xl mx-auto space-y-5">
        {/* ADMIN UNPUBLISHED DRAFT PREVIEW BAR */}
        {isPreviewDraft && (
          <div className="rounded-2xl bg-[#1A1429] border border-[#B892FF]/50 p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3 shadow-2xl relative z-40">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#B892FF]/20 border border-[#B892FF]/40 text-[#B892FF] flex items-center justify-center shrink-0">
                <Eye className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[#B892FF] text-xs font-extrabold tracking-wide">
                    Draft Preview ·
                  </span>
                  <h2 className="text-xs sm:text-sm font-bold text-white font-display truncate">
                    {item.title}
                  </h2>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {onReturnToAdminStudio && (
                <button
                  type="button"
                  onClick={onReturnToAdminStudio}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Editor</span>
                </button>
              )}
              {onPublishPreviewDraft && (
                <button
                  type="button"
                  disabled={isPublishingDraft}
                  onClick={onPublishPreviewDraft}
                  className="min-h-[38px] px-4 py-1.5 rounded-xl bg-[#FFC400] hover:bg-[#FFD54A] text-[#08090D] text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-[#FFC400]/25 transition-colors disabled:opacity-60"
                >
                  {isPublishingDraft ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Publishing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Publish Now</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {/* =========================================================
            PURE DOMINANT VIDEO PLAYER SUBJECT (ZERO TOP BUTTON CLUTTER)
        ========================================================= */}
        <section aria-label="Video Player" className="w-full">
          <VideoPlayer
            item={item}
            autoPlay={Boolean(autoPlayInitial) || true}
            selectedTrackIndex={0}
            reloadKey={0}
            isCompleted={isCompleted}
            hasProgress={hasProgress}
            onMarkWatched={() => onMarkWatched(item)}
            onPlaybackProgress={(pct, remMins) => {
              if (onUpdateProgress) {
                onUpdateProgress(1, 1, pct, remMins);
              }
            }}
          />
        </section>

        {/* =========================================================
            MOVIE INFO & ACTIONS BELOW THE PLAYER
        ========================================================= */}
        <div className="rounded-2xl bg-[#14161D] border border-[#292C35] p-4 sm:p-6 space-y-4 cinema-card-shadow">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="space-y-2 min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#A7A9B4]">
                {item.releaseYear > 0 && (
                  <span className="text-[#FFB800] font-bold tabular-nums">
                    {item.releaseYear}
                  </span>
                )}
                {item.maturityRating && (
                  <>
                    <span aria-hidden="true" className="text-[#747784]">·</span>
                    <span className="text-white/90 font-semibold">
                      {item.maturityRating}
                    </span>
                  </>
                )}
                {item.durationMinutes > 0 && (
                  <>
                    <span aria-hidden="true" className="text-[#747784]">·</span>
                    <span className="tabular-nums text-white/85">
                      {formatDurationDisplay(item.durationMinutes)}
                    </span>
                  </>
                )}
                {realImdbRating && (
                  <>
                    <span aria-hidden="true" className="text-[#747784]">·</span>
                    <span className="inline-flex items-center gap-1 text-[#FFB800] font-bold tabular-nums">
                      <Star className="w-3.5 h-3.5 fill-current" />
                      <span>IMDb {realImdbRating}</span>
                    </span>
                  </>
                )}
                {item.genres && item.genres.length > 0 && (
                  <>
                    <span aria-hidden="true" className="text-[#747784]">·</span>
                    <span className="text-white/90">
                      {item.genres.join(' / ')}
                    </span>
                  </>
                )}
              </div>

              <h1
                className="text-xl sm:text-3xl font-black text-white font-display tracking-tight leading-tight break-words"
                style={{ textWrap: 'balance' }}
              >
                {item.title}
              </h1>

              {item.synopsis && (
                <p className="text-xs sm:text-sm text-[#D4D6DF] leading-relaxed max-w-4xl">
                  {item.synopsis}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={(e) => onToggleWatchlist(item, e)}
                className={`min-h-[40px] px-4 py-2 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                  inWatchlist
                    ? 'bg-[#252832] border-[#FFB800] text-[#FFB800]'
                    : 'bg-[#08090D] hover:bg-[#252832] border-[#292C35] text-white'
                }`}
              >
                {inWatchlist ? (
                  <>
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    <span>In Watchlist</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5 shrink-0" />
                    <span>Watchlist</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleShare}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#08090D] hover:bg-[#252832] border border-[#292C35] text-xs font-semibold text-[#A7A9B4] hover:text-white flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>{copiedNotice ? 'Copied Link' : 'Share'}</span>
              </button>

              {isAdmin && !isPreviewDraft && (
                <button
                  type="button"
                  onClick={() => onOpenAdminStudio(item)}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-[#08090D] hover:bg-[#252832] border border-[#FFB800]/40 text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0"
                >
                  <Settings className="w-3.5 h-3.5 text-[#FFB800]" />
                  <span>Edit in Studio</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* =========================================================
            MORE LIKE THIS (Clean, Focused Recommendations)
        ========================================================= */}
        {relatedItems.length > 0 && (
          <section className="space-y-3.5 pt-1">
            <h2 className="text-base sm:text-xl font-extrabold text-white font-display tracking-tight">
              More Like This
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
              {relatedItems.slice(0, 6).map((rel, idx) => (
                <MovieCard
                  key={rel.id}
                  item={rel}
                  index={idx}
                  inWatchlist={watchlistIds.includes(rel.id)}
                  onSelect={(m, auto) => onSelectMedia(m, auto, false)}
                  onToggleWatchlist={onToggleWatchlist}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </motion.div>
  );
};
