import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, ChevronLeft, ChevronRight, Info } from 'lucide-react';
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
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
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
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      className="group/hero relative w-full min-h-[290px] sm:min-h-[390px] lg:min-h-[465px] rounded-2xl overflow-hidden bg-[#08090D] border border-[#292C35]/90 flex flex-col justify-end select-none touch-pan-y cinema-card-shadow"
    >
      {/* Background Backdrop Image with Instant Crossfade (no blank wait gap) */}
      <AnimatePresence initial={false} custom={swipeDirection}>
        <motion.div
          key={hero.id}
          custom={swipeDirection}
          initial={{ opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          onClick={() => {
            if (!didSwipeRef.current) {
              onOpenDetails(hero);
            }
          }}
          className="absolute inset-0 cursor-pointer will-change-transform"
        >
          <MediaArtwork
            src={hero.backdropUrl || hero.posterUrl}
            alt={hero.title}
            item={hero}
            aspectRatio="backdrop"
            priority
            className="w-full h-full object-cover object-center transition-transform duration-[7000ms] ease-out group-hover/hero:scale-[1.03]"
          />
          <div className="absolute inset-0 sv-hero-vignette pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#08090D] via-[#08090D]/45 to-transparent pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#08090D]/85 via-[#08090D]/30 to-transparent pointer-events-none" />
        </motion.div>
      </AnimatePresence>

      {/* Top-Right Non-Overlapping Prev/Next Controls on Tablet & Desktop */}
      {heroPool.length > 1 && (
        <div className="hidden sm:flex items-center gap-2 absolute top-4 right-4 z-20">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goToPrevious();
            }}
            aria-label="Previous spotlight title"
            className="w-9 h-9 rounded-full bg-[#08090D]/80 hover:bg-[#14161D] border border-white/15 hover:border-[#FFB800]/70 text-white flex items-center justify-center opacity-0 group-hover/hero:opacity-100 focus:opacity-100 transition-all duration-200 cursor-pointer backdrop-blur-md shadow-xl active:scale-95"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goToNext();
            }}
            aria-label="Next spotlight title"
            className="w-9 h-9 rounded-full bg-[#08090D]/80 hover:bg-[#14161D] border border-white/15 hover:border-[#FFB800]/70 text-white flex items-center justify-center opacity-0 group-hover/hero:opacity-100 focus:opacity-100 transition-all duration-200 cursor-pointer backdrop-blur-md shadow-xl active:scale-95"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Bottom Content Overlay — Clean Title, Metadata, Play & Details CTAs, and Slide Dots */}
      <div className="relative z-10 w-full px-4 sm:px-8 lg:px-10 pb-4 sm:pb-7 pt-14 sm:pt-16 flex flex-col gap-2.5 sm:gap-3.5 pointer-events-none">
        <div className="max-w-2xl pointer-events-auto space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-[11px] sm:text-xs font-bold text-[#FFB800]">
            <span>{hero.releaseYear}</span>
            {hero.genres?.[0] && (
              <>
                <span className="text-white/40">·</span>
                <span className="text-white/90">{hero.genres.slice(0, 2).join(' / ')}</span>
              </>
            )}
            {hero.durationMinutes > 0 && (
              <>
                <span className="text-white/40">·</span>
                <span className="text-white/75">{hero.durationMinutes}m</span>
              </>
            )}
          </div>
          <h1
            onClick={() => onOpenDetails(hero)}
            className="text-xl sm:text-4xl lg:text-5xl font-black text-white font-display tracking-tight leading-[1.08] cursor-pointer hover:text-[#FFB800] transition-colors drop-shadow-[0_4px_24px_rgba(0,0,0,0.85)] break-words"
            style={{ textWrap: 'balance' }}
          >
            {hero.title}
          </h1>
        </div>

        {/* Bottom Bar: Play CTA + Details CTA on Left, Swipe Indicator Dots on Right */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 pt-0.5 pointer-events-auto">
          <div className="flex items-center gap-2.5">
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={() => onPlayMedia(hero)}
              className="min-h-[40px] sm:min-h-[44px] px-5 sm:px-7 py-2 sm:py-2.5 rounded-xl zf-gradient-btn text-white font-extrabold text-xs sm:text-sm flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 shadow-lg shadow-[#FF5A36]/30 transition-all duration-200"
            >
              <Play className="w-4 h-4 fill-current shrink-0" />
              <span>Play Now</span>
            </motion.button>

            <button
              type="button"
              onClick={() => onOpenDetails(hero)}
              className="min-h-[40px] sm:min-h-[44px] px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/15 text-white font-bold text-xs sm:text-sm flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
            >
              <Info className="w-4 h-4 shrink-0" />
              <span>Details</span>
            </button>
          </div>

          {heroPool.length > 1 && (
            <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-full bg-[#050505]/85 backdrop-blur-md border border-white/10 shadow-lg max-w-full overflow-x-auto no-scrollbar">
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
                    className="py-1 px-0.5 cursor-pointer flex items-center shrink-0"
                    aria-label={`Slide ${idx + 1}: ${item.title}`}
                  >
                    <span
                      className={`relative h-1.5 rounded-full transition-all duration-300 overflow-hidden ${
                        isActive
                          ? 'w-5 sm:w-8 bg-white/20'
                          : 'w-1.5 bg-[#292C35] hover:bg-[#7A7686]'
                      }`}
                    >
                      {isActive && (
                        <motion.span
                          key={`progress-${hero.id}-${isPaused ? 'paused' : 'playing'}`}
                          initial={{ width: isPaused ? '100%' : '0%' }}
                          animate={{ width: '100%' }}
                          transition={{
                            duration: isPaused ? 0.2 : 7,
                            ease: 'linear',
                          }}
                          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#FFB800] via-[#FF5A36] to-[#FF168B]"
                        />
                      )}
                    </span>
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
