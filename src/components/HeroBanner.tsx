import React, { useEffect } from 'react';
import {
  Play,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
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
  const safeIndex =
    featuredItems.length > 0 ? activeHeroIndex % featuredItems.length : 0;
  const heroItem = featuredItems[safeIndex] || featuredItems[0];

  useEffect(() => {
    if (featuredItems.length <= 1) return;
    const timer = window.setInterval(() => {
      onSelectHeroIndex((safeIndex + 1) % featuredItems.length);
    }, 9000);
    return () => window.clearInterval(timer);
  }, [safeIndex, featuredItems.length, onSelectHeroIndex]);

  if (!heroItem) return null;

  const isSeries =
    heroItem.mediaType === 'tv' || heroItem.contentType === 'series';

  return (
    <section
      aria-label="Featured Spotlight Banner"
      className="relative w-full h-[calc(100dvh-5.25rem)] min-h-[380px] max-h-[650px] overflow-hidden rounded-2xl bg-[#141414] border border-[#262626] select-none flex flex-col justify-end"
    >
      {/* Widescreen Backdrop with Measured Contrast Scrim */}
      <div className="absolute inset-0 pointer-events-none">
        <MediaArtwork
          src={heroItem.backdropUrl || heroItem.posterUrl}
          alt={heroItem.title}
          item={heroItem}
          aspectRatio="backdrop"
          priority
          className="w-full h-full object-cover object-center transition-opacity duration-300"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/75 to-black/25" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#141414]/85 via-[#141414]/35 to-transparent" />
      </div>

      {/* Content & Always-Visible Action Bar (Fits 100% Inside Viewport Without Scrolling) */}
      <div className="relative z-10 w-full p-5 sm:p-8 lg:p-10 flex flex-col gap-5">
        <div className="max-w-3xl space-y-2.5">
          {/* Real Metadata Line (Unboxed Text) */}
          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm font-medium text-zinc-300">
            <span className="text-[#E50000] font-bold">
              {isSeries ? 'Series' : 'Movie'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{heroItem.releaseYear}</span>
            <span aria-hidden="true">·</span>
            <span>{heroItem.maturityRating}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">
              {isSeries
                ? `${heroItem.seasonsCount || 1} Season${
                    (heroItem.seasonsCount || 1) > 1 ? 's' : ''
                  }`
                : `${heroItem.durationMinutes} min`}
            </span>
            {heroItem.genres.length > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-zinc-200">
                  {heroItem.genres.slice(0, 3).join(' / ')}
                </span>
              </>
            )}
          </div>

          <h1
            onClick={() => onOpenDetails(heroItem)}
            className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white font-display tracking-tight cursor-pointer hover:text-zinc-200 transition-colors"
            style={{ textWrap: 'balance' }}
          >
            {heroItem.title}
          </h1>

          <p className="text-xs sm:text-sm lg:text-base text-zinc-300 leading-relaxed line-clamp-2 max-w-2xl">
            {heroItem.synopsis}
          </p>
        </div>

        {/* Bottom Row: Primary Play CTA + Slide Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onPlayMedia(heroItem)}
              className="min-h-[46px] px-6 py-2.5 rounded-lg bg-[#E50000] hover:bg-[#FF1A1A] text-white font-semibold text-xs sm:text-sm flex items-center gap-2 cursor-pointer shadow-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Play Now</span>
            </button>
          </div>

          {/* Slide Navigation Controls */}
          {featuredItems.length > 1 && (
            <div className="flex items-center gap-3 bg-[#0F0F0F]/90 border border-white/15 rounded-xl p-1.5">
              <button
                type="button"
                onClick={() =>
                  onSelectHeroIndex(
                    (safeIndex - 1 + featuredItems.length) %
                      featuredItems.length
                  )
                }
                className="w-9 h-9 rounded-lg bg-[#1A1A1A] hover:bg-[#262626] border border-white/15 text-white flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Previous slide"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1.5 px-1">
                {featuredItems.map((item, idx) => {
                  const isActive = idx === safeIndex;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectHeroIndex(idx)}
                      aria-label={`Slide ${idx + 1}: ${item.title}`}
                      className={`h-1.5 rounded-full transition-all cursor-pointer ${
                        isActive
                          ? 'w-6 bg-[#E50000]'
                          : 'w-3 bg-white/30 hover:bg-white/50'
                      }`}
                    />
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() =>
                  onSelectHeroIndex((safeIndex + 1) % featuredItems.length)
                }
                className="w-9 h-9 rounded-lg bg-[#1A1A1A] hover:bg-[#262626] border border-white/15 text-white flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Next slide"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
