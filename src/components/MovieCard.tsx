import React from 'react';
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
  if (!query || !query.trim() || !text) return text;
  const cleanQuery = query.trim();
  const stopWords = new Set(['movie', 'movies', 'film', 'films', 'watch', 'online', 'full', 'free', 'the', 'of', 'in', 'and']);
  const rawTokens = cleanQuery
    .split(/\s+/)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .filter((t) => t.length >= 2 && !stopWords.has(t.toLowerCase()));
  const fullEscaped = cleanQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = Array.from(new Set([fullEscaped, ...rawTokens])).sort(
    (a, b) => b.length - a.length
  );
  if (patterns.length === 0) return text;
  const regex = new RegExp(`(${patterns.join('|')})`, 'gi');
  const parts = text.split(regex);
  if (parts.length <= 1) return text;
  const lowerPatterns = patterns.map((p) => p.replace(/\\(.)/g, '$1').toLowerCase());
  return parts.map((part, i) =>
    lowerPatterns.includes(part.toLowerCase()) ? (
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

const MovieCardComponent: React.FC<MovieCardProps> = ({
  item,
  inWatchlist,
  rankNumber,
  highlightQuery,
  matchReason,
  onSelect,
  onToggleWatchlist,
}) => {
  return (
    <article
      style={{ contentVisibility: 'auto', containIntrinsicSize: '220px 360px' }}
      className="group relative flex flex-col select-none min-w-0 rounded-2xl bg-[#14161D] border border-[#292C35] hover:border-[#FF5A36]/80 hover:-translate-y-1 active:scale-[0.99] p-2 sm:p-2.5 transition-transform duration-150 cinema-card-shadow"
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
            className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-[#08090D] via-transparent to-transparent opacity-55 group-hover:opacity-85 transition-opacity duration-200" />
        </button>

        {/* Direct Instant-Play Center Overlay Button on Hover */}
        <div className="hidden sm:flex absolute inset-0 items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(item, true);
            }}
            aria-label={`Play ${item.title} now`}
            title={`Play ${item.title}`}
            className="pointer-events-none group-hover:pointer-events-auto w-11 h-11 sm:w-12 sm:h-12 rounded-full zf-gradient-btn text-white flex items-center justify-center transform scale-90 group-hover:scale-100 hover:scale-110 active:scale-95 transition-transform duration-200 font-bold cursor-pointer shadow-2xl"
          >
            <Play className="w-5 h-5 fill-current ml-0.5" />
          </button>
        </div>

        {/* Top 10 Stylized Gold Rank Number */}
        {rankNumber !== undefined && (
          <div className="absolute bottom-1 left-2 z-10 pointer-events-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.95)] select-none">
            <span className="text-3xl sm:text-5xl font-black text-[#FFB800] tracking-tighter font-display italic tabular-nums">
              #{rankNumber}
            </span>
          </div>
        )}

        {/* Top Action Bar (Touch-Friendly Watchlist Button) */}
        <div className="absolute top-2 right-2 flex items-center gap-1 z-20">
          <button
            type="button"
            onClick={(e) => onToggleWatchlist(item, e)}
            className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-all duration-150 active:scale-90 cursor-pointer ${
              inWatchlist
                ? 'bg-[#FFB800] border-[#FFB800] text-[#08090D] shadow-md shadow-[#FFB800]/25'
                : 'bg-[#14161D]/90 border-white/15 text-white hover:bg-[#252832] hover:border-[#FFB800]/70'
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
        <span className="shrink-0">{formatDurationFigma(item.durationMinutes)}</span>
        {item.genres.length > 0 && (
          <>
            <span aria-hidden="true" className="text-[#747784]">·</span>
            <span className="truncate">
              {renderHighlightedText(item.genres[0], highlightQuery)}
            </span>
          </>
        )}
      </div>

      {/* Search Match Attribution */}
      {matchReason && (
        <p className="mt-1 text-[10px] font-semibold text-[#FFB800]/90 truncate">
          {matchReason}
        </p>
      )}
    </article>
  );
};

export const MovieCard = React.memo(
  MovieCardComponent,
  (prev, next) =>
    prev.item.id === next.item.id &&
    prev.item.title === next.item.title &&
    prev.item.posterUrl === next.item.posterUrl &&
    prev.item.releaseYear === next.item.releaseYear &&
    prev.item.durationMinutes === next.item.durationMinutes &&
    prev.inWatchlist === next.inWatchlist &&
    prev.rankNumber === next.rankNumber &&
    prev.highlightQuery === next.highlightQuery &&
    prev.matchReason === next.matchReason
);
