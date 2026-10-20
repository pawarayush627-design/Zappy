import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Download, Check, MoreHorizontal, Flame } from 'lucide-react';
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
  watchlistIds,
  onPlayMedia,
  onOpenDetails,
  onToggleWatchlist,
}) => {
  const heroItem = featuredItems[activeHeroIndex] || featuredItems[0];

  useEffect(() => {
    if (featuredItems.length <= 1) return;
    const timer = setInterval(() => {
      onSelectHeroIndex((activeHeroIndex + 1) % featuredItems.length);
    }, 8000);
    return () => clearInterval(timer);
  }, [activeHeroIndex, featuredItems.length, onSelectHeroIndex]);

  if (!heroItem) return null;

  const inWatchlist = watchlistIds.includes(heroItem.id);

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      aria-label="Featured Movie Spotlight"
      className="w-full"
    >
      <div className="relative w-full min-h-[360px] sm:min-h-[410px] lg:min-h-[440px] rounded-3xl overflow-hidden border border-white/[0.08] bg-[#171324] flex flex-col justify-between p-6 sm:p-8 lg:p-10 shadow-2xl">
        {/* Animated Background Widescreen Artwork */}
        <AnimatePresence mode="wait">
          <motion.div
            key={heroItem.id}
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
            className="absolute inset-0 select-none pointer-events-none"
          >
            <MediaArtwork
              src={heroItem.backdropUrl}
              alt={`${heroItem.title} backdrop`}
              item={heroItem}
              aspectRatio="backdrop"
              priority
              className="w-full h-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#120F1D]/95 via-[#120F1D]/70 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#120F1D]/90 via-transparent to-[#120F1D]/30" />
          </motion.div>
        </AnimatePresence>

        {/* Top-Left "Now Trending" Status Tag */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/45 backdrop-blur-md border border-white/10 text-xs font-semibold text-white">
            <Flame className="w-3.5 h-3.5 text-[#FF8A3D] fill-current" />
            <span>Now Trending</span>
          </div>
        </div>

        {/* Middle & Bottom Content Lockup */}
        <div className="relative z-10 mt-8 sm:mt-12 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={heroItem.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="max-w-xl space-y-3.5"
            >
              <div className="flex flex-wrap items-center gap-2">
                {heroItem.genres.slice(0, 3).map((genre) => (
                  <button
                    key={genre}
                    type="button"
                    onClick={() => onOpenDetails(heroItem)}
                    className="px-3.5 py-1 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/15 text-xs font-medium text-zinc-100 transition-colors cursor-pointer"
                  >
                    {genre}
                  </button>
                ))}
              </div>

              <h1
                className="font-bold text-white tracking-tight font-display leading-[1.1]"
                style={{ fontSize: 'clamp(1.75rem, 3.2vw, 2.85rem)' }}
              >
                {heroItem.title}
              </h1>

              <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed line-clamp-2 max-w-lg">
                {heroItem.synopsis}
              </p>

              <div className="pt-2 flex items-center gap-3">
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  type="button"
                  onClick={() => onPlayMedia(heroItem)}
                  className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#B892FF] hover:bg-[#C9ABFF] text-[#110E17] font-bold text-xs sm:text-sm transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer shadow-lg shadow-[#B892FF]/25"
                >
                  <Play className="w-4 h-4 fill-current shrink-0" />
                  <span>Watch Now</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  onClick={(e) => onToggleWatchlist(heroItem, e)}
                  className={`min-h-[44px] min-w-[44px] rounded-xl border backdrop-blur-md flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                    inWatchlist
                      ? 'bg-[#B892FF]/25 border-[#B892FF] text-[#B892FF]'
                      : 'bg-white/10 hover:bg-white/20 border-white/15 text-white'
                  }`}
                  aria-label={
                    inWatchlist
                      ? `Remove ${heroItem.title} from Favourites`
                      : `Save ${heroItem.title} to Favourites`
                  }
                  title={inWatchlist ? 'Saved in Favourites' : 'Save to Favourites'}
                >
                  {inWatchlist ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  onClick={() => onOpenDetails(heroItem)}
                  className="min-h-[44px] min-w-[44px] rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 backdrop-blur-md text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
                  aria-label={`More details for ${heroItem.title}`}
                  title="More Details"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </motion.button>
              </div>
            </motion.div>
          </AnimatePresence>

          {featuredItems.length > 1 && (
            <div
              role="tablist"
              aria-label="Featured spotlight slides"
              className="self-end inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-black/40 backdrop-blur-md border border-white/10"
            >
              {featuredItems.map((item, idx) => {
                const isActive = idx === activeHeroIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-label={`Slide ${idx + 1}: ${item.title}`}
                    onClick={() => onSelectHeroIndex(idx)}
                    className={`h-1.5 rounded-full transition-all cursor-pointer ${
                      isActive
                        ? 'w-6 bg-white'
                        : 'w-2 bg-white/40 hover:bg-white/70'
                    }`}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </motion.section>
  );
};
