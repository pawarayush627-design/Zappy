import React from 'react';
import { Play } from 'lucide-react';
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
    <section aria-label="Continue Watching" className="space-y-4">
      {/* Header Row with "See All" Button matching reference image */}
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight font-display">
          Continue Watching
        </h2>
        <button
          type="button"
          onClick={onSeeAll}
          className="min-h-[36px] px-4 py-1.5 rounded-xl bg-[#221E2E] hover:bg-[#2D273C] border border-white/[0.08] text-xs font-semibold text-zinc-200 hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          See All
        </button>
      </div>

      {/* Horizontal Landscape Cards Row */}
      <div className="flex gap-4 sm:gap-5 overflow-x-auto no-scrollbar snap-x snap-mandatory pt-1 pb-2">
        {items.map(({ item, progress }) => (
          <article
            key={item.id}
            className="group relative w-[250px] sm:w-[275px] md:w-[295px] shrink-0 snap-start rounded-2xl overflow-hidden bg-[#191524] border border-white/[0.08] hover:border-[#B892FF]/60 transition-all duration-200 hover:-translate-y-1 cursor-pointer"
            onClick={() => onSelectMedia(item, true)}
          >
            <div className="relative aspect-[16/9.5] w-full overflow-hidden">
              <MediaArtwork
                src={item.backdropUrl}
                alt={item.title}
                item={item}
                aspectRatio="backdrop"
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              {/* Dark Bottom Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0D0A14] via-[#0D0A14]/45 to-transparent" />

              {/* Center Play Hover Indicator */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <div className="w-11 h-11 rounded-full bg-[#B892FF] text-[#110E17] flex items-center justify-center shadow-lg">
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                </div>
              </div>

              {/* Card Bottom Content: Title, S1 Ep-3 / Time Remaining, and Purple Progress Bar */}
              <div className="absolute inset-x-0 bottom-0 p-3.5 sm:p-4 space-y-2.5">
                <h3 className="text-sm sm:text-[15px] font-bold text-white truncate font-display drop-shadow">
                  {item.title}
                </h3>

                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="px-2.5 py-0.5 rounded-full bg-black/55 backdrop-blur-md border border-white/10 text-[11px] font-medium text-zinc-200 font-mono-tabular">
                    {progress.seasonEpisodeLabel}
                  </span>
                  <span className="text-[11px] text-zinc-300 font-mono-tabular">
                    {progress.remainingLabel}
                  </span>
                </div>

                {/* Purple Progress Bar */}
                <div className="w-full h-1 rounded-full bg-white/20 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#A855F7] to-[#B892FF]"
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
