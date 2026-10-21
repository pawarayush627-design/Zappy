import React from 'react';
import { Play, ChevronRight } from 'lucide-react';
import { MediaItem } from '../types/media';
import { MediaArtwork } from './MediaArtwork';

export interface WatchProgressEntry {
  mediaId: string;
  seasonEpisodeLabel: string;
  remainingLabel: string;
  progressPercent: number;
}

interface ContinueWatchingRowProps {
  items: { item: MediaItem; progress: WatchProgressEntry }[];
  onSelectMedia: (item: MediaItem, autoPlay?: boolean) => void;
  onSeeAll: () => void;
}

export const ContinueWatchingRow: React.FC<ContinueWatchingRowProps> = ({
  items,
  onSelectMedia,
  onSeeAll,
}) => {
  if (items.length === 0) return null;

  return (
    <section aria-label="Continue Watching" className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-base sm:text-xl font-bold text-white tracking-tight font-display">
          Continue Watching
        </h2>
        <button
          type="button"
          onClick={onSeeAll}
          className="min-h-[34px] px-3 py-1 rounded-lg text-xs font-bold text-[#38BDF8] hover:text-white hover:bg-white/[0.06] transition-colors flex items-center gap-0.5 cursor-pointer whitespace-nowrap shrink-0"
        >
          <span>View All</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex gap-3.5 sm:gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory pt-1 pb-2">
        {items.map(({ item, progress }) => (
          <article
            key={item.id}
            className="group relative w-[250px] sm:w-[275px] md:w-[295px] shrink-0 snap-start rounded-xl overflow-hidden bg-[#16181F] border border-white/[0.08] hover:border-[#38BDF8]/60 transition-all duration-200 hover:-translate-y-1 cursor-pointer"
            onClick={() => onSelectMedia(item, true)}
          >
            <div className="relative aspect-[16/9.2] w-full overflow-hidden">
              <MediaArtwork
                src={item.backdropUrl}
                alt={item.title}
                item={item}
                aspectRatio="backdrop"
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0F1014] via-[#0F1014]/45 to-transparent" />

              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <div className="w-11 h-11 rounded-full jio-gradient-btn text-white flex items-center justify-center shadow-lg">
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                </div>
              </div>

              <div className="absolute inset-x-0 bottom-0 p-3.5 space-y-2">
                <h3 className="text-sm font-bold text-white truncate font-display drop-shadow">
                  {item.title}
                </h3>

                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="px-2 py-0.5 rounded bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-bold text-zinc-200">
                    {progress.seasonEpisodeLabel}
                  </span>
                  <span className="text-[11px] text-zinc-300 font-medium">
                    {progress.remainingLabel} left
                  </span>
                </div>

                {/* JioHotstar Blue-Pink Progress Bar */}
                <div className="w-full h-1 rounded-full bg-white/20 overflow-hidden">
                  <div
                    className="h-full rounded-full jio-gradient-btn"
                    style={{ width: `${progress.progressPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};
