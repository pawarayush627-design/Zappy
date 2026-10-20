import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MediaItem } from '../types/media';
import { MovieCard } from './MovieCard';

interface CarouselRowProps {
  title: string;
  subtitle?: string;
  items: MediaItem[];
  watchlistIds: string[];
  showRankNumbers?: boolean;
  onSelectMedia: (item: MediaItem, autoPlay?: boolean) => void;
  onToggleWatchlist: (item: MediaItem, e: React.MouseEvent) => void;
  onExploreAll?: () => void;
}

export const CarouselRow: React.FC<CarouselRowProps> = ({
  title,
  subtitle,
  items,
  watchlistIds,
  showRankNumbers = false,
  onSelectMedia,
  onToggleWatchlist,
  onExploreAll,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  if (items.length === 0) {
    return null;
  }

  const handleScroll = (direction: 'left' | 'right') => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const scrollAmount = Math.max(el.clientWidth * 0.78, 300);
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  return (
    <section className="space-y-4 overflow-hidden" aria-label={title}>
      {/* Section Header Bar with "See All" pill button matching reference image */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight font-display truncate">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs text-zinc-400 line-clamp-1 mt-0.5">{subtitle}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden md:flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleScroll('left')}
              className="min-h-[36px] min-w-[36px] rounded-xl border border-white/[0.08] bg-[#221E2E] text-zinc-300 hover:text-white hover:border-[#B892FF]/50 transition-colors flex items-center justify-center cursor-pointer"
              aria-label={`Scroll ${title} left`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleScroll('right')}
              className="min-h-[36px] min-w-[36px] rounded-xl border border-white/[0.08] bg-[#221E2E] text-zinc-300 hover:text-white hover:border-[#B892FF]/50 transition-colors flex items-center justify-center cursor-pointer"
              aria-label={`Scroll ${title} right`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {onExploreAll && (
            <button
              type="button"
              onClick={onExploreAll}
              className="min-h-[36px] px-4 py-1.5 rounded-xl bg-[#221E2E] hover:bg-[#2D273C] border border-white/[0.08] text-xs font-semibold text-zinc-200 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              See All
            </button>
          )}
        </div>
      </div>

      {/* Horizontally Swipeable Poster Shelf */}
      <div
        ref={scrollContainerRef}
        className="flex gap-4 sm:gap-5 overflow-x-auto no-scrollbar snap-x snap-mandatory pt-1.5 pb-3 px-1 -mx-1"
      >
        {items.map((item, idx) => (
          <div
            key={item.id}
            className="w-[155px] sm:w-[185px] md:w-[205px] lg:w-[215px] shrink-0 snap-start"
          >
            <MovieCard
              item={item}
              rankNumber={showRankNumbers ? idx + 1 : undefined}
              inWatchlist={watchlistIds.includes(item.id)}
              onSelect={onSelectMedia}
              onToggleWatchlist={onToggleWatchlist}
            />
          </div>
        ))}
      </div>
    </section>
  );
};
