import React, { useRef, useState, useEffect, useCallback } from 'react';
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
  const [canScrollLeft, setCanScrollLeft] = useState<boolean>(false);
  const [canScrollRight, setCanScrollRight] = useState<boolean>(true);

  const syncScrollMetrics = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
    const current = Math.max(0, el.scrollLeft);
    setCanScrollLeft(current > 8);
    setCanScrollRight(maxScroll - current > 8);
    if (maxScroll <= 8) {
      setPageIdx(0);
    } else {
      const ratio = Math.min(1, Math.max(0, current / maxScroll));
      setPageIdx(Math.min(3, Math.round(ratio * 3)));
    }
  }, []);

  useEffect(() => {
    syncScrollMetrics();
    window.addEventListener('resize', syncScrollMetrics);
    return () => window.removeEventListener('resize', syncScrollMetrics);
  }, [items.length, syncScrollMetrics]);

  if (items.length === 0) {
    return null;
  }

  const handleScroll = (direction: 'left' | 'right') => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const scrollAmount = Math.max(el.clientWidth * 0.82, 320);
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  return (
    <section className="space-y-3.5 overflow-hidden" aria-label={title}>
      {/* Section Header + Right Pagination Control Pill */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2.5">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl lg:text-2xl font-extrabold text-white tracking-tight font-display">
            {title}
          </h2>
        </div>

        {/* ZappyFun Pagination Box: #14161D container with #292C35 border, Left/Right buttons & Gold Dash Indicators */}
        <div className="inline-flex items-center gap-2.5 p-1.5 rounded-xl bg-[#14161D] border border-[#292C35] self-start sm:self-auto shrink-0 shadow-md">
          <button
            type="button"
            onClick={() => handleScroll('left')}
            disabled={!canScrollLeft}
            className="w-8 h-8 rounded-lg bg-[#252832] hover:bg-[#292C35] disabled:opacity-30 border border-[#292C35] hover:border-[#FFB800]/60 text-white flex items-center justify-center transition-all duration-200 cursor-pointer disabled:cursor-default active:scale-90 hover:scale-105"
            aria-label={`Scroll ${title} left`}
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          </button>

          <div className="flex items-center gap-1">
            {[0, 1, 2, 3].map((dot) => (
              <span
                key={dot}
                className={`h-1 rounded-full transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  pageIdx === dot
                    ? 'w-6 bg-gradient-to-r from-[#FFB800] via-[#FF5A36] to-[#FF168B] shadow-sm shadow-[#FFB800]/40'
                    : 'w-2.5 bg-[#292C35]'
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => handleScroll('right')}
            disabled={!canScrollRight}
            className="w-8 h-8 rounded-lg bg-[#252832] hover:bg-[#292C35] disabled:opacity-30 border border-[#292C35] hover:border-[#FFB800]/60 text-white flex items-center justify-center transition-all duration-200 cursor-pointer disabled:cursor-default active:scale-90 hover:scale-105"
            aria-label={`Scroll ${title} right`}
          >
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>

      {/* Horizontally Swipeable Poster Shelf */}
      <div
        ref={scrollContainerRef}
        onScroll={syncScrollMetrics}
        className="flex gap-3 sm:gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-1.5 pt-0.5"
      >
        {items.map((item, idx) => (
          <div
            key={item.id}
            className="w-[176px] sm:w-[210px] md:w-[235px] lg:w-[248px] shrink-0 snap-start"
          >
            <MovieCard
              item={item}
              index={idx}
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
