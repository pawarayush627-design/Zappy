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
      className="space-y-3"
      aria-label="Continue Watching"
    >
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-white font-display">
          Continue Watching
        </h2>

        {items.length > 3 && (
          <div className="hidden sm:flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleScroll('left')}
              className="w-8 h-8 rounded-lg bg-[#14161D] hover:bg-[#252832] border border-[#292C35] text-white flex items-center justify-center cursor-pointer transition-colors"
              aria-label="Scroll Continue Watching left"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleScroll('right')}
              className="w-8 h-8 rounded-lg bg-[#14161D] hover:bg-[#252832] border border-[#292C35] text-white flex items-center justify-center cursor-pointer transition-colors"
              aria-label="Scroll Continue Watching right"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <div
        ref={scrollContainerRef}
        className="flex gap-3.5 sm:gap-4 overflow-x-auto no-scrollbar pb-1.5"
      >
        {items.map(({ item, progress }) => (
          <motion.article
            key={item.id}
            whileHover={{ y: -3 }}
            transition={{ duration: 0.2 }}
            className="group relative w-[240px] sm:w-[290px] rounded-xl bg-[#14161D] border border-[#292C35] hover:border-[#FFC400]/60 p-2.5 flex flex-col gap-2 transition-colors shrink-0 cinema-card-shadow"
          >
            {/* Widescreen Backdrop Thumbnail — Clicking resumes playback directly */}
            <div className="relative aspect-[16/9] w-full rounded-lg overflow-hidden bg-[#0F1117]">
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
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

                {/* Center Play Button */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-11 h-11 rounded-full bg-[#FFC400] text-[#08090D] flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  </div>
                </div>

                {/* Bottom Overlay Progress Bar */}
                <div className="absolute bottom-2 left-2.5 right-2.5 space-y-1.5">
                  <div className="flex items-center justify-end text-[11px] font-medium text-white">
                    {progress.remainingLabel && (
                      <span className="px-2 py-0.5 rounded bg-black/70 text-[#A7A9B4] font-mono-tabular">
                        {progress.remainingLabel} left
                      </span>
                    )}
                  </div>

                  {/* Progress Track */}
                  <div className="w-full h-1 rounded-full bg-white/25 overflow-hidden">
                    <div
                      className="h-full bg-[#FFC400] rounded-full transition-all"
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
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/75 hover:bg-[#FFC400] text-[#A7A9B4] hover:text-[#08090D] border border-white/15 flex items-center justify-center transition-colors cursor-pointer z-10"
                  title="Remove from Continue Watching"
                  aria-label={`Remove ${item.title} from Continue Watching`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Bottom Title — Clicking opens details */}
            <div className="flex items-center justify-between gap-2 px-0.5">
              <button
                type="button"
                onClick={() => onSelectMedia(item, false, false)}
                className="min-w-0 text-left cursor-pointer"
              >
                <h3 className="text-xs sm:text-sm font-bold text-white group-hover:text-[#FFC400] transition-colors truncate">
                  {item.title}
                </h3>
              </button>
              <span className="text-[11px] text-[#747784] tabular-nums shrink-0">
                {item.contentType === 'series'
                  ? progress.seasonEpisodeLabel
                  : item.releaseYear}
              </span>
            </div>
          </motion.article>
        ))}
      </div>
    </section>
  );
};
