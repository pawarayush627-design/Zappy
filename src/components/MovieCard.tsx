import React from 'react';
import { Play, Plus, Check, Film, Star } from 'lucide-react';
import { MediaItem } from '../types/media';
import { MediaArtwork } from './MediaArtwork';

interface MovieCardProps {
  item: MediaItem;
  inWatchlist: boolean;
  rankNumber?: number;
  onSelect: (item: MediaItem, autoPlay?: boolean) => void;
  onToggleWatchlist: (item: MediaItem, e: React.MouseEvent) => void;
}

export const MovieCard: React.FC<MovieCardProps> = ({
  item,
  inWatchlist,
  rankNumber,
  onSelect,
  onToggleWatchlist,
}) => {
  const isPlayable = item.availabilityStatus === 'playable_demo';
  const ratingScore = ((item.popularScore || 86) / 10).toFixed(1);

  return (
    <article className="group relative flex flex-col select-none min-w-0">
      {/* Poster Container */}
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-[#181424] ring-1 ring-white/10 cinema-card-shadow transition-all duration-200 ease-out group-hover:-translate-y-1 group-hover:ring-[#B892FF]">
        <button
          type="button"
          onClick={() => onSelect(item, isPlayable)}
          className="w-full h-full block text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B892FF] cursor-pointer"
          aria-label={`Watch or view details for ${item.title}`}
        >
          <MediaArtwork
            src={item.posterUrl}
            alt={`${item.title} poster artwork`}
            item={item}
            aspectRatio="poster"
            className="w-full h-full transition-transform duration-300 ease-out group-hover:scale-105"
          />

          {/* Dark Scrim + Hover Center Play Circle */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0D0A14] via-[#0D0A14]/25 to-transparent opacity-75 group-hover:opacity-90 transition-opacity duration-200" />

          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#B892FF] text-[#110E17] flex items-center justify-center shadow-lg shadow-black/80 transform scale-90 group-hover:scale-100 transition-transform duration-200">
              {isPlayable ? (
                <Play className="w-5 h-5 fill-current ml-0.5" />
              ) : (
                <Film className="w-5 h-5" />
              )}
            </div>
          </div>
        </button>

        {/* Top Row Overlay */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-start justify-between gap-1 pointer-events-none z-10">
          {rankNumber !== undefined ? (
            <span className="font-display font-bold text-xl sm:text-2xl tracking-tighter text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)] font-mono-tabular">
              {String(rankNumber).padStart(2, '0')}
            </span>
          ) : (
            <span className="text-[10px] sm:text-[11px] font-bold tracking-wider uppercase text-zinc-200 drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)] font-mono-tabular truncate">
              {item.contentType === 'series' ? `EPS ${item.episodesCount || 8}` : item.maturityRating}
            </span>
          )}

          <span
            className={`text-[10px] sm:text-[11px] font-bold tracking-wider uppercase drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)] font-mono-tabular shrink-0 ${
              isPlayable ? 'text-[#B892FF]' : 'text-zinc-300'
            }`}
          >
            {isPlayable ? 'HD · FREE' : 'PREVIEW'}
          </span>
        </div>

        {/* Bottom Overlay Bar: Watch + Favourites Toggle */}
        <div className="absolute bottom-2 left-2 right-2 sm:bottom-2.5 sm:left-2.5 sm:right-2.5 flex items-center justify-between gap-1.5 z-10">
          <button
            type="button"
            onClick={() => onSelect(item, isPlayable)}
            className={`min-h-[38px] sm:min-h-[40px] flex-1 min-w-0 px-2 sm:px-2.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1 transition-colors whitespace-nowrap cursor-pointer ${
              isPlayable
                ? 'bg-[#B892FF] text-[#110E17] hover:bg-[#C9ABFF]'
                : 'bg-[#191524]/90 text-zinc-200 border border-white/15 hover:bg-[#241E33]'
            }`}
            aria-label={isPlayable ? `Play ${item.title}` : `Open details for ${item.title}`}
          >
            {isPlayable ? (
              <>
                <Play className="w-3 h-3 fill-current shrink-0" />
                <span className="truncate">Watch Now</span>
              </>
            ) : (
              <>
                <Film className="w-3 h-3 shrink-0 text-zinc-400" />
                <span className="truncate">Details</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={(e) => onToggleWatchlist(item, e)}
            className={`min-h-[38px] min-w-[38px] sm:min-h-[40px] sm:min-w-[40px] rounded-xl flex items-center justify-center border backdrop-blur-md transition-colors cursor-pointer shrink-0 ${
              inWatchlist
                ? 'bg-[#B892FF]/25 border-[#B892FF] text-[#B892FF]'
                : 'bg-[#191524]/85 border-white/15 text-zinc-200 hover:border-white/35 hover:text-white'
            }`}
            aria-label={
              inWatchlist
                ? `Remove ${item.title} from Favourites`
                : `Add ${item.title} to Favourites`
            }
            title={inWatchlist ? 'In Favourites' : 'Add to Favourites'}
          >
            {inWatchlist ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Card Typography & Unboxed Inline Metadata */}
      <div className="mt-2.5 space-y-1 px-0.5 min-w-0">
        <button
          type="button"
          onClick={() => onSelect(item, false)}
          className="text-left block w-full min-w-0 group-hover:text-[#B892FF] transition-colors cursor-pointer"
        >
          <h3 className="text-xs sm:text-sm font-bold text-[#F5F5F7] truncate font-display tracking-tight">
            {item.title}
          </h3>
        </button>

        <div className="flex items-center justify-between gap-1 text-[11px] sm:text-xs text-zinc-400 font-mono-tabular min-w-0">
          <div className="flex items-center gap-1 sm:gap-1.5 truncate min-w-0">
            <span>{item.releaseYear}</span>
            <span aria-hidden="true" className="text-zinc-600">·</span>
            <span className="font-sans text-zinc-300 truncate">{item.genres[0]}</span>
            <span aria-hidden="true" className="text-zinc-600">·</span>
            <span>
              {item.contentType === 'series'
                ? `S${item.seasonsCount || 1}`
                : `${item.durationMinutes}m`}
            </span>
          </div>

          <span className="flex items-center gap-0.5 text-[#B892FF] shrink-0">
            <Star className="w-3 h-3 fill-current" />
            <span>{ratingScore}</span>
          </span>
        </div>
      </div>
    </article>
  );
};
