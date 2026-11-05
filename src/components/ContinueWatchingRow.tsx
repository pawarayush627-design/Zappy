import React, { useRef } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Play, X } from 'lucide-react';
import { MediaItem } from '../types/media';
import { MediaArtwork } from './MediaArtwork';

export interface WatchProgressEntry {
  mediaId: string;
  seasonNumber: number;
  episodeNumber: number;
  seasonEpisodeLabel: string;
  remainingLabel: string;
  progressPercent: number;
  updatedAtMs?: number;
}

interface ContinueWatchingRowProps {
  items: {
    item: MediaItem;
    progress: WatchProgressEntry;
  }[];
  onSelectMedia: (item: MediaItem, autoPlay?: boolean, resumeSavedProgress?: boolean) => void;
  onSeeAll: () => void;
  onRemoveProgress?: (mediaId: string, e: React.MouseEvent) => void;
}

export const ContinueWatchingRow: React.FC<ContinueWatchingRowProps> = ({
  items,
  onSelectMedia,
  onRemoveProgress,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  if (items.length === 0) return null;

  const handleScroll = (direction: 'left' | 'right') => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const scrollAmount = Math.max(300, el.clientWidth * 0.75);
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  return (
    <section
      className="space-y-3.5"
      aria-label="Continue Watching"
    >
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg sm:text-xl lg:text-2xl font-extrabold text-white font-display tracking-tight">
          Continue Watching
        </h2>

        {items.length > 3 && (
          <div className="hidden sm:flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleScroll('left')}
              className="w-8 h-8 rounded-lg bg-[#14161D] hover:bg-[#252832] border border-[#292C35] hover:border-[#FFB800]/50 text-white flex items-center justify-center cursor-pointer transition-all active:scale-95"
              aria-label="Scroll Continue Watching left"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleScroll('right')}
              className="w-8 h-8 rounded-lg bg-[#14161D] hover:bg-[#252832] border border-[#292C35] hover:border-[#FFB800]/50 text-white flex items-center justify-center cursor-pointer transition-all active:scale-95"
              aria-label="Scroll Continue Watching right"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <div
        ref={scrollContainerRef}
        className="flex gap-3.5 sm:gap-4 overflow-x-auto no-scrollbar pb-1.5 pt-0.5"
      >
        {items.map(({ item, progress }) => (
          <motion.article
            key={item.id}
            whileHover={{ y: -6, scale: 1.02 }}
            transition={{ type: 'spring', stiffness: 320, damping: 24 }}
            className="group relative w-[240px] sm:w-[290px] rounded-2xl bg-[#14161D] border border-[#292C35] hover:border-[#FF5A36]/80 p-2.5 flex flex-col gap-2.5 transition-all duration-300 shrink-0 cinema-card-shadow cinema-glow-hover will-change-transform"
          >
            {/* Widescreen Backdrop Thumbnail with Glass Sheen Sweep */}
            <div className="relative aspect-[16/9] w-full rounded-xl overflow-hidden bg-[#0F1117] zf-sheen">
              <button
                type="button"
                onClick={() => onSelectMedia(item, true, true)}
                className="w-full h-full block text-left cursor-pointer focus:outline-none"
                aria-label={`Resume ${item.title}`}
              >
                <MediaArtwork
                  src={item.backdropUrl || item.posterUrl}
                  alt={item.title}
                  item={item}
                  aspectRatio="backdrop"
                  className="w-full h-full object-cover group-hover:scale-[1.08] transition-transform duration-700 ease-out group-hover:brightness-105"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />

                {/* Center Play Button with Spring Pop */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full zf-gradient-btn text-white flex items-center justify-center shadow-xl group-hover:scale-115 transition-transform duration-300">
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  </div>
                </div>

                {/* Bottom Overlay Progress Bar */}
                <div className="absolute bottom-2 left-2.5 right-2.5 pointer-events-none">
                  <div className="w-full h-1 rounded-full bg-white/20 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#FFB800] via-[#FF5A36] to-[#FF168B] rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(
                          98,
                          Math.max(5, progress.progressPercent || 15)
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </button>

              {onRemoveProgress && (
                <button
                  type="button"
                  onClick={(e) => onRemoveProgress(item.id, e)}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/75 hover:bg-[#FFB800] text-[#A7A9B4] hover:text-[#08090D] border border-white/15 flex items-center justify-center transition-all cursor-pointer z-10 active:scale-90"
                  title="Remove from Continue Watching"
                  aria-label={`Remove ${item.title} from Continue Watching`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Bottom Title & Progress Metadata — Clicking opens details */}
            <div className="flex items-center justify-between gap-2 px-0.5 min-w-0">
              <button
                type="button"
                onClick={() => onSelectMedia(item, false, false)}
                className="min-w-0 flex-1 text-left cursor-pointer"
              >
                <h3 className="text-xs sm:text-sm font-bold text-white group-hover:text-[#FFB800] transition-colors truncate font-display">
                  {item.title}
                </h3>
              </button>
              <div className="flex items-center gap-1.5 text-[11px] text-[#A7A9B4] tabular-nums shrink-0 font-medium">
                <span>
                  {item.contentType === 'series'
                    ? progress.seasonEpisodeLabel
                    : item.releaseYear}
                </span>
                {progress.remainingLabel && (
                  <>
                    <span aria-hidden="true" className="text-[#747784]">·</span>
                    <span className="text-[#FFB800] font-semibold">
                      {progress.remainingLabel} left
                    </span>
                  </>
                )}
              </div>
            </div>
          </motion.article>
        ))}
      </div>
    </section>
  );
};
