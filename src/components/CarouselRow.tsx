import React, { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { MediaItem } from '../types/media';
import { MovieCard } from './MovieCard';

interface CarouselRowProps {
  title: string;
  subtitle?: string;
  items: MediaItem[];
  watchlistIds: string[];
  showRankNumbers?: boolean;
  isTop10Row?: boolean;
  cardVariant?: 'default' | 'release' | 'must_watch';
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
  isTop10Row = false,
  cardVariant = 'default',
  onSelectMedia,
  onToggleWatchlist,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [pageIdx, setPageIdx] = useState<number>(0);

  if (items.length === 0) {
    return null;
  }

  const handleScroll = (direction: 'left' | 'right') => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const scrollAmount = Math.max(el.clientWidth * 0.8, 320);
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
    setPageIdx((prev) =>
      direction === 'left' ? Math.max(0, prev - 1) : (prev + 1) % 4
    );
  };

  return (
    <section className="space-y-3 overflow-hidden" aria-label={title}>
      {/* Exact Figma Section Header + Right Pagination Control Pill */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2.5">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-white tracking-tight font-display">
            {title}
          </h2>
        </div>

        {/* ZappyFun Pagination Box: #14161D container with #292C35 border, Left/Right buttons & Gold Dash Indicators */}
        <div className="inline-flex items-center gap-2.5 p-1.5 rounded-xl bg-[#14161D] border border-[#292C35] self-start sm:self-auto shrink-0 shadow-md">
          <button
            type="button"
            onClick={() => handleScroll('left')}
            className="w-8 h-8 rounded-lg bg-[#252832] hover:bg-[#292C35] border border-[#292C35] text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label={`Scroll ${title} left`}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1">
            {[0, 1, 2, 3].map((dot) => (
              <span
                key={dot}
                className={`h-1 rounded-full transition-all duration-200 ${
                  pageIdx === dot ? 'w-5 bg-[#FFC400]' : 'w-3 bg-[#292C35]'
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => handleScroll('right')}
            className="w-8 h-8 rounded-lg bg-[#252832] hover:bg-[#292C35] border border-[#292C35] text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label={`Scroll ${title} right`}
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Horizontally Swipeable Poster Shelf */}
      <div
        ref={scrollContainerRef}
        className="flex gap-3 sm:gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-1"
      >
        {items.map((item, idx) => (
          <div
            key={item.id}
            className="w-[180px] sm:w-[210px] md:w-[235px] lg:w-[248px] shrink-0 snap-start"
          >
            <MovieCard
              item={item}
              variant={cardVariant}
              rankNumber={
                isTop10Row || showRankNumbers ? idx + 1 : undefined
              }
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
