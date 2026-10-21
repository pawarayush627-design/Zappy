import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Check,
  Play,
  Share2,
  Moon,
  Sun,
  Settings,
  Calendar,
  LayoutGrid,
  Clock,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Shield,
  Eye,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { MediaItem, PersonCredit } from '../types/media';
import { VideoPlayer } from './VideoPlayer';
import { MovieCard } from './MovieCard';
import { AdBanner } from './AdBanner';
import { MediaArtwork } from './MediaArtwork';

export interface TvEpisodeInfo {
  episodeNumber: number;
  title: string;
  overview: string;
  runtime: number;
  airDate?: string;
  stillUrl?: string;
}

export interface TvSeasonInfo {
  seasonNumber: number;
  episodeCount: number;
  episodes: TvEpisodeInfo[];
}

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
  onBack: () => void;
  onSelectMedia: (item: MediaItem, autoPlay?: boolean) => void;
  onToggleWatchlist: (item: MediaItem, e: React.MouseEvent) => void;
  onMarkWatched: (item: MediaItem) => void;
  onSelectGenre: (genre: string) => void;
  onToggleAds: () => void;
  onOpenAdPolicy: () => void;
  onOpenAdminStudio: (mediaItem: MediaItem) => void;
  onPublishPreviewDraft?: () => void;
  onReturnToAdminStudio?: () => void;
}

