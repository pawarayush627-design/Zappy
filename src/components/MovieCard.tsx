import React from 'react';
import { motion } from 'motion/react';
import { Play, Plus, Check, Clock, Eye, Star } from 'lucide-react';
import { MediaItem } from '../types/media';
import { MediaArtwork } from './MediaArtwork';

interface MovieCardProps {
  item: MediaItem;
  inWatchlist: boolean;
  rankNumber?: number;
  variant?: 'default' | 'release' | 'must_watch';
  onSelect: (item: MediaItem, autoPlay?: boolean) => void;
  onToggleWatchlist: (item: MediaItem, e: React.MouseEvent) => void;
}

function formatDurationFigma(minutes: number): string {
  const hrs = Math.floor((minutes || 120) / 60);
  const mins = (minutes || 120) % 60;
  if (hrs <= 0) return `${mins}min`;
  return mins > 0 ? `${hrs}h ${mins}min` : `${hrs}h`;
}

export const MovieCard: React.FC<MovieCardProps> = ({
  item,
  inWatchlist,
  rankNumber,
  variant = 'default',
  onSelect,
  onToggleWatchlist,
}) => {
  const isSeries = item.contentType === 'series' || item.mediaType === 'tv';
  const fiveStarScore = Math.min(5, Math.max(3.5, (item.popularScore || 90) / 20));
  const viewsK = ((item.popularScore || 88) * 0.25).toFixed(1);

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="group relative flex flex-col select-none min-w-0 rounded-xl bg-[#1A1A1A] border border-[#262626] hover:border-[#E50000]/60 p-3.5 sm:p-4 transition-all duration-200 cinema-card-shadow"
    >
      {/* Poster Container inside #1A1A1A Card Frame (Exact Figma Card Layout) */}
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-[#141414]">
        <button
          type="button"
          onClick={() => onSelect(item, true)}
          className="w-full h-full block text-left focus:outline-none cursor-pointer"
          aria-label={`Watch ${item.title}`}
        >
          <MediaArtwork
            src={item.posterUrl}
            alt={item.title}
            item={item}
            aspectRatio="poster"
            className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-[#141414]/90 via-transparent to-transparent opacity-60 group-hover:opacity-90 transition-opacity duration-200" />

          {/* Hover Play Button Overlay */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <div className="w-12 h-12 rounded-full bg-[#E50000] text-white flex items-center justify-center shadow-xl transform scale-90 group-hover:scale-100 transition-transform duration-200">
              <Play className="w-5 h-5 fill-current ml-0.5" />
            </div>
          </div>
        </button>

        {/* Top Left Rank / Top 10 Badge or Watchlist Button */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-start justify-between gap-1 z-10 pointer-events-none">
          {rankNumber !== undefined ? (
            <span className="px-2 py-1 rounded-md bg-[#E50000] text-white text-[10px] font-bold tracking-wide">
              Top #{rankNumber}
            </span>
          ) : (
            <span />
          )}

          <button
            type="button"
            onClick={(e) => onToggleWatchlist(item, e)}
            className={`pointer-events-auto w-8 h-8 rounded-lg flex items-center justify-center border transition-colors cursor-pointer ${
              inWatchlist
                ? 'bg-[#E50000] border-[#E50000] text-white'
                : 'bg-[#0F0F0F]/85 border-[#262626] text-white hover:border-[#E50000]'
            }`}
            aria-label={
              inWatchlist
                ? `Remove ${item.title} from Watchlist`
                : `Add ${item.title} to Watchlist`
            }
            title={inWatchlist ? 'In Watchlist' : 'Add to Watchlist'}
          >
            {inWatchlist ? (
              <Check className="w-4 h-4" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Title */}
      <button
        type="button"
        onClick={() => onSelect(item, false)}
        className="mt-3 text-left block w-full min-w-0 group-hover:text-[#E50000] transition-colors cursor-pointer"
      >
        <h3 className="text-xs sm:text-sm font-semibold text-white truncate font-display">
          {item.title}
        </h3>
      </button>

      {/* Bottom Figma Pill Metadata Row (#141414 Pills with #262626 Border) */}
      <div className="mt-2.5 flex items-center justify-between gap-1.5 text-[11px] text-[#999999] min-w-0">
        {variant === 'release' ? (
          <div className="w-full py-1.5 px-2.5 rounded-full bg-[#141414] border border-[#262626] text-center text-[11px] text-[#999999] truncate">
            Released in <span className="text-[#BFBFBF] font-medium">{item.releaseYear}</span>
          </div>
        ) : variant === 'must_watch' ? (
          <>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#141414] border border-[#262626] text-[11px] text-[#999999] shrink-0">
              <Clock className="w-3 h-3 text-[#999999]" />
              <span>{formatDurationFigma(item.durationMinutes)}</span>
            </span>

            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#141414] border border-[#262626] text-[11px] text-[#999999] truncate">
              <span className="flex items-center gap-0.5 text-[#E50000]">
                {[1, 2, 3, 4, 5].map((starIdx) => (
                  <Star
                    key={starIdx}
                    className={`w-2.5 h-2.5 ${
                      starIdx <= Math.round(fiveStarScore)
                        ? 'fill-current text-[#E50000]'
                        : 'text-[#4D4D4D]'
                    }`}
                  />
                ))}
              </span>
              <span className="text-[10px] text-[#999999]">{viewsK}K</span>
            </span>
          </>
        ) : (
          <>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#141414] border border-[#262626] text-[11px] text-[#999999] shrink-0">
              <Clock className="w-3 h-3 text-[#999999]" />
              <span>{formatDurationFigma(item.durationMinutes)}</span>
            </span>

            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#141414] border border-[#262626] text-[11px] text-[#999999] truncate">
              {isSeries ? (
                <span>{item.seasonsCount || 1} Season</span>
              ) : (
                <>
                  <Eye className="w-3 h-3 text-[#999999]" />
                  <span>{viewsK}K</span>
                </>
              )}
            </span>
          </>
        )}
      </div>
    </motion.article>
  );
};
