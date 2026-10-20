import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Plus,
  Check,
  Play,
  Share2,
  Tv,
  Film,
  Server,
  Moon,
  Sun,
  Star,
} from 'lucide-react';
import { MediaItem, EpisodeInfo } from '../types/media';
import { getAuthorizedVideoSource } from '../data/videoSources';
import { VideoPlayer } from './VideoPlayer';
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
  onBack: () => void;
  onSelectMedia: (item: MediaItem, autoPlay?: boolean) => void;
  onToggleWatchlist: (item: MediaItem, e: React.MouseEvent) => void;
  onSelectGenre: (genre: string) => void;
  onToggleAds: () => void;
  onOpenAdPolicy: () => void;
}

export const DetailsView: React.FC<DetailsViewProps> = ({
  item,
  relatedItems,
  watchlistIds,
  inWatchlist,
  autoPlayInitial = false,
  adsEnabled,
  onBack,
  onSelectMedia,
  onToggleWatchlist,
  onSelectGenre,
  onToggleAds,
  onOpenAdPolicy,
}) => {
  const [selectedEpisode, setSelectedEpisode] = useState<EpisodeInfo | null>(
    item.episodes && item.episodes.length > 0 ? item.episodes[0] : null
  );
  const [activeServerTab, setActiveServerTab] = useState<'primary' | 'mirror'>('primary');
  const [lightsOff, setLightsOff] = useState(false);
  const [copiedNotice, setCopiedNotice] = useState(false);

  useEffect(() => {
    setSelectedEpisode(item.episodes && item.episodes.length > 0 ? item.episodes[0] : null);
    setActiveServerTab('primary');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [item.id]);

  const activeSourceId = selectedEpisode
    ? selectedEpisode.playableSourceId
    : item.videoSourceId;

  const baseVideoSource = getAuthorizedVideoSource(activeSourceId);

  // Allow switching between Primary HD Server and Secondary Mirror Server
  const videoSource = baseVideoSource
    ? {
        ...baseVideoSource,
        primaryMp4Url:
          activeServerTab === 'mirror' && baseVideoSource.fallbackMp4Url
            ? baseVideoSource.fallbackMp4Url
            : baseVideoSource.primaryMp4Url,
      }
    : null;

  const ratingScore = ((item.popularScore || 88) / 10).toFixed(1);

  const handleShare = () => {
    const shareUrl = `${window.location.origin}/?title=${encodeURIComponent(item.id)}`;
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
    <div className="relative overflow-x-hidden">
      {/* Optional Theater "Turn Off Lights" Dimmer Overlay */}
      {lightsOff && (
        <div
          onClick={() => setLightsOff(false)}
          className="fixed inset-0 bg-black/90 z-30 transition-opacity cursor-pointer"
          aria-hidden="true"
        />
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6 sm:space-y-8">
        {/* Top Portal Breadcrumb & Utility Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-40">
          <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-zinc-400 min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#121217] border border-white/10 text-zinc-200 hover:text-white hover:border-[#FF6B00] transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-[#FF6B00]" />
              <span>Back</span>
            </button>
            <span aria-hidden="true" className="shrink-0">/</span>
            <span className="text-zinc-300 shrink-0">
              {item.contentType === 'series' ? 'TV-Series' : 'Movies'}
            </span>
            <span aria-hidden="true" className="shrink-0">/</span>
            <span className="text-white font-semibold truncate min-w-0">
              {item.title}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setLightsOff((prev) => !prev)}
              className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#121217] border border-white/10 text-xs font-medium text-zinc-300 hover:text-white transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {lightsOff ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-[#FF6B00]" />
                  <span>Lights On</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-[#FF6B00]" />
                  <span>Lights Off</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleShare}
              className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#121217] border border-white/10 text-xs font-medium text-zinc-300 hover:text-white transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{copiedNotice ? 'Copied!' : 'Share'}</span>
            </button>

            <button
              type="button"
              onClick={(e) => onToggleWatchlist(item, e)}
              className={`min-h-[42px] px-4 py-2 rounded-xl border text-xs font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                inWatchlist
                  ? 'bg-[#FF6B00]/15 border-[#FF6B00] text-[#FF8533]'
                  : 'bg-[#FF6B00] border-[#FF6B00] text-black hover:bg-[#FF8533]'
              }`}
            >
              {inWatchlist ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>In My List</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Add to List</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Theater Video Player + Multi-Server Switcher Bar */}
        <section aria-label="Video Player" className="relative z-40 space-y-3">
          <VideoPlayer
            item={item}
            videoSource={videoSource}
            episodeTitle={
              selectedEpisode
                ? `S${selectedEpisode.seasonNumber}:E${selectedEpisode.episodeNumber} "${selectedEpisode.title}"`
                : undefined
            }
            autoPlay={autoPlayInitial}
          />

          {/* Stream Server Switcher Bar */}
          <div className="rounded-xl bg-[#111116] border border-white/10 p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <Server className="w-4 h-4 text-[#FF6B00] shrink-0" />
              <span>
                If current server doesn&rsquo;t load, select another authorized stream server:
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!baseVideoSource}
                onClick={() => setActiveServerTab('primary')}
                className={`min-h-[40px] px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  activeServerTab === 'primary' && baseVideoSource
                    ? 'bg-[#FF6B00] text-black'
                    : 'bg-[#181820] text-zinc-300 border border-white/10 hover:text-white'
                }`}
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Server 1: CineWave Primary HD</span>
              </button>

              <button
                type="button"
                disabled={!baseVideoSource}
                onClick={() => setActiveServerTab('mirror')}
                className={`min-h-[40px] px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  activeServerTab === 'mirror' && baseVideoSource
                    ? 'bg-[#FF6B00] text-black'
                    : 'bg-[#181820] text-zinc-300 border border-white/10 hover:text-white'
                }`}
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Server 2: OpenBackup Mirror</span>
              </button>
            </div>
          </div>
        </section>

        {/* TV Series Season & Episode Selector */}
        {item.contentType === 'series' && item.episodes && item.episodes.length > 0 && (
          <section className="rounded-2xl bg-[#101015] border border-white/10 p-4 sm:p-5 space-y-4" aria-label="Episodes">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg sm:text-xl font-bold text-white font-display flex items-center gap-2">
                <Tv className="w-5 h-5 text-[#FF6B00]" />
                <span>Seasons & Episodes</span>
              </h2>
              <span className="text-xs text-zinc-400 font-mono-tabular">
                {item.seasonsCount || 1} Seasons · {item.episodes.length} Listed Episodes
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {item.episodes.map((ep) => {
                const isSelected =
                  selectedEpisode?.seasonNumber === ep.seasonNumber &&
                  selectedEpisode?.episodeNumber === ep.episodeNumber;
                const epHasStream = Boolean(ep.playableSourceId);

                return (
                  <button
                    key={`s${ep.seasonNumber}e${ep.episodeNumber}`}
                    type="button"
                    onClick={() => {
                      setSelectedEpisode(ep);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className={`text-left p-3.5 rounded-xl border transition-colors cursor-pointer flex items-start justify-between gap-3 ${
                      isSelected
                        ? 'bg-[#1C1612] border-[#FF6B00]'
                        : 'bg-[#14141B] border-white/10 hover:border-white/25'
                    }`}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono-tabular">
                        <span className="text-[#FF6B00] font-bold">
                          Eps {ep.episodeNumber} (S{ep.seasonNumber})
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{ep.durationMinutes}m</span>
                        <span aria-hidden="true">·</span>
                        <span>{epHasStream ? 'HD Stream' : 'Preview'}</span>
                      </div>
                      <h3 className="text-sm font-bold text-white truncate font-display">
                        {ep.title}
                      </h3>
                      <p className="text-xs text-zinc-400 line-clamp-2">
                        {ep.synopsis}
                      </p>
                    </div>

                    <div className="min-h-[40px] min-w-[40px] rounded-lg bg-zinc-900 border border-white/10 flex items-center justify-center shrink-0 text-zinc-200">
                      {epHasStream ? (
                        <Play className="w-4 h-4 text-[#FF6B00] fill-current" />
                      ) : (
                        <Film className="w-4 h-4 text-zinc-500" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Portal Movie Info Card (Left Poster + Right Detailed Metadata Table) */}
        <section className="rounded-2xl bg-[#101015] border border-white/10 p-4 sm:p-7 grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8 items-start">
          {/* Left Poster Thumbnail (Compact on mobile, 3 cols on desktop) */}
          <div className="md:col-span-3 w-36 sm:w-44 md:w-full shrink-0">
            <div className="rounded-xl overflow-hidden border border-white/15 aspect-[3/4]">
              <MediaArtwork
                src={item.posterUrl}
                alt={item.title}
                item={item}
                aspectRatio="poster"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Right Complete Metadata Sheet (9 cols) */}
          <div className="md:col-span-9 space-y-4 min-w-0">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm text-zinc-300 font-mono-tabular">
              <span className="text-[#FF6B00] font-bold">
                {item.availabilityStatus === 'playable_demo' ? 'HD · FREE STREAM' : 'CATALOG PREVIEW'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="flex items-center gap-1 text-[#FF8533]">
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

            {/* Two-Column Portal Metadata Directory */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-8 pt-3 border-t border-white/10 text-xs sm:text-sm">
              <div>
                <span className="text-zinc-500">Type: </span>
                <span className="text-zinc-200 font-medium">
                  {item.contentType === 'series' ? 'TV-Series' : 'Movie'}
                </span>
              </div>
              <div>
                <span className="text-zinc-500">Release Year: </span>
                <span className="text-zinc-200 font-mono-tabular">{item.releaseYear}</span>
              </div>
              <div>
                <span className="text-zinc-500">Director / Creator: </span>
                <span className="text-zinc-200 font-medium">{item.directorOrCreator}</span>
              </div>
              <div>
                <span className="text-zinc-500">Duration: </span>
                <span className="text-zinc-200 font-mono-tabular">{item.durationMinutes} min</span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-zinc-500">Casts: </span>
                <span className="text-zinc-200">{item.cast.join(', ')}</span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-zinc-500">Stream Status: </span>
                <span className="text-zinc-300 font-mono-tabular">{item.availabilityNote}</span>
              </div>
            </div>

            {/* Clickable Genre Filter Buttons */}
            <div className="pt-2 flex flex-wrap items-center gap-2">
              <span className="text-xs text-zinc-500 mr-1">Genres:</span>
              {item.genres.map((genre) => (
                <button
                  key={genre}
                  type="button"
                  onClick={() => onSelectGenre(genre)}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[#16161E] border border-white/10 text-xs font-medium text-zinc-200 hover:border-[#FF6B00] hover:text-[#FF6B00] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {genre}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Clearly Separated Ad Slot Placeholder */}
        <AdBanner
          enabled={adsEnabled}
          slotId="CW-DETAILS-BELOW-FOLD-02"
          placementLabel="Watch Page Companion Slot (Separated From Playback Controls)"
          onToggleAds={onToggleAds}
          onOpenAdPolicy={onOpenAdPolicy}
        />

        {/* You May Also Like / Related Titles Grid */}
        <section className="space-y-4 pt-2 border-t border-white/10" aria-label="You May Also Like">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white font-display">
              You May Also Like
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
              Recommended movies and TV-series similar to {item.title}
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
      </div>
    </div>
  );
};
