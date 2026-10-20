import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  Plus,
  Check,
  Play,
  Share2,
  Tv,
  Film,
  Moon,
  Sun,
  Star,
  Settings,
  ExternalLink,
} from 'lucide-react';
import { MediaItem } from '../types/media';
import { VideoPlayer, buildCineSrcEmbedUrl } from './VideoPlayer';
import { MovieCard } from './MovieCard';
import { AdBanner } from './AdBanner';
import { MediaArtwork } from './MediaArtwork';

interface DetailsViewProps {
  item: MediaItem;
  relatedItems: MediaItem[];
  watchlistIds: string[];
  inWatchlist: boolean;
  autoPlayInitial?: boolean;
  adsEnabled: boolean;
  isAdmin?: boolean;
  playbackRefreshKey?: number;
  onBack: () => void;
  onSelectMedia: (item: MediaItem, autoPlay?: boolean) => void;
  onToggleWatchlist: (item: MediaItem, e: React.MouseEvent) => void;
  onSelectGenre: (genre: string) => void;
  onToggleAds: () => void;
  onOpenAdPolicy: () => void;
  onOpenAdminStudio: (mediaItem: MediaItem) => void;
}

export const DetailsView: React.FC<DetailsViewProps> = ({
  item,
  relatedItems,
  watchlistIds,
  inWatchlist,
  adsEnabled,
  isAdmin = false,
  onBack,
  onSelectMedia,
  onToggleWatchlist,
  onSelectGenre,
  onToggleAds,
  onOpenAdPolicy,
  onOpenAdminStudio,
}) => {
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [selectedEpisodeNumber, setSelectedEpisodeNumber] = useState<number>(1);
  const [lightsOff, setLightsOff] = useState(false);
  const [copiedNotice, setCopiedNotice] = useState(false);

  useEffect(() => {
    setSelectedSeason(1);
    setSelectedEpisodeNumber(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [item.id]);

  const totalSeasons = Math.max(1, item.seasonsCount || 1);
  const totalEpisodes = Math.max(1, item.episodesCount || 8);
  const ratingScore = ((item.popularScore || 92) / 10).toFixed(1);
  const activeEmbedUrl = buildCineSrcEmbedUrl(
    item,
    selectedSeason,
    selectedEpisodeNumber
  );

  const handleShare = () => {
    const params = new URLSearchParams();
    params.set('title', item.id);
    params.set('tmdbId', String(item.tmdbId));
    params.set('type', item.mediaType);
    const shareUrl = `${window.location.origin}/?${params.toString()}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        setCopiedNotice(true);
        setTimeout(() => setCopiedNotice(false), 2500);
      });
    } else {
      setCopiedNotice(true);
      setTimeout(() => setCopiedNotice(false), 2500);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="relative overflow-x-hidden"
    >
      {/* Optional Theater "Turn Off Lights" Dimmer Overlay */}
      {lightsOff && (
        <div
          onClick={() => setLightsOff(false)}
          className="fixed inset-0 bg-black/90 z-30 transition-opacity cursor-pointer"
          aria-hidden="true"
        />
      )}

      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 py-4 sm:py-6 space-y-6 sm:space-y-8">
        {/* Top Portal Breadcrumb & Utility Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-40">
          <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-zinc-400 min-w-0">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              type="button"
              onClick={onBack}
              className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#1A1625] border border-white/10 text-zinc-200 hover:text-white hover:border-[#B892FF] transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-[#B892FF]" />
              <span>Back</span>
            </motion.button>
            <span aria-hidden="true" className="shrink-0">/</span>
            <span className="text-zinc-300 shrink-0 font-mono-tabular">
              TMDB {item.mediaType.toUpperCase()} #{item.tmdbId}
            </span>
            <span aria-hidden="true" className="shrink-0">/</span>
            <span className="text-white font-semibold truncate min-w-0">
              {item.title}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                type="button"
                onClick={() => onOpenAdminStudio(item)}
                className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#1A1625] border border-[#B892FF]/40 text-xs font-semibold text-[#B892FF] hover:bg-[#B892FF]/15 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Edit in Admin Studio</span>
              </motion.button>
            )}

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              type="button"
              onClick={() => setLightsOff((prev) => !prev)}
              className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#1A1625] border border-white/10 text-xs font-medium text-zinc-300 hover:text-white transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {lightsOff ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-[#B892FF]" />
                  <span>Lights On</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-[#B892FF]" />
                  <span>Lights Off</span>
                </>
              )}
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              type="button"
              onClick={handleShare}
              className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#1A1625] border border-white/10 text-xs font-medium text-zinc-300 hover:text-white transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{copiedNotice ? 'Copied!' : 'Share'}</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              type="button"
              onClick={(e) => onToggleWatchlist(item, e)}
              className={`min-h-[42px] px-4 py-2 rounded-xl border text-xs font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                inWatchlist
                  ? 'bg-[#B892FF]/20 border-[#B892FF] text-[#B892FF]'
                  : 'bg-[#B892FF] border-[#B892FF] text-[#110E17] hover:bg-[#C9ABFF]'
              }`}
            >
              {inWatchlist ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>In Favourites</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Add to Favourites</span>
                </>
              )}
            </motion.button>
          </div>
        </div>

        {/* CineSrc.st Video Player Section */}
        <section aria-label="Video Player" className="relative z-40 space-y-3">
          <VideoPlayer
            item={item}
            selectedSeason={selectedSeason}
            selectedEpisodeNumber={selectedEpisodeNumber}
          />

          {/* CineSrc.st Embed Bar */}
          <div className="rounded-2xl bg-[#1A1625] border border-white/10 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-300 font-mono-tabular">
              <span className="text-[#B892FF] font-bold">Active Stream:</span>
              <span className="truncate max-w-md text-zinc-400">
                {activeEmbedUrl}
              </span>
            </div>

            {item.justWatchUrl && (
              <span className="text-[11px] text-zinc-400 font-mono-tabular">
                Artwork powered by JustWatch
              </span>
            )}
          </div>
        </section>

        {/* TV Series Season & Episode Selector for CineSrc.st */}
        {(item.contentType === 'series' || item.mediaType === 'tv') && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl bg-[#1A1625] border border-white/10 p-4 sm:p-5 space-y-4"
            aria-label="Seasons and Episodes"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-lg sm:text-xl font-bold text-white font-display flex items-center gap-2">
                  <Tv className="w-5 h-5 text-[#B892FF]" />
                  <span>Select Season & Episode</span>
                </h2>

                <div className="flex flex-wrap items-center gap-1.5">
                  {Array.from({ length: totalSeasons }, (_, idx) => idx + 1).map(
                    (sNum) => (
                      <button
                        key={sNum}
                        type="button"
                        onClick={() => {
                          setSelectedSeason(sNum);
                          setSelectedEpisodeNumber(1);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono-tabular transition-colors cursor-pointer ${
                          selectedSeason === sNum
                            ? 'bg-[#B892FF] text-[#110E17]'
                            : 'bg-[#120F1A] text-zinc-300 border border-white/10 hover:text-white'
                        }`}
                      >
                        Season {sNum}
                      </button>
                    )
                  )}
                </div>
              </div>

              <span className="text-xs text-zinc-400 font-mono-tabular">
                Playing S{selectedSeason}:E{selectedEpisodeNumber} via CineSrc.st
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
              {Array.from({ length: totalEpisodes }, (_, idx) => idx + 1).map(
                (epNum) => {
                  const isSelected = selectedEpisodeNumber === epNum;
                  return (
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.96 }}
                      key={epNum}
                      type="button"
                      onClick={() => {
                        setSelectedEpisodeNumber(epNum);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className={`p-3 rounded-xl border text-left transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'bg-[#B892FF] text-[#110E17] border-[#B892FF] font-bold'
                          : 'bg-[#13101C] text-zinc-200 border-white/10 hover:border-[#B892FF]/50'
                      }`}
                    >
                      <span className="text-xs font-mono-tabular">
                        Ep {epNum}
                      </span>
                      <Play className="w-3.5 h-3.5 fill-current shrink-0" />
                    </motion.button>
                  );
                }
              )}
            </div>
          </motion.section>
        )}

        {/* Movie / Series Metadata Card */}
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-3xl bg-[#1A1625] border border-white/10 p-4 sm:p-7 grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8 items-start"
        >
          <div className="md:col-span-3 w-36 sm:w-44 md:w-full shrink-0">
            <div className="rounded-2xl overflow-hidden border border-white/15 aspect-[3/4]">
              <MediaArtwork
                src={item.posterUrl}
                alt={item.title}
                item={item}
                aspectRatio="poster"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          <div className="md:col-span-9 space-y-4 min-w-0">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm text-zinc-300 font-mono-tabular">
              <span className="text-[#B892FF] font-bold">
                HD · CINESRC.ST STREAM
              </span>
              <span aria-hidden="true">·</span>
              <span>TMDB #{item.tmdbId}</span>
              <span aria-hidden="true">·</span>
              <span className="flex items-center gap-1 text-[#B892FF]">
                <Star className="w-3.5 h-3.5 fill-current" />
                <span>{ratingScore} Rating</span>
              </span>
              <span aria-hidden="true">·</span>
              <span>{item.releaseYear}</span>
              <span aria-hidden="true">·</span>
              <span>{item.maturityRating}</span>
              <span aria-hidden="true">·</span>
              <span>{item.durationMinutes} min</span>
            </div>

            <h1 className="text-xl sm:text-4xl font-bold text-white font-display break-words">
              {item.title}
            </h1>

            <p className="text-xs sm:text-base text-zinc-300 leading-relaxed">
              {item.synopsis}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-8 pt-3 border-t border-white/10 text-xs sm:text-sm">
              <div>
                <span className="text-zinc-500">Type: </span>
                <span className="text-zinc-200 font-mono-tabular uppercase">
                  {item.mediaType === 'tv' ? 'TV Series' : 'Movie'} (TMDB #{item.tmdbId})
                </span>
              </div>
              <div>
                <span className="text-zinc-500">Release Year: </span>
                <span className="text-zinc-200 font-mono-tabular">
                  {item.releaseYear}
                </span>
              </div>
              <div>
                <span className="text-zinc-500">Director / Creator: </span>
                <span className="text-zinc-200 font-medium">
                  {item.directorOrCreator}
                </span>
              </div>
              <div>
                <span className="text-zinc-500">Duration: </span>
                <span className="text-zinc-200 font-mono-tabular">
                  {item.durationMinutes} min
                </span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-zinc-500">Casts: </span>
                <span className="text-zinc-200">{item.cast.join(', ')}</span>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap items-center gap-2">
              <span className="text-xs text-zinc-500 mr-1">Genres:</span>
              {item.genres.map((genre) => (
                <button
                  key={genre}
                  type="button"
                  onClick={() => onSelectGenre(genre)}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[#120F1A] border border-white/10 text-xs font-medium text-zinc-200 hover:border-[#B892FF] hover:text-[#B892FF] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {genre}
                </button>
              ))}
            </div>
          </div>
        </motion.section>

        <AdBanner
          enabled={adsEnabled}
          slotId="ZAPPY-WATCH-COMPANION-02"
          placementLabel="Watch Page Companion Display Slot"
          onToggleAds={onToggleAds}
          onOpenAdPolicy={onOpenAdPolicy}
        />

        {relatedItems.length > 0 && (
          <section
            className="space-y-4 pt-2 border-t border-white/10"
            aria-label="You May Also Like"
          >
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white font-display">
                You May Also Like
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
                More movies and TV series on ZAPPY
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5 sm:gap-5">
              {relatedItems.map((rel) => (
                <MovieCard
                  key={rel.id}
                  item={rel}
                  inWatchlist={watchlistIds.includes(rel.id)}
                  onSelect={onSelectMedia}
                  onToggleWatchlist={onToggleWatchlist}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </motion.div>
  );
};
