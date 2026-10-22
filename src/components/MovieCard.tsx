import React from 'react';
import { motion } from 'motion/react';
import { Play, Plus, Check } from 'lucide-react';
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
  if (hrs <= 0) return `${mins}m`;
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

export const MovieCard: React.FC<MovieCardProps> = ({
  item,
  inWatchlist,
  rankNumber,
  onSelect,
  onToggleWatchlist,
}) => {
  const isSeries = item.contentType === 'series' || item.mediaType === 'tv';

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="group relative flex flex-col select-none min-w-0 rounded-2xl bg-[#14161D] border border-[#292C35] hover:border-[#FFC400]/70 p-2 sm:p-2.5 transition-all duration-200 shadow-lg hover:shadow-2xl hover:shadow-[#FFC400]/5"
    >
      {/* Poster Container */}
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-[#0F1117]">
        <button
          type="button"
          onClick={() => onSelect(item, false)}
          className="w-full h-full block text-left cursor-pointer"
          aria-label={`View details for ${item.title}`}
        >
          <MediaArtwork
            src={item.posterUrl}
            alt={item.title}
            item={item}
            aspectRatio="poster"
            className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-[#08090D] via-transparent to-transparent opacity-50 group-hover:opacity-80 transition-opacity duration-200" />

          {/* Hover Play Button Overlay */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <div className="w-11 h-11 rounded-full bg-[#FFC400] text-[#08090D] flex items-center justify-center shadow-xl shadow-[#FFC400]/25 transform scale-90 group-hover:scale-100 transition-transform duration-200 font-bold">
              <Play className="w-5 h-5 fill-current ml-0.5" />
            </div>
          </div>
        </button>

        {/* Top 10 Stylized Gold Rank Number */}
        {rankNumber !== undefined && (
          <div className="absolute bottom-1 left-2 pointer-events-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] select-none">
            <span className="text-4xl sm:text-5xl font-black text-[#FFC400] tracking-tighter font-display italic">
              #{rankNumber}
            </span>
          </div>
        )}

        {/* Top Action Bar (Touch-Friendly Watchlist Button) */}
        <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
          <button
            type="button"
            onClick={(e) => onToggleWatchlist(item, e)}
            className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-all cursor-pointer backdrop-blur-md ${
              inWatchlist
                ? 'bg-[#FFC400] border-[#FFC400] text-[#08090D]'
                : 'bg-[#14161D]/85 border-[#292C35] text-white hover:bg-[#252832] hover:border-[#FFC400]/60'
            }`}
            aria-label={
              inWatchlist
                ? `Remove ${item.title} from Watchlist`
                : `Add ${item.title} to Watchlist`
            }
            title={inWatchlist ? 'In Watchlist' : 'Add to Watchlist'}
          >
            {inWatchlist ? (
              <Check className="w-4 h-4 stroke-[2.5]" />
            ) : (
              <Plus className="w-4 h-4 stroke-[2.5]" />
            )}
          </button>
        </div>
      </div>

      {/* Title */}
      <button
        type="button"
        onClick={() => onSelect(item, false)}
        className="mt-2.5 text-left block w-full min-w-0 group-hover:text-[#FFD54A] transition-colors cursor-pointer"
      >
        <h3 className="text-xs sm:text-sm font-semibold text-white truncate font-display">
          {item.title}
        </h3>
      </button>

      {/* Clean Zero-Pill Typography Metadata (Release year · Maturity · Duration / Genre) */}
      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[#A7A9B4] min-w-0 truncate">
        <span>{item.releaseYear || 2024}</span>
        <span aria-hidden="true" className="text-[#747784]">·</span>
        <span>{item.maturityRating || 'PG-13'}</span>
        <span aria-hidden="true" className="text-[#747784]">·</span>
        {isSeries ? (
          <span className="text-[#FFC400] font-medium">{item.seasonsCount || 1} Season{(item.seasonsCount || 1) > 1 ? 's' : ''}</span>
        ) : (
          <span>{formatDurationFigma(item.durationMinutes)}</span>
        )}
        {item.genres.length > 0 && (
          <>
            <span aria-hidden="true" className="text-[#747784]">·</span>
            <span className="truncate">{item.genres[0]}</span>
          </>
        )}
      </div>
    </motion.article>
  );
};
