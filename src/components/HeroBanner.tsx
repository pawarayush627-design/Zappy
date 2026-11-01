import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play } from 'lucide-react';
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
  onPlayMedia,
  onOpenDetails,
}) => {
  const heroPool = featuredItems.slice(0, 8);
  const safeIndex =
    heroPool.length > 0 ? activeHeroIndex % heroPool.length : 0;
  const hero = heroPool[safeIndex];

  const [swipeDirection, setSwipeDirection] = useState<number>(1);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const touchCurrentXRef = useRef<number | null>(null);
  const pointerStartXRef = useRef<number | null>(null);
  const didSwipeRef = useRef<boolean>(false);

  // Automatic 7-second rotation through the active hero spotlight items
  useEffect(() => {
    if (heroPool.length <= 1) return;
    const interval = window.setInterval(() => {
      setSwipeDirection(1);
      onSelectHeroIndex((safeIndex + 1) % heroPool.length);
    }, 7000);
    return () => window.clearInterval(interval);
  }, [heroPool.length, safeIndex, onSelectHeroIndex]);

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
    touchStartYRef.current = e.touches[0].clientY;
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
    touchStartYRef.current = null;
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
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      className="relative w-full min-h-[290px] sm:min-h-[380px] lg:min-h-[450px] rounded-2xl overflow-hidden bg-[#08090D] border border-[#292C35] flex flex-col justify-end select-none touch-pan-y shadow-2xl"
    >
      {/* Background Backdrop Image with Smooth Directional Swipe Animation */}
      <AnimatePresence mode="wait" custom={swipeDirection}>
        <motion.div
          key={hero.id}
          custom={swipeDirection}
          initial={{ opacity: 0, x: swipeDirection * 36, scale: 1.02 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: swipeDirection * -36, scale: 0.99 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          onClick={() => {
            if (!didSwipeRef.current) {
              onOpenDetails(hero);
            }
          }}
          className="absolute inset-0 cursor-pointer"
        >
          <MediaArtwork
            src={hero.backdropUrl || hero.posterUrl}
            alt={hero.title}
            item={hero}
            aspectRatio="backdrop"
            priority
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 sv-hero-vignette pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#08090D] via-[#08090D]/45 to-transparent pointer-events-none" />
        </motion.div>
      </AnimatePresence>

      {/* Bottom Content Overlay */}
      <div className="relative z-10 w-full px-4 sm:px-8 lg:px-10 pb-4 sm:pb-7 pt-16 flex flex-col gap-3 sm:gap-4 pointer-events-none">
        <div className="max-w-2xl space-y-2 pointer-events-auto">
          {/* Title */}
          <motion.h1
            key={`title-${hero.id}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28 }}
            onClick={() => onOpenDetails(hero)}
            className="text-2xl sm:text-4xl lg:text-5xl font-black text-white font-display tracking-tight leading-tight cursor-pointer hover:text-[#FFC400] transition-colors"
            style={{ textWrap: 'balance' }}
          >
            {hero.title}
          </motion.h1>

          {/* Concise Synopsis */}
          {hero.synopsis && (
            <p className="text-xs sm:text-sm text-[#D4D6DF] max-w-xl leading-relaxed line-clamp-2">
              {hero.synopsis}
            </p>
          )}
        </div>

        {/* Bottom Bar: Primary Play CTA + Swipe Indicator Dots */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 pointer-events-auto">
          <div className="flex items-center gap-2.5">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              type="button"
              onClick={() => onPlayMedia(hero)}
              className="min-h-[42px] sm:min-h-[46px] px-5 sm:px-6 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-[#FFB800] via-[#FF5A36] to-[#FF168B] hover:brightness-110 text-white font-bold text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-[#FF5A36]/30"
            >
              <Play className="w-4 h-4 fill-current shrink-0" />
              <span>Play Now</span>
            </motion.button>
          </div>

          {heroPool.length > 1 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-[#050505]/85 backdrop-blur-md border border-[#231E30]">
              {heroPool.map((item, idx) => {
                const isActive = idx === safeIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSwipeDirection(idx > safeIndex ? 1 : -1);
                      onSelectHeroIndex(idx);
                    }}
                    className="py-1 px-0.5 cursor-pointer flex items-center"
                    aria-label={`Slide ${idx + 1}: ${item.title}`}
                  >
                    <span
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        isActive
                          ? 'w-6 bg-gradient-to-r from-[#FFB800] via-[#FF5A36] to-[#FF168B]'
                          : 'w-1.5 bg-[#231E30] hover:bg-[#7A7686]'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