function buildFallbackAvatarDataUri(
  name: string,
  role: 'DIRECTOR' | 'ACTOR'
): string {
  const parts = name.trim().split(/\s+/);
  const initials =
    parts.length >= 2
      ? `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase()
      : (name.slice(0, 2) || 'ZP').toUpperCase();
  const bg1 = role === 'DIRECTOR' ? '#E50000' : '#262626';
  const bg2 = '#141414';
  const accent = '#E50000';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240" width="200" height="240">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${bg1}"/>
        <stop offset="100%" stop-color="${bg2}"/>
      </linearGradient>
    </defs>
    <rect width="200" height="240" rx="24" fill="url(#g)"/>
    <circle cx="100" cy="88" r="38" fill="${accent}" fill-opacity="0.18" stroke="${accent}" stroke-width="2"/>
    <path d="M44 206 C44 162 156 162 156 206" fill="${accent}" fill-opacity="0.14" stroke="${accent}" stroke-width="2"/>
    <text x="100" y="98" text-anchor="middle" fill="#FFFFFF" font-family="system-ui, sans-serif" font-weight="700" font-size="26">${initials}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const DetailsView: React.FC<DetailsViewProps> = ({
  item,
  relatedItems,
  watchlistIds,
  inWatchlist,
  isCompleted = false,
  autoPlayInitial = false,
  adsEnabled,
  isAdmin = false,
  isPreviewDraft = false,
  isPublishingDraft = false,
  onBack,
  onSelectMedia,
  onToggleWatchlist,
  onMarkWatched,
  onSelectGenre,
  onToggleAds,
  onOpenAdPolicy,
  onOpenAdminStudio,
  onPublishPreviewDraft,
  onReturnToAdminStudio,
}) => {
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [selectedEpisodeNumber, setSelectedEpisodeNumber] = useState<number>(1);
  const [openSeasonAccordion, setOpenSeasonAccordion] = useState<number>(1);
  const [lightsOff, setLightsOff] = useState(false);
  const [copiedNotice, setCopiedNotice] = useState(false);

  const [verifiedSeasons, setVerifiedSeasons] = useState<TvSeasonInfo[]>([]);
  const [isLoadingSeasons, setIsLoadingSeasons] = useState<boolean>(false);

  const castScrollRef = useRef<HTMLDivElement>(null);

  const isSeries = item.contentType === 'series' || item.mediaType === 'tv';

  useEffect(() => {
    setSelectedSeason(1);
    setSelectedEpisodeNumber(1);
    setOpenSeasonAccordion(1);
    setVerifiedSeasons([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [item.id, item.title]);

  // Only fetch verified per-season episode lists for TV Series (never for movies, and never touches VideoPlayer)
  useEffect(() => {
    if (!isSeries) {
      setIsLoadingSeasons(false);
      return;
    }

    let cancelled = false;
    const rawEmbed = (item.cinesrcEmbedUrl || '').trim();
    const existingImdbMatch = rawEmbed.match(/(tt\d{5,12})/i);
    const existingImdb = existingImdbMatch?.[1]
      ? existingImdbMatch[1].toLowerCase()
      : '';

    const params = new URLSearchParams({
      title: item.title,
      mediaType: 'tv',
      year: String(item.releaseYear || ''),
    });
    if (item.tmdbId && item.tmdbId !== 10000) {
      params.set('tmdbId', String(item.tmdbId));
    }
    if (existingImdb) {
      params.set('imdbId', existingImdb);
    }

    setIsLoadingSeasons(true);

    fetch(`/api/tv-info?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        if (Array.isArray(data.seasons) && data.seasons.length > 0) {
          setVerifiedSeasons(data.seasons);
        }
      })
      .catch(() => {
        // Ignore fetch error and use item fallback
      })
      .finally(() => {
        if (!cancelled) setIsLoadingSeasons(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    item.id,
    item.title,
    item.releaseYear,
    item.tmdbId,
    item.cinesrcEmbedUrl,
    isSeries,
  ]);

  // Build effective seasons list (uses verified aired seasons from TVMaze/JustWatch when available)
  const seasonsList: TvSeasonInfo[] = useMemo(() => {
    if (!isSeries) return [];
    if (verifiedSeasons.length > 0) {
      return verifiedSeasons;
    }
    const fallbackSeasonCount = Math.max(1, item.seasonsCount || 1);
    const fallbackEpCount = Math.max(1, item.episodesCount || 8);
    return Array.from({ length: fallbackSeasonCount }, (_, sIdx) => {
      const sNum = sIdx + 1;
      return {
        seasonNumber: sNum,
        episodeCount: fallbackEpCount,
        episodes: Array.from({ length: fallbackEpCount }, (_, eIdx) => ({
          episodeNumber: eIdx + 1,
          title: `Episode ${eIdx + 1} — ${item.title}`,
          overview: item.synopsis,
          runtime: Math.max(24, item.durationMinutes || 45),
        })),
      };
    });
  }, [
    isSeries,
    verifiedSeasons,
    item.seasonsCount,
    item.episodesCount,
    item.title,
    item.synopsis,
    item.durationMinutes,
  ]);

  const totalSeasons = isSeries ? Math.max(1, seasonsList.length) : 1;
  const currentSeasonObj = useMemo(() => {
    if (!isSeries) return null;
    return (
      seasonsList.find((s) => s.seasonNumber === selectedSeason) ||
      seasonsList[0] ||
      null
    );
  }, [isSeries, seasonsList, selectedSeason]);

  const currentSeasonEpisodesCount = currentSeasonObj
    ? Math.max(1, currentSeasonObj.episodeCount)
    : Math.max(1, item.episodesCount || 8);

  // Clamp selectedSeason and selectedEpisodeNumber if verified season data has fewer episodes
  useEffect(() => {
    if (!isSeries || seasonsList.length === 0) return;
    const validSeason = seasonsList.find(
      (s) => s.seasonNumber === selectedSeason
    );
    if (!validSeason) {
      const firstS = seasonsList[0].seasonNumber;
      setSelectedSeason(firstS);
      setOpenSeasonAccordion(firstS);
      setSelectedEpisodeNumber(1);
    } else if (selectedEpisodeNumber > validSeason.episodeCount) {
      setSelectedEpisodeNumber(1);
    }
  }, [isSeries, seasonsList, selectedSeason, selectedEpisodeNumber]);

  const activeEpisodeObj = useMemo(() => {
    if (!currentSeasonObj) return null;
    return (
      currentSeasonObj.episodes.find(
        (ep) => ep.episodeNumber === selectedEpisodeNumber
      ) || null
    );
  }, [currentSeasonObj, selectedEpisodeNumber]);

  // Build unified Cast & Director profile list with photos
  const displayCredits: PersonCredit[] = useMemo(() => {
    if (Array.isArray(item.credits) && item.credits.length > 0) {
      return item.credits.map((c) => ({
        ...c,
        imageUrl: c.imageUrl || buildFallbackAvatarDataUri(c.name, c.role),
      }));
    }

    const fallbackList: PersonCredit[] = [];
    if (item.directorOrCreator) {
      item.directorOrCreator
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((dirName) => {
          fallbackList.push({
            name: dirName,
            role: 'DIRECTOR',
            characterName: 'Director / Creator',
            imageUrl: buildFallbackAvatarDataUri(dirName, 'DIRECTOR'),
          });
        });
    }
    if (Array.isArray(item.cast)) {
      item.cast.forEach((actorName) => {
        if (actorName && actorName.trim()) {
          fallbackList.push({
            name: actorName.trim(),
            role: 'ACTOR',
            characterName: 'Cast Member',
            imageUrl: buildFallbackAvatarDataUri(actorName.trim(), 'ACTOR'),
          });
        }
      });
    }
    return fallbackList;
  }, [item.credits, item.directorOrCreator, item.cast]);

  const directorProfile = useMemo(() => {
    const found = displayCredits.find((c) => c.role === 'DIRECTOR');
    if (found) return found;
    return {
      name: item.directorOrCreator || 'Featured Director',
      role: 'DIRECTOR' as const,
      characterName: 'Director',
      imageUrl: buildFallbackAvatarDataUri(
        item.directorOrCreator || 'Director',
        'DIRECTOR'
      ),
    };
  }, [displayCredits, item.directorOrCreator]);

  const castProfiles = useMemo(() => {
    const actors = displayCredits.filter((c) => c.role === 'ACTOR');
    return actors.length > 0 ? actors : displayCredits;
  }, [displayCredits]);

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

  const handleScrollCast = (dir: 'left' | 'right') => {
    const el = castScrollRef.current;
    if (!el) return;
    el.scrollBy({
      left: dir === 'left' ? -320 : 320,
      behavior: 'smooth',
    });
  };

  return (
    <div className="relative overflow-x-hidden">
      {/* Optional Theater Dimmer Overlay */}
      {lightsOff && (
        <div
          onClick={() => setLightsOff(false)}
          className="fixed inset-0 bg-black/92 z-30 transition-opacity cursor-pointer"
          aria-hidden="true"
        />
      )}

      <div className="max-w-7xl mx-auto space-y-6">
        {/* ADMIN UNPUBLISHED DRAFT PREVIEW BAR */}
        {isPreviewDraft && (
          <div className="rounded-2xl bg-gradient-to-r from-[#2D1E4A] via-[#1E1533] to-[#1A1429] border-2 border-[#B892FF]/60 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-2xl relative z-40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#B892FF]/20 border border-[#B892FF]/40 text-[#B892FF] flex items-center justify-center shrink-0">
                <Eye className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-[#B892FF] text-[#110E17] text-[10px] font-extrabold uppercase tracking-wider">
                    Admin Draft Preview
                  </span>
                  <h2 className="text-sm sm:text-base font-bold text-white font-display">
                    Previewing &ldquo;{item.title}&rdquo; Before Publishing
                  </h2>
                </div>
                <p className="text-xs text-zinc-300 mt-0.5">
                  Test the video player, episodes, artwork, and cast below. Click &ldquo;Publish Now&rdquo; when ready to make it live for all users.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {onReturnToAdminStudio && (
                <button
                  type="button"
                  onClick={onReturnToAdminStudio}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-bold text-white flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Admin Editor</span>
                </button>
              )}
              {onPublishPreviewDraft && (
                <button
                  type="button"
                  disabled={isPublishingDraft}
                  onClick={onPublishPreviewDraft}
                  className="min-h-[42px] px-5 py-2 rounded-xl bg-[#E50000] hover:bg-[#FF1A1A] text-white text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-[#E50000]/30 transition-colors disabled:opacity-60"
                >
                  {isPublishingDraft ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Publishing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Publish Now to App</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Top Utility & Navigation Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-40">
          <div className="flex items-center gap-3 text-xs sm:text-sm text-[#999999] min-w-0">
            <button
              type="button"
              onClick={
                isPreviewDraft && onReturnToAdminStudio
                  ? onReturnToAdminStudio
                  : onBack
              }
              className="min-h-[40px] px-4 py-2 rounded-lg bg-[#1A1A1A] border border-[#262626] text-white hover:border-[#E50000] transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-[#E50000]" />
              <span>{isPreviewDraft ? 'Back to Editor' : 'Back'}</span>
            </button>
            <span className="text-[#E50000] font-bold uppercase shrink-0">
              {isSeries ? 'Series' : 'Movie'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-white font-bold truncate min-w-0">
              {item.title}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && !isPreviewDraft && (
              <button
                type="button"
                onClick={() => onOpenAdminStudio(item)}
                className="min-h-[40px] px-3.5 py-2 rounded-lg bg-[#1A1A1A] border border-[#E50000]/50 text-xs font-semibold text-white hover:bg-[#E50000]/20 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5 text-[#E50000]" />
                <span>Edit in Admin Studio</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setLightsOff((prev) => !prev)}
              className="min-h-[40px] px-3.5 py-2 rounded-lg bg-[#1A1A1A] border border-[#262626] text-xs font-medium text-[#BFBFBF] hover:text-white transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {lightsOff ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-[#E50000]" />
                  <span>Lights On</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-[#E50000]" />
                  <span>Theater Mode</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleShare}
              className="min-h-[40px] px-3.5 py-2 rounded-lg bg-[#1A1A1A] border border-[#262626] text-xs font-medium text-[#BFBFBF] hover:text-white transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{copiedNotice ? 'Copied!' : 'Share'}</span>
            </button>

            <button
              type="button"
              onClick={() => onMarkWatched(item)}
              className={`min-h-[40px] px-3.5 py-2 rounded-lg border text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                isCompleted
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : 'bg-[#1A1A1A] border-[#262626] text-white hover:border-[#E50000]'
              }`}
              title="Mark as watched (automatically removes from Watchlist)"
            >
              <CheckCircle2 className="w-4 h-4 text-[#E50000]" />
              <span>{isCompleted ? 'Watched' : 'Finish / Mark Watched'}</span>
            </button>

            <button
              type="button"
              onClick={(e) => onToggleWatchlist(item, e)}
              className={`min-h-[40px] px-4 py-2 rounded-lg border text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                inWatchlist
                  ? 'bg-[#1A1A1A] border-[#E50000] text-[#E50000]'
                  : 'bg-[#E50000] border-[#E50000] text-white hover:bg-[#FF1A1A]'
              }`}
            >
              {inWatchlist ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>In Watchlist</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Add to Watchlist</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Embedded Video Player */}
        <section aria-label="Video Player" className="relative z-40">
          <VideoPlayer
            item={item}
            autoPlay={autoPlayInitial}
            selectedSeason={selectedSeason}
            selectedEpisodeNumber={selectedEpisodeNumber}
            isCompleted={isCompleted}
            onMarkWatched={() => onMarkWatched(item)}
            episodeTitle={
              isSeries
                ? activeEpisodeObj?.title ||
                  `Season ${String(selectedSeason).padStart(2, '0')} · Episode ${String(
                    selectedEpisodeNumber
                  ).padStart(2, '0')}`
                : undefined
            }
            onNextEpisode={
              isSeries
                ? () => {
                    if (selectedEpisodeNumber < currentSeasonEpisodesCount) {
                      setSelectedEpisodeNumber((prev) => prev + 1);
                    } else {
                      const currentIdx = seasonsList.findIndex(
                        (s) => s.seasonNumber === selectedSeason
                      );
                      const nextSeasonObj =
                        currentIdx >= 0
                          ? seasonsList[currentIdx + 1]
                          : undefined;
                      if (nextSeasonObj) {
                        setSelectedSeason(nextSeasonObj.seasonNumber);
                        setOpenSeasonAccordion(nextSeasonObj.seasonNumber);
                        setSelectedEpisodeNumber(1);
                      } else {
                        onMarkWatched(item);
                      }
                    }
                  }
                : undefined
            }
          />
        </section>

        {/* 2-COLUMN DETAILS LAYOUT (Only Authentic Extracted Data) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN (8 Cols): Seasons & Episodes Accordion (for Shows) + Description + Cast */}
          <div className="lg:col-span-8 space-y-6">
            {/* SHOW OPEN PAGE: Seasons and Episodes Accordion Box */}
            {isSeries && (
              <div className="rounded-xl bg-[#1A1A1A] border border-[#262626] p-5 sm:p-8 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg sm:text-xl font-bold text-white font-display">
                    Seasons and Episodes
                  </h2>
                  {isLoadingSeasons && (
                    <span className="text-xs text-[#999999] flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#E50000]" />
                      <span>Syncing verified episodes...</span>
                    </span>
                  )}
                </div>

                <div className="space-y-4">
                  {seasonsList.map((seasonObj) => {
                    const sNum = seasonObj.seasonNumber;
                    const isOpen = openSeasonAccordion === sNum;
                    return (
                      <div
                        key={sNum}
                        className="rounded-xl bg-[#0F0F0F] border border-[#262626] overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setOpenSeasonAccordion(isOpen ? 0 : sNum)
                          }
                          className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left cursor-pointer hover:bg-[#141414] transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-base sm:text-lg font-bold text-white font-display">
                              Season {String(sNum).padStart(2, '0')}
                            </span>
                            <span className="text-xs sm:text-sm font-medium text-[#999999] tabular-nums">
                              {seasonObj.episodeCount} Episode
                              {seasonObj.episodeCount > 1 ? 's' : ''}
                            </span>
                          </div>

                          <div className="w-10 h-10 rounded-full bg-[#141414] border border-[#262626] text-[#999999] flex items-center justify-center shrink-0">
                            {isOpen ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </div>
                        </button>

                        <AnimatePresence>
                          {isOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="px-5 pb-4 divide-y divide-[#262626]"
                            >
                              {seasonObj.episodes.map((ep) => {
                                const epNum = ep.episodeNumber;
                                const isPlayingThis =
                                  selectedSeason === sNum &&
                                  selectedEpisodeNumber === epNum;
                                return (
                                  <div
                                    key={epNum}
                                    onClick={() => {
                                      setSelectedSeason(sNum);
                                      setSelectedEpisodeNumber(epNum);
                                      window.scrollTo({
                                        top: 0,
                                        behavior: 'smooth',
                                      });
                                    }}
                                    className={`py-4 flex flex-col sm:flex-row sm:items-center gap-4 cursor-pointer group transition-colors ${
                                      isPlayingThis
                                        ? 'bg-[#E50000]/[0.06] -mx-3 px-3 rounded-xl'
                                        : ''
                                    }`}
                                  >
                                    <span
                                      className={`text-xl font-bold font-mono-tabular w-8 shrink-0 ${
                                        isPlayingThis
                                          ? 'text-[#E50000]'
                                          : 'text-[#999999]'
                                      }`}
                                    >
                                      {String(epNum).padStart(2, '0')}
                                    </span>

                                    <div className="relative w-36 h-20 rounded-xl overflow-hidden border border-[#262626] shrink-0 bg-[#141414]">
                                      <MediaArtwork
                                        src={
                                          ep.stillUrl ||
                                          item.backdropUrl ||
                                          item.posterUrl
                                        }
                                        alt={ep.title}
                                        item={item}
                                        aspectRatio="backdrop"
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                      />
                                      <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
                                        <div
                                          className={`w-9 h-9 rounded-full flex items-center justify-center ${
                                            isPlayingThis
                                              ? 'bg-[#E50000] text-white'
                                              : 'bg-black/70 text-white group-hover:bg-[#E50000]'
                                          } transition-colors`}
                                        >
                                          <Play className="w-4 h-4 fill-current ml-0.5" />
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex-1 min-w-0 space-y-1.5">
                                      <div className="flex items-center justify-between gap-2">
                                        <h3 className="text-sm sm:text-base font-semibold text-white group-hover:text-[#E50000] transition-colors truncate">
                                          {ep.title.startsWith('Episode')
                                            ? ep.title
                                            : `Episode ${epNum} — ${ep.title}`}
                                          {isPlayingThis ? ' (Playing)' : ''}
                                        </h3>
                                        <span className="text-xs text-[#999999] tabular-nums shrink-0">
                                          {ep.runtime ||
                                            Math.max(
                                              24,
                                              item.durationMinutes || 45
                                            )}{' '}
                                          min
                                        </span>
                                      </div>
                                      <p className="text-xs text-[#999999] line-clamp-2 leading-relaxed">
                                        {ep.overview || item.synopsis}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Description Card */}
            <div className="rounded-xl bg-[#1A1A1A] border border-[#262626] p-5 sm:p-8 space-y-2.5">
              <h2 className="text-sm sm:text-base font-medium text-[#999999]">
                Description
              </h2>
              <p className="text-sm sm:text-base text-white leading-relaxed">
                {item.synopsis}
              </p>
            </div>

            {/* Cast Carousel Card */}
            <div className="rounded-xl bg-[#1A1A1A] border border-[#262626] p-5 sm:p-8 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm sm:text-base font-medium text-[#999999]">
                  Cast & Crew ({castProfiles.length})
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleScrollCast('left')}
                    className="w-10 h-10 rounded-full bg-[#141414] hover:bg-[#262626] border border-[#262626] text-[#999999] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                    aria-label="Scroll cast left"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleScrollCast('right')}
                    className="w-10 h-10 rounded-full bg-[#141414] hover:bg-[#262626] border border-[#262626] text-[#999999] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div
                ref={castScrollRef}
                className="flex gap-3.5 overflow-x-auto no-scrollbar pb-1"
              >
                {castProfiles.map((person, index) => (
                  <div
                    key={`${person.name}-${index}`}
                    className="w-24 sm:w-28 shrink-0 space-y-2"
                  >
                    <div className="aspect-[4/4.5] w-full rounded-xl overflow-hidden bg-[#141414] border border-[#262626]">
                      <img
                        src={person.imageUrl}
                        alt={person.name}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          const target = e.currentTarget;
                          target.onerror = null;
                          target.src = buildFallbackAvatarDataUri(
                            person.name,
                            person.role
                          );
                        }}
                        className="w-full h-full object-cover object-top"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">
                        {person.name}
                      </p>
                      <p className="text-[10px] text-[#999999] truncate">
                        {person.characterName || 'Cast'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT SIDEBAR COLUMN (4 Cols): Real Extracted Metadata Only */}
          <aside className="lg:col-span-4 rounded-xl bg-[#1A1A1A] border border-[#262626] p-5 sm:p-8 space-y-6">
            {/* Released Year */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-medium text-[#999999]">
                <Calendar className="w-4 h-4" />
                <span>Released Year</span>
              </div>
              <p className="text-base sm:text-lg font-bold text-white tabular-nums">
                {item.releaseYear}
              </p>
            </div>

            {/* Runtime & Format */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-medium text-[#999999]">
                <Clock className="w-4 h-4" />
                <span>{isSeries ? 'Format & Episodes' : 'Runtime'}</span>
              </div>
              <p className="text-sm sm:text-base font-semibold text-white tabular-nums">
                {isSeries
                  ? `${totalSeasons} Season${
                      totalSeasons > 1 ? 's' : ''
                    } · ${currentSeasonEpisodesCount} Episodes (${item.durationMinutes}m / ep)`
                  : `${item.durationMinutes} Minutes`}
              </p>
            </div>

            {/* Content Certification */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-medium text-[#999999]">
                <Shield className="w-4 h-4" />
                <span>Age Rating</span>
              </div>
              <p className="text-sm sm:text-base font-semibold text-white">
                {item.maturityRating}
              </p>
            </div>

            {/* Genres */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-sm font-medium text-[#999999]">
                <LayoutGrid className="w-4 h-4" />
                <span>Genres</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {item.genres.map((genre) => (
                  <button
                    key={genre}
                    type="button"
                    onClick={() => onSelectGenre(genre)}
                    className="px-3 py-1.5 rounded-lg bg-[#141414] hover:border-[#E50000] border border-[#262626] text-xs font-medium text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {genre}
                  </button>
                ))}
              </div>
            </div>

            {/* Director Card with Photo */}
            <div className="space-y-2.5">
              <span className="text-sm font-medium text-[#999999] block">
                Director / Creator
              </span>
              <div className="p-3 rounded-xl bg-[#141414] border border-[#262626] flex items-center gap-3">
                <img
                  src={directorProfile.imageUrl}
                  alt={directorProfile.name}
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded-lg object-cover border border-[#262626] shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {directorProfile.name}
                  </p>
                  <p className="text-xs text-[#999999] truncate">
                    {directorProfile.characterName || 'Director'}
                  </p>
                </div>
              </div>
            </div>

            {/* Lead Cast Card */}
            {castProfiles[0] && (
              <div className="space-y-2.5">
                <span className="text-sm font-medium text-[#999999] block">
                  Lead Cast
                </span>
                <div className="p-3 rounded-xl bg-[#141414] border border-[#262626] flex items-center gap-3">
                  <img
                    src={castProfiles[0].imageUrl}
                    alt={castProfiles[0].name}
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 rounded-lg object-cover border border-[#262626] shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">
                      {castProfiles[0].name}
                    </p>
                    <p className="text-xs text-[#999999] truncate">
                      {castProfiles[0].characterName || 'Starring'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </aside>
        </div>

        <AdBanner
          enabled={adsEnabled}
          slotId="WATCH-COMPANION-02"
          placementLabel="Watch Page Companion Display Slot"
          onToggleAds={onToggleAds}
          onOpenAdPolicy={onOpenAdPolicy}
        />

        {relatedItems.length > 0 && (
          <section
            className="space-y-4 pt-4 border-t border-[#262626]"
            aria-label="More Like This"
          >
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white font-display">
                More Like This
              </h2>
              <p className="text-xs sm:text-sm text-[#999999] mt-0.5">
                Recommended movies and shows from the catalog
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
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
    </div>
  );
};
