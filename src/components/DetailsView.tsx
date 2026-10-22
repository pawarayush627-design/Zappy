import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  Plus,
  Check,
  Play,
  Share2,
  Moon,
  Sun,
  Settings,
  Eye,
  Sparkles,
  Loader2,
  RotateCcw,
  SkipForward,
  Server,
  Star,
} from 'lucide-react';
import { MediaItem } from '../types/media';
import { VideoPlayer, STREAM_TRACKS } from './VideoPlayer';
import { MovieCard } from './MovieCard';
import { MediaArtwork } from './MediaArtwork';

interface DetailsViewProps {
  item: MediaItem;
  relatedItems: MediaItem[];
  watchlistIds: string[];
  inWatchlist: boolean;
  isCompleted?: boolean;
  autoPlayInitial?: boolean;
  adsEnabled: boolean;
  isAdmin?: boolean;
  isPreviewDraft?: boolean;
  isPublishingDraft?: boolean;
  playbackRefreshKey?: number;
  initialSeason?: number;
  initialEpisode?: number;
  savedSeason?: number;
  savedEpisode?: number;
  hasProgress?: boolean;
  onBack: () => void;
  onSelectMedia: (item: MediaItem, autoPlay?: boolean, resumeSaved?: boolean) => void;
  onToggleWatchlist: (item: MediaItem, e: React.MouseEvent) => void;
  onMarkWatched: (item: MediaItem) => void;
  onSelectGenre: (genre: string) => void;
  onToggleAds: () => void;
  onOpenAdPolicy: () => void;
  onOpenAdminStudio: (mediaItem: MediaItem) => void;
  onPublishPreviewDraft?: () => void;
  onReturnToAdminStudio?: () => void;
  onAutoSyncEpisodes?: (item: MediaItem, seasonsCount: number, episodesCount: number) => void;
  onUpdateProgress?: (
    season: number,
    episode: number,
    progressPercent?: number,
    remainingMinutes?: number
  ) => void;
  onStartOver?: () => void;
}

function formatDurationDisplay(minutes: number): string {
  if (!minutes || minutes <= 0) return '';
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs <= 0) return `${mins}m`;
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

