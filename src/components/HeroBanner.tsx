import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MediaItem } from '../types/media';
import { MediaArtwork } from './MediaArtwork';

interface HeroBannerProps {
  featuredItems: MediaItem[];
  activeHeroIndex: number;
  onSelectHeroIndex: (index: number) => void;
  watchlistIds: string[];
  onPlayMedia: (item: MediaItem) => void;
  onOpenDetails: (item: MediaItem) => void;
  onToggleWatchlist: (item: MediaItem, e: React.MouseEvent) => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({
  featuredItems,
  activeHeroIndex,
  onSelectHeroIndex,
  onOpenDetails,
}) => {
  const heroPool = featuredItems.slice(0, 8);
  const safeIndex =
    heroPool.length > 0 ? activeHeroIndex % heroPool.length : 0;
  const hero = heroPool[safeIndex];

  const [swipeDirection, setSwipeDirection] = useState<number>(1);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const touchStartXRef = useRef<number | null>(null);
  const touchCurrentXRef = useRef<number | null>(null);
  const pointerStartXRef = useRef<number | null>(null);
  const didSwipeRef = useRef<boolean>(false);

  // Preload all hero spotlight backdrop & poster images into browser cache so slide transitions are instantaneous
  useEffect(() => {
    if (heroPool.length === 0 || typeof window === 'undefined') return;
    heroPool.forEach((item) => {
      const urls = [item.backdropUrl, item.posterUrl].filter(Boolean);
      urls.forEach((raw) => {
        if (!raw || raw.startsWith('data:')) return;
        const img = new window.Image();
        img.referrerPolicy = 'no-referrer';
        img.src = raw;
      });
    });
  }, [heroPool]);

  // Automatic 7-second rotation through the active hero spotlight items (pauses on hover)
  useEffect(() => {
    if (heroPool.length <= 1 || isPaused) return;
    const interval = window.setInterval(() => {
      setSwipeDirection(1);
      onSelectHeroIndex((safeIndex + 1) % heroPool.length);
    }, 7000);
    return () => window.clearInterval(interval);
  }, [heroPool.length, safeIndex, isPaused, onSelectHeroIndex]);

  if (!hero) return null;

  const goToPrevious = () => {
    if (heroPool.length <= 1) return;
    setSwipeDirection(-1);
    onSelectHeroIndex((safeIndex - 1 + heroPool.length) % heroPool.length);
  };

  const goToNext = () => {
    if (heroPool.length <= 1) return;
    setSwipeDirection(1);
    onSelectHeroIndex((safeIndex + 1) % heroPool.length);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLElement>) => {
    if (e.touches.length !== 1) return;
    touchStartXRef.current = e.touches[0].clientX;
    touchCurrentXRef.current = e.touches[0].clientX;
    didSwipeRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLElement>) => {
    if (touchStartXRef.current === null || e.touches.length !== 1) return;
    touchCurrentXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (
      touchStartXRef.current !== null &&
      touchCurrentXRef.current !== null
    ) {
      const deltaX = touchCurrentXRef.current - touchStartXRef.current;
      if (Math.abs(deltaX) >= 40) {
        didSwipeRef.current = true;
        if (deltaX < 0) {
          goToNext();
        } else {
          goToPrevious();
        }
      }
    }
    touchStartXRef.current = null;
    touchCurrentXRef.current = null;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType === 'touch') return;
    pointerStartXRef.current = e.clientX;
    didSwipeRef.current = false;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType === 'touch' || pointerStartXRef.current === null) return;
    const deltaX = e.clientX - pointerStartXRef.current;
    if (Math.abs(deltaX) >= 50) {
      didSwipeRef.current = true;
      if (deltaX < 0) {
        goToNext();
      } else {
        goToPrevious();
      }
    }
    pointerStartXRef.current = null;
  };

  return (
    <section
      aria-label="Featured Spotlight"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onClick={() => {
        if (!didSwipeRef.current) {
          onOpenDetails(hero);
        }
      }}
      className="group/hero relative w-full aspect-[16/9] sm:aspect-[21/9] max-h-[480px] rounded-xl overflow-hidden bg-[#08090D] border border-[#292C35]/80 flex flex-col justify-end select-none touch-pan-y cursor-pointer cinema-card-shadow"
    >
      {/* Pure Widescreen Rectangular Artwork as Dominant Subject */}
      <AnimatePresence initial={false} custom={swipeDirection}>
        <motion.div
          key={hero.id}
          custom={swipeDirection}
          initial={{ opacity: 0, scale: 1.015 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0 will-change-transform"
        >
          <MediaArtwork
            src={hero.backdropUrl || hero.posterUrl}
            alt={hero.title}
            item={hero}
            aspectRatio="backdrop"
            priority
            className="w-full h-full object-cover object-center transition-transform duration-[7000ms] ease-out group-hover/hero:scale-[1.02]"
          />
          {/* Subtle bottom-only contrast scrim so the artwork remains bright and unobstructed */}
          <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-[#050505]/90 via-[#050505]/35 to-transparent pointer-events-none" />
        </motion.div>
      </AnimatePresence>

      {/* Minimal Bottom-Left Title & Unboxed Metadata (Zero Button Clutter) */}
      <div className="relative z-10 w-full px-4 sm:px-7 pb-3.5 sm:pb-5 pt-8 pointer-events-none">
        <div className="max-w-2xl space-y-0.5 sm:space-y-1">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] sm:text-xs font-semibold text-[#FFB800] drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
            <span>{hero.releaseYear}</span>
            {hero.genres?.[0] && (
              <>
                <span className="text-white/50">·</span>
                <span className="text-white/95">{hero.genres.slice(0, 2).join(' / ')}</span>
              </>
            )}
            {hero.durationMinutes > 0 && (
              <>
                <span className="text-white/50">·</span>
                <span className="text-white/85">{hero.durationMinutes}m</span>
              </>
            )}
          </div>
          <h1
            className="text-lg sm:text-3xl lg:text-4xl font-black text-white font-display tracking-tight leading-tight drop-shadow-[0_4px_20px_rgba(0,0,0,0.95)] break-words"
            style={{ textWrap: 'balance' }}
          >
            {hero.title}
          </h1>
        </div>
      </div>
    </section>
  );
};
