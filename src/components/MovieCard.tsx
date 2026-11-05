import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Plus, Check } from 'lucide-react';
import { MediaItem } from '../types/media';
import { MediaArtwork } from './MediaArtwork';

interface MovieCardProps {
  item: MediaItem;
  inWatchlist: boolean;
  rankNumber?: number;
  index?: number;
  highlightQuery?: string;
  matchReason?: string;
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

function renderHighlightedText(text: string, query?: string): React.ReactNode {
  if (!query || !query.trim()) return text;
  const cleanQuery = query.trim();
  const escaped = cleanQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  if (parts.length <= 1) return text;
  return parts.map((part, i) =>
    part.toLowerCase() === cleanQuery.toLowerCase() ? (
      <mark
        key={i}
        className="bg-[#FFB800]/25 text-[#FFB800] rounded px-0.5 font-extrabold"
      >
        {part}
      </mark>
    ) : (
      part
    )
  );
}

export const MovieCard: React.FC<MovieCardProps> = ({
  item,
  inWatchlist,
  rankNumber,
  index = 0,
  highlightQuery,
  matchReason,
  onSelect,
  onToggleWatchlist,
}) => {
  const isSeries = item.contentType === 'series' || item.mediaType === 'tv';

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.18 } }}
      whileHover={{ y: -7, scale: 1.02 }}
      whileTap={{ scale: 0.985 }}
      transition={{
        type: 'spring',
        stiffness: 320,
        damping: 24,
        delay: Math.min(index * 0.02, 0.2),
      }}
      className="group relative flex flex-col select-none min-w-0 rounded-2xl bg-[#14161D] border border-[#292C35] hover:border-[#FF5A36]/80 p-2 sm:p-2.5 transition-all duration-300 cinema-card-shadow cinema-glow-hover will-change-transform"
    >
      {/* Poster Container with Glass Sheen Sweep */}
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-[#0F1117] zf-sheen">
        <button
          type="button"
          onClick={() => onSelect(item, false)}
          className="w-full h-full block text-left cursor-pointer focus:outline-none"
          aria-label={`View details for ${item.title}`}
        >
          <MediaArtwork
            src={item.posterUrl}
            alt={item.title}
            item={item}
            aspectRatio="poster"
            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.08] group-hover:brightness-105"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-[#08090D] via-transparent to-transparent opacity-55 group-hover:opacity-85 transition-opacity duration-300" />
        </button>

        {/* Direct Instant-Play Center Overlay Button on Hover with Spring Pop */}
        <div className="hidden sm:flex absolute inset-0 items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10">
          <motion.button
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.92 }}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(item, true);
            }}
            aria-label={`Play ${item.title} now`}
            title={`Play ${item.title}`}
            className="pointer-events-none group-hover:pointer-events-auto w-11 h-11 sm:w-12 sm:h-12 rounded-full zf-gradient-btn text-white flex items-center justify-center transform scale-75 group-hover:scale-100 transition-transform duration-300 font-bold cursor-pointer shadow-2xl"
          >
            <Play className="w-5 h-5 fill-current ml-0.5" />
          </motion.button>
        </div>

        {/* Top 10 Stylized Gold Rank Number */}
        {rankNumber !== undefined && (
          <div className="absolute bottom-1 left-2 z-10 pointer-events-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.95)] select-none">
            <span className="text-3xl sm:text-5xl font-black text-[#FFB800] tracking-tighter font-display italic tabular-nums">
              #{rankNumber}
            </span>
          </div>
        )}

        {/* Top Action Bar (Touch-Friendly Animated Watchlist Button) */}
        <div className="absolute top-2 right-2 flex items-center gap-1 z-20">
          <motion.button
            whileTap={{ scale: 0.85 }}
            type="button"
            onClick={(e) => onToggleWatchlist(item, e)}
            className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-colors duration-200 cursor-pointer backdrop-blur-md ${
              inWatchlist
                ? 'bg-[#FFB800] border-[#FFB800] text-[#08090D] shadow-md shadow-[#FFB800]/25'
                : 'bg-[#14161D]/85 border-white/15 text-white hover:bg-[#252832] hover:border-[#FFB800]/70'
            }`}
            aria-label={
              inWatchlist
                ? `Remove ${item.title} from Watchlist`
                : `Add ${item.title} to Watchlist`
            }
            title={inWatchlist ? 'In Watchlist' : 'Add to Watchlist'}
          >
            <AnimatePresence mode="wait" initial={false}>
              {inWatchlist ? (
                <motion.span
                  key="saved"
                  initial={{ scale: 0.4, rotate: -45, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  exit={{ scale: 0.4, rotate: 45, opacity: 0 }}
                  transition={{ duration: 0.16 }}
                >
                  <Check className="w-4 h-4 stroke-[2.5]" />
                </motion.span>
              ) : (
                <motion.span
                  key="add"
                  initial={{ scale: 0.4, rotate: 45, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  exit={{ scale: 0.4, rotate: -45, opacity: 0 }}
                  transition={{ duration: 0.16 }}
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </div>

      {/* Title */}
      <button
        type="button"
        onClick={() => onSelect(item, false)}
        className="mt-2.5 text-left block w-full min-w-0 group-hover:text-[#FFB800] transition-colors cursor-pointer"
      >
        <h3 className="text-xs sm:text-sm font-bold text-white group-hover:text-[#FFB800] truncate font-display transition-colors">
          {renderHighlightedText(item.title, highlightQuery)}
        </h3>
      </button>

      {/* Clean Zero-Pill Typography Metadata (Release year · Duration / Genre) */}
      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[#A7A9B4] min-w-0 truncate tabular-nums">
        <span>{item.releaseYear || 2024}</span>
        <span aria-hidden="true" className="text-[#747784]">·</span>
        {isSeries ? (
          <span className="text-[#FFB800] font-semibold shrink-0">
            {item.seasonsCount || 1}S
          </span>
        ) : (
          <span className="shrink-0">{formatDurationFigma(item.durationMinutes)}</span>
        )}
        {item.genres.length > 0 && (
          <>
            <span aria-hidden="true" className="text-[#747784]">·</span>
            <span className="truncate">
              {renderHighlightedText(item.genres[0], highlightQuery)}
            </span>
          </>
        )}
      </div>

      {/* Search Match Attribution (only shown when searching and matched on Cast / Director / Tagline / Year) */}
      {matchReason && (
        <p className="mt-1 text-[10px] font-semibold text-[#FFB800]/90 truncate">
          {matchReason}
        </p>
      )}
    </motion.article>
  );
};