export const DetailsView: React.FC<DetailsViewProps> = ({
  item,
  relatedItems,
  watchlistIds,
  inWatchlist,
  isCompleted = false,
  autoPlayInitial = false,
  isAdmin = false,
  isPreviewDraft = false,
  isPublishingDraft = false,
  initialSeason = 1,
  initialEpisode = 1,
  savedSeason,
  savedEpisode,
  hasProgress = false,
  onBack,
  onSelectMedia,
  onToggleWatchlist,
  onMarkWatched,
  onSelectGenre,
  onOpenAdminStudio,
  onPublishPreviewDraft,
  onReturnToAdminStudio,
  onUpdateProgress,
  onStartOver,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(Boolean(autoPlayInitial));
  const [selectedTrackIndex, setSelectedTrackIndex] = useState<number>(0);
  const [reloadKey, setReloadKey] = useState<number>(0);
  const [selectedSeason, setSelectedSeason] = useState<number>(
    Math.max(1, initialSeason || 1)
  );
  const [selectedEpisodeNumber, setSelectedEpisodeNumber] = useState<number>(
    Math.max(1, initialEpisode || 1)
  );
  const [lightsOff, setLightsOff] = useState(false);
  const [copiedNotice, setCopiedNotice] = useState(false);

  const isSeries = item.contentType === 'series' || item.mediaType === 'tv';
  const totalSeasons = isSeries ? Math.max(1, item.seasonsCount || 1) : 1;
  const totalEpisodesInSeason = isSeries
    ? Math.max(1, item.episodesCount || 8)
    : 1;

  // Authentic IMDb rating if present on item
  const realImdbRating = useMemo(() => {
    const raw = (item as MediaItem & { imdbRating?: number }).imdbRating;
    if (typeof raw === 'number' && !Number.isNaN(raw) && raw > 0) {
      return raw.toFixed(1);
    }
    return null;
  }, [item]);

  useEffect(() => {
    const startS = Math.max(1, initialSeason || 1);
    const startE = Math.max(1, initialEpisode || 1);
    setIsPlaying(Boolean(autoPlayInitial));
    setSelectedSeason(startS);
    setSelectedEpisodeNumber(startE);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [item.id, item.title, autoPlayInitial, initialSeason, initialEpisode]);

  const handleStartPlayback = (seasonNum = 1, epNum = 1) => {
    const cleanS = Math.max(1, Number(seasonNum) || 1);
    const cleanE = Math.max(1, Number(epNum) || 1);
    setSelectedSeason(cleanS);
    setSelectedEpisodeNumber(cleanE);
    setIsPlaying(true);
    if (onUpdateProgress) {
      onUpdateProgress(cleanS, cleanE);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNextEpisode = () => {
    if (!isSeries) return;
    if (selectedEpisodeNumber < totalEpisodesInSeason) {
      const nextEp = selectedEpisodeNumber + 1;
      setSelectedEpisodeNumber(nextEp);
      setIsPlaying(true);
      if (onUpdateProgress) onUpdateProgress(selectedSeason, nextEp);
    } else if (selectedSeason < totalSeasons) {
      const nextSeason = selectedSeason + 1;
      setSelectedSeason(nextSeason);
      setSelectedEpisodeNumber(1);
      setIsPlaying(true);
      if (onUpdateProgress) {
        onUpdateProgress(nextSeason, 1);
      }
    } else {
      onMarkWatched(item);
    }
  };

  const handleShare = () => {
    const params = new URLSearchParams();
    params.set('title', item.id);
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

  const resumeSeasonNum = Math.max(1, savedSeason || initialSeason || 1);
  const resumeEpisodeNum = Math.max(1, savedEpisode || initialEpisode || 1);
  const showResumeSeparateButton =
    hasProgress &&
    isSeries &&
    (resumeSeasonNum !== 1 || resumeEpisodeNum !== 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className="relative overflow-x-hidden"
    >
      {/* Optional Theater Dimmer Overlay */}
      {lightsOff && (
        <div
          onClick={() => setLightsOff(false)}
          className="fixed inset-0 bg-black/92 z-30 transition-opacity cursor-pointer"
          aria-hidden="true"
        />
      )}

      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* ADMIN UNPUBLISHED DRAFT PREVIEW BAR */}
        {isPreviewDraft && (
          <div className="rounded-2xl bg-gradient-to-r from-[#2D1E4A] via-[#1E1533] to-[#1A1429] border-2 border-[#B892FF]/60 p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3 shadow-2xl relative z-40">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#B892FF]/20 border border-[#B892FF]/40 text-[#B892FF] flex items-center justify-center shrink-0">
                <Eye className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-[#B892FF] text-[#110E17] text-[10px] font-extrabold uppercase tracking-wider">
                    Draft Preview
                  </span>
                  <h2 className="text-xs sm:text-sm font-bold text-white font-display truncate">
                    {item.title}
                  </h2>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {onReturnToAdminStudio && (
                <button
                  type="button"
                  onClick={onReturnToAdminStudio}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Editor</span>
                </button>
              )}
              {onPublishPreviewDraft && (
                <button
                  type="button"
                  disabled={isPublishingDraft}
                  onClick={onPublishPreviewDraft}
                  className="min-h-[38px] px-4 py-1.5 rounded-xl bg-[#FFC400] hover:bg-[#FFD54A] text-[#08090D] text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-[#FFC400]/25 transition-colors disabled:opacity-60"
                >
                  {isPublishingDraft ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Publishing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Publish Now</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {/* =========================================================
            STAGE 1: CINEMATIC HERO SHOWCASE (BEFORE PLAY IS PRESSED)
            OR STAGE 2: ACTIVE STREAMING PLAYER (EXPANDED ON MOBILE)
        ========================================================= */}
        {!isPlaying ? (
          <div className="space-y-3.5 sm:space-y-4">
            <motion.section
              initial={{ opacity: 0, scale: 0.99 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              aria-label={`${item.title} Details`}
              className="relative w-full min-h-[310px] sm:min-h-[400px] lg:min-h-[450px] rounded-2xl overflow-hidden bg-[#08090D] border border-[#292C35] shadow-2xl flex flex-col justify-between"
            >
              {/* Widescreen Backdrop with Cinematic Gradients */}
              <div className="absolute inset-0 pointer-events-none">
                <MediaArtwork
                  src={item.backdropUrl || item.posterUrl}
                  alt={item.title}
                  item={item}
                  aspectRatio="backdrop"
                  priority
                  className="w-full h-full object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#08090D] via-[#08090D]/75 to-black/25" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#08090D]/90 via-[#08090D]/55 to-transparent" />
              </div>

              {/* Clean Top Bar: Back Button Only */}
              <div className="relative z-10 flex items-center justify-between p-3 sm:p-5">
                <button
                  type="button"
                  onClick={
                    isPreviewDraft && onReturnToAdminStudio
                      ? onReturnToAdminStudio
                      : onBack
                  }
                  className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#08090D]/85 hover:bg-[#14161D] backdrop-blur-md border border-[#292C35] hover:border-[#FFC400] text-white text-xs sm:text-sm font-semibold flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 text-[#FFC400]" />
                  <span>{isPreviewDraft ? 'Back to Editor' : 'Back'}</span>
                </button>
              </div>

              {/* Clean Bottom Hero Row: Poster, Title, Synopsis & Primary Play CTA */}
              <div className="relative z-10 p-4 sm:p-6 lg:p-8 flex flex-col md:flex-row md:items-end gap-5 lg:gap-7">
                {/* Crisp Desktop Poster Artwork */}
                <div className="hidden md:block w-32 lg:w-40 aspect-[2/3] rounded-xl overflow-hidden border border-[#292C35] bg-[#14161D] shadow-2xl shrink-0">
                  <MediaArtwork
                    src={item.posterUrl || item.backdropUrl}
                    alt={item.title}
                    item={item}
                    aspectRatio="poster"
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Title, Concise Synopsis & Primary Play Button */}
                <div className="flex-1 min-w-0 space-y-2.5 sm:space-y-3">
                  <h1
                    className="text-2xl sm:text-4xl lg:text-5xl font-black text-white font-display tracking-tight leading-tight break-words"
                    style={{ textWrap: 'balance' }}
                  >
                    {item.title}
                  </h1>

                  {item.synopsis && (
                    <p className="text-xs sm:text-sm lg:text-base text-[#D4D6DF] leading-relaxed max-w-2xl line-clamp-2 sm:line-clamp-3">
                      {item.synopsis}
                    </p>
                  )}

                  <div className="pt-1 flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleStartPlayback(1, 1)}
                      className="min-h-[44px] px-6 sm:px-7 py-2.5 rounded-xl bg-[#FFC400] hover:bg-[#FFD54A] text-[#08090D] font-bold text-xs sm:text-sm flex items-center gap-2 cursor-pointer shadow-lg shadow-[#FFC400]/25 transition-all active:scale-95"
                    >
                      <Play className="w-4 h-4 fill-current shrink-0" />
                      <span>{isSeries ? 'Play S1 · E1' : 'Play Now'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </motion.section>

            {/* Relocated Metadata, Genres & Secondary Actions Strip Below Hero */}
            <div className="rounded-2xl bg-[#14161D] border border-[#292C35] p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
              <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm font-medium text-[#A7A9B4]">
                <span className="px-2 py-0.5 rounded bg-[#FFC400] text-[#08090D] text-[10px] sm:text-[11px] font-black uppercase tracking-wider">
                  {isSeries ? 'Series' : 'Movie'}
                </span>

                {item.releaseYear > 0 && (
                  <span className="text-white font-semibold tabular-nums">
                    {item.releaseYear}
                  </span>
                )}

                {item.maturityRating && (
                  <>
                    <span aria-hidden="true" className="text-[#747784]">·</span>
                    <span className="px-2 py-0.5 rounded bg-[#08090D] border border-[#292C35] text-xs font-semibold text-white">
                      {item.maturityRating}
                    </span>
                  </>
                )}

                {(isSeries || item.durationMinutes > 0) && (
                  <>
                    <span aria-hidden="true" className="text-[#747784]">·</span>
                    <span className="tabular-nums text-white/90">
                      {isSeries
                        ? `${totalSeasons} Season${totalSeasons > 1 ? 's' : ''}`
                        : formatDurationDisplay(item.durationMinutes)}
                    </span>
                  </>
                )}

                {realImdbRating && (
                  <>
                    <span aria-hidden="true" className="text-[#747784]">·</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#FFC400]/15 border border-[#FFC400]/40 text-[#FFC400] text-xs font-bold tabular-nums">
                      <Star className="w-3 h-3 fill-current" />
                      <span>IMDb {realImdbRating}</span>
                    </span>
                  </>
                )}

                {item.genres && item.genres.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 sm:pl-1">
                    {item.genres.map((genre) => (
                      <button
                        key={genre}
                        type="button"
                        onClick={() => onSelectGenre(genre)}
                        className="px-2.5 py-1 rounded-lg bg-[#08090D] hover:bg-[#252832] border border-[#292C35] hover:border-[#FFC400]/60 text-xs font-medium text-[#D4D6DF] hover:text-[#FFC400] transition-colors cursor-pointer"
                      >
                        {genre}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {showResumeSeparateButton && (
                  <button
                    type="button"
                    onClick={() =>
                      handleStartPlayback(resumeSeasonNum, resumeEpisodeNum)
                    }
                    className="min-h-[38px] px-3.5 py-2 rounded-xl bg-[#08090D] hover:bg-[#252832] border border-[#FFC400]/50 text-[#FFC400] text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Play className="w-3.5 h-3.5 fill-current shrink-0" />
                    <span>
                      Resume S{resumeSeasonNum} · E{resumeEpisodeNum}
                    </span>
                  </button>
                )}

                {hasProgress && !isSeries && (
                  <button
                    type="button"
                    onClick={() => {
                      if (onStartOver) onStartOver();
                      handleStartPlayback(1, 1);
                    }}
                    className="min-h-[38px] px-3.5 py-2 rounded-xl bg-[#08090D] hover:bg-[#252832] border border-[#292C35] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-[#FFC400] shrink-0" />
                    <span>Start Over</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={(e) => onToggleWatchlist(item, e)}
                  className={`min-h-[38px] px-3.5 py-2 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    inWatchlist
                      ? 'bg-[#252832] border-[#FFC400] text-[#FFC400]'
                      : 'bg-[#08090D] hover:bg-[#252832] border-[#292C35] text-white'
                  }`}
                >
                  {inWatchlist ? (
                    <>
                      <Check className="w-3.5 h-3.5 shrink-0" />
                      <span>In Watchlist</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5 shrink-0" />
                      <span>Watchlist</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleShare}
                  className="min-h-[38px] px-3.5 py-2 rounded-xl bg-[#08090D] hover:bg-[#252832] border border-[#292C35] text-xs font-semibold text-[#A7A9B4] hover:text-white flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>{copiedNotice ? 'Copied' : 'Share'}</span>
                </button>

                {isAdmin && !isPreviewDraft && (
                  <button
                    type="button"
                    onClick={() => onOpenAdminStudio(item)}
                    className="min-h-[38px] px-3.5 py-2 rounded-xl bg-[#08090D] hover:bg-[#252832] border border-[#FFC400]/40 text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5 text-[#FFC400]" />
                    <span>Admin Studio</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* =========================================================
              ACTIVE PLAYER VIEW (LARGE MOBILE VIEWPORT + COMPACT CONTROLS)
          ========================================================= */
          <motion.section
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            aria-label="Video Player"
            className="space-y-2 relative z-40"
          >
            {/* Compact Non-Overlapping Control Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-[#14161D] border border-[#292C35] rounded-xl px-2.5 sm:px-3.5 py-2">
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                <button
                  type="button"
                  onClick={
                    isPreviewDraft && onReturnToAdminStudio
                      ? onReturnToAdminStudio
                      : onBack
                  }
                  className="min-h-[36px] px-2.5 sm:px-3 py-1.5 rounded-lg bg-[#08090D] hover:bg-[#252832] border border-[#292C35] text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-[#FFC400]" />
                  <span>Back</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsPlaying(false)}
                  className="min-h-[36px] px-2.5 sm:px-3 py-1.5 rounded-lg bg-[#08090D] hover:bg-[#252832] border border-[#292C35] text-[#A7A9B4] hover:text-white text-xs font-semibold shrink-0 cursor-pointer transition-colors"
                >
                  Info
                </button>

                <span className="px-2 py-0.5 rounded bg-[#FFC400] text-[#08090D] text-[10px] font-black uppercase shrink-0">
                  {isSeries
                    ? `S${selectedSeason} · E${selectedEpisodeNumber}`
                    : 'Movie'}
                </span>

                <span className="text-xs sm:text-sm font-bold text-white truncate min-w-0">
                  {item.title}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                {/* Server Selector */}
                <div className="min-h-[36px] flex items-center gap-1 bg-[#08090D] border border-[#292C35] rounded-lg px-2 py-1">
                  <Server className="w-3.5 h-3.5 text-[#FFC400] shrink-0" />
                  <select
                    value={selectedTrackIndex}
                    onChange={(e) => setSelectedTrackIndex(Number(e.target.value))}
                    aria-label="Select streaming server"
                    className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer pr-1"
                  >
                    {STREAM_TRACKS.map((track, idx) => (
                      <option
                        key={track.id}
                        value={idx}
                        className="bg-[#14161D] text-white"
                      >
                        {track.label}
                      </option>
                    ))}
                  </select>
                </div>

                {isSeries && (
                  <button
                    type="button"
                    onClick={handleNextEpisode}
                    className="min-h-[36px] px-2.5 sm:px-3 py-1.5 rounded-lg bg-[#08090D] hover:bg-[#252832] border border-[#292C35] text-xs font-semibold text-white flex items-center gap-1 cursor-pointer shrink-0 transition-colors"
                    title="Next Episode"
                  >
                    <SkipForward className="w-3.5 h-3.5 text-[#FFC400]" />
                    <span className="hidden sm:inline">Next Ep</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setSelectedSeason(1);
                    setSelectedEpisodeNumber(1);
                    if (onStartOver) onStartOver();
                    setReloadKey((k) => k + 1);
                  }}
                  className="min-h-[36px] px-2.5 sm:px-3 py-1.5 rounded-lg bg-[#08090D] hover:bg-[#252832] border border-[#292C35] text-xs font-semibold text-[#A7A9B4] hover:text-white flex items-center gap-1 cursor-pointer shrink-0 transition-colors"
                  title="Play S1 E1 / Start Over"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-[#FFC400]" />
                  <span className="hidden sm:inline">
                    {isSeries ? 'Play S1·E1' : 'Restart'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setLightsOff((prev) => !prev)}
                  className="min-h-[36px] px-2.5 sm:px-3 py-1.5 rounded-lg bg-[#08090D] hover:bg-[#252832] border border-[#292C35] text-xs font-medium text-[#A7A9B4] hover:text-white flex items-center gap-1 cursor-pointer shrink-0 transition-colors"
                >
                  {lightsOff ? (
                    <>
                      <Sun className="w-3.5 h-3.5 text-[#FFC400]" />
                      <span className="hidden sm:inline">Lights</span>
                    </>
                  ) : (
                    <>
                      <Moon className="w-3.5 h-3.5 text-[#FFC400]" />
                      <span className="hidden sm:inline">Theater</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={(e) => onToggleWatchlist(item, e)}
                  className={`min-h-[36px] px-2.5 sm:px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0 transition-colors ${
                    inWatchlist
                      ? 'bg-[#252832] border-[#FFC400] text-[#FFC400]'
                      : 'bg-[#FFC400] hover:bg-[#FFD54A] border-[#FFC400] text-[#08090D]'
                  }`}
                >
                  {inWatchlist ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden sm:inline">
                    {inWatchlist ? 'Saved' : 'Watchlist'}
                  </span>
                </button>
              </div>
            </div>

            <VideoPlayer
              item={item}
              autoPlay={true}
              selectedSeason={selectedSeason}
              selectedEpisodeNumber={selectedEpisodeNumber}
              selectedTrackIndex={selectedTrackIndex}
              reloadKey={reloadKey}
              isCompleted={isCompleted}
              hasProgress={hasProgress}
              onMarkWatched={() => onMarkWatched(item)}
              onPlaybackProgress={(pct, remMins, repSeason, repEp) => {
                if (onUpdateProgress) {
                  onUpdateProgress(
                    repSeason || selectedSeason,
                    repEp || selectedEpisodeNumber,
                    pct,
                    remMins
                  );
                }
              }}
            />

            {/* Compact Storyline & Genre Bar below Active Player */}
            <div className="rounded-xl bg-[#14161D] border border-[#292C35] p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#A7A9B4]">
                  <span className="font-bold text-white">{item.title}</span>
                  {item.releaseYear > 0 && <span>· {item.releaseYear}</span>}
                  {item.maturityRating && <span>· {item.maturityRating}</span>}
                  {realImdbRating && (
                    <span className="text-[#FFC400] font-bold">
                      · ★ {realImdbRating}
                    </span>
                  )}
                </div>
                {item.synopsis && (
                  <p className="text-xs text-[#A7A9B4] line-clamp-2 leading-relaxed max-w-4xl">
                    {item.synopsis}
                  </p>
                )}
              </div>

              {item.genres && item.genres.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  {item.genres.slice(0, 4).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => onSelectGenre(g)}
                      className="px-2.5 py-1 rounded-lg bg-[#08090D] hover:bg-[#252832] border border-[#292C35] text-[11px] font-medium text-[#D4D6DF] hover:text-[#FFC400] cursor-pointer transition-colors"
                    >
                      {g}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.section>
        )}

        {/* =========================================================
            MORE LIKE THIS (Clean, Focused Recommendations)
        ========================================================= */}
        {relatedItems.length > 0 && (
          <section className="space-y-3 pt-1">
            <h2 className="text-base sm:text-xl font-bold text-white font-display">
              More Like This
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
              {relatedItems.slice(0, 6).map((rel) => (
                <MovieCard
                  key={rel.id}
                  item={rel}
                  inWatchlist={watchlistIds.includes(rel.id)}
                  onSelect={(m, auto) => onSelectMedia(m, auto, false)}
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
