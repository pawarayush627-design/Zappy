import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  RotateCcw,
  RotateCw,
  AlertCircle,
  Loader2,
  Film,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { MediaItem, VideoSourceRecord } from '../types/media';

interface VideoPlayerProps {
  item: MediaItem;
  videoSource: VideoSourceRecord | null;
  episodeTitle?: string;
  autoPlay?: boolean;
}

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5];

function formatTimecode(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  item,
  videoSource,
  episodeTitle,
  autoPlay = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(Boolean(videoSource));
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(videoSource?.durationSeconds || 0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [useFallbackMirror, setUseFallbackMirror] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const activeStreamUrl = videoSource
    ? useFallbackMirror && videoSource.fallbackMp4Url
      ? videoSource.fallbackMp4Url
      : videoSource.primaryMp4Url
    : '';

  // Reset player state when item, videoSource, or episode changes
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setBufferedEnd(0);
    setUseFallbackMirror(false);
    setPlaybackError(null);
    setIsLoading(Boolean(videoSource));
    setDuration(videoSource?.durationSeconds || 0);
  }, [videoSource?.id, videoSource?.primaryMp4Url, episodeTitle, item.id]);

  // Listen to fullscreen state changes across standard and webkit prefixes
  useEffect(() => {
    const handleFsChange = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element };
      setIsFullscreen(Boolean(doc.fullscreenElement || doc.webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, []);

  const togglePlay = useCallback(() => {
    if (!videoSource) return;
    const video = videoRef.current;
    if (!video) return;

    if (video.paused || video.ended) {
      setPlaybackError(null);
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch((err: Error) => {
          setIsPlaying(false);
          setIsLoading(false);
          setPlaybackError(
            `Playback could not start (${err.name || 'StreamError'}). Please click Retry or switch to the backup authorized mirror.`
          );
        });
      }
    } else {
      video.pause();
    }
  }, [videoSource]);

  const seekToTime = useCallback(
    (targetSeconds: number) => {
      const video = videoRef.current;
      const maxDur =
        video && Number.isFinite(video.duration) && video.duration > 0
          ? video.duration
          : duration || 100;
      const clamped = Math.max(0, Math.min(maxDur, targetSeconds));
      setCurrentTime(clamped);
      if (video) {
        try {
          video.currentTime = clamped;
        } catch {
          // Ignore seek errors before metadata is ready
        }
      }
    },
    [duration]
  );

  const handleSeekInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = parseFloat(e.target.value);
    seekToTime(nextVal);
  };

  const skipSeconds = useCallback(
    (delta: number) => {
      const video = videoRef.current;
      const baseTime = video ? video.currentTime : currentTime;
      seekToTime(baseTime + delta);
    },
    [currentTime, seekToTime]
  );

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVol = Math.max(0, Math.min(1, parseFloat(e.target.value)));
    setVolume(nextVol);
    const nextMuted = nextVol === 0;
    setIsMuted(nextMuted);

    const video = videoRef.current;
    if (video) {
      video.volume = nextVol;
      video.muted = nextMuted;
    }
  };

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (video) {
      video.muted = nextMuted;
      if (!nextMuted && volume === 0) {
        setVolume(0.75);
        video.volume = 0.75;
      }
    }
  }, [isMuted, volume]);

  const changeSpeed = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  const cycleSpeedMobile = () => {
    const currentIndex = SPEED_OPTIONS.indexOf(playbackRate);
    const nextRate = SPEED_OPTIONS[(currentIndex + 1) % SPEED_OPTIONS.length];
    changeSpeed(nextRate);
  };

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current as
      | (HTMLDivElement & { webkitRequestFullscreen?: () => Promise<void> })
      | null;
    const video = videoRef.current as
      | (HTMLVideoElement & { webkitEnterFullscreen?: () => void })
      | null;
    const doc = document as Document & {
      webkitFullscreenElement?: Element;
      webkitExitFullscreen?: () => Promise<void>;
    };

    if (doc.fullscreenElement || doc.webkitFullscreenElement) {
      if (doc.exitFullscreen) {
        doc.exitFullscreen().catch(() => {});
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
      }
      return;
    }

    if (container?.requestFullscreen) {
      container.requestFullscreen().catch(() => {
        video?.webkitEnterFullscreen?.();
      });
    } else if (container?.webkitRequestFullscreen) {
      container.webkitRequestFullscreen();
    } else if (video?.webkitEnterFullscreen) {
      video.webkitEnterFullscreen();
    }
  }, []);

  // Keyboard shortcuts when player is focused
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!videoSource) return;
    if (e.key === ' ' || e.key.toLowerCase() === 'k') {
      e.preventDefault();
      togglePlay();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      skipSeconds(10);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      skipSeconds(-10);
    } else if (e.key.toLowerCase() === 'm') {
      e.preventDefault();
      toggleMute();
    } else if (e.key.toLowerCase() === 'f') {
      e.preventDefault();
      toggleFullscreen();
    }
  };

  const handleVideoError = () => {
    const video = videoRef.current;
    const errCode = video?.error?.code;
    let reason = 'The video stream could not be loaded or decoded.';
    if (errCode === 1) reason = 'Video playback was aborted by the browser (MEDIA_ERR_ABORTED).';
    if (errCode === 2) reason = 'A network error interrupted downloading the video stream (MEDIA_ERR_NETWORK).';
    if (errCode === 3) reason = 'The video stream encountered a decoding problem (MEDIA_ERR_DECODE).';
    if (errCode === 4) reason = 'The video source URL or format is unreachable or unsupported (MEDIA_ERR_SRC_NOT_SUPPORTED).';

    setIsLoading(false);
    setIsPlaying(false);
    setPlaybackError(reason);
  };

  const handleRetryStream = (switchMirror: boolean) => {
    setPlaybackError(null);
    setIsLoading(true);
    if (switchMirror) {
      setUseFallbackMirror((prev) => !prev);
    } else if (videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  };

  // Unavailable Video State (When a catalog title has no authorized video source)
  if (!videoSource) {
    return (
      <div className="relative min-h-[260px] sm:aspect-video w-full rounded-2xl overflow-hidden bg-[#111116] border border-white/10 flex flex-col items-center justify-center p-5 sm:p-6 text-center">
        <div
          className="absolute inset-0 opacity-25"
          style={{
            background: `radial-gradient(circle at 50% 35%, ${item.visualTheme.accentHex}44, ${item.visualTheme.primaryHex} 65%, #070709 100%)`,
          }}
        />
        <div className="relative z-10 max-w-lg space-y-3">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-zinc-900/90 border border-white/15 flex items-center justify-center mx-auto text-zinc-300">
            <Film className="w-5 h-5 sm:w-6 sm:h-6 text-[#FF6B00]" />
          </div>
          <h3 className="text-base sm:text-xl font-bold text-white font-display">
            Catalog Metadata Preview — No Authorized Video Stream
          </h3>
          <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
            <strong>{item.title}</strong> ({item.releaseYear}) is included in the sample catalog for search and watchlist discovery, but no authorized streaming license or video source is connected to this record. CineWave never uses fabricated movie-streaming URLs.
          </p>
          <p className="text-[11px] sm:text-xs text-zinc-400 font-mono-tabular">
            STATUS: CATALOG_PREVIEW_ONLY · SELECT AN &ldquo;HD · FREE&rdquo; DEMO TITLE TO WATCH
          </p>
        </div>
      </div>
    );
  }

  const progressPercent =
    duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const bufferedPercent =
    duration > 0 ? Math.min(100, Math.max(0, (bufferedEnd / duration) * 100)) : 0;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label={`Video Player for ${item.title}`}
      className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black border border-white/15 select-none group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]"
    >
      {/* Native HTML5 Video Element connected to Authorized Demo Stream */}
      <video
        ref={videoRef}
        key={activeStreamUrl}
        src={activeStreamUrl}
        poster={item.backdropUrl}
        playsInline
        preload="metadata"
        autoPlay={autoPlay}
        onClick={togglePlay}
        onLoadStart={() => setIsLoading(true)}
        onWaiting={() => setIsLoading(true)}
        onCanPlay={() => setIsLoading(false)}
        onLoadedMetadata={(e) => {
          const vid = e.currentTarget;
          vid.volume = volume;
          vid.muted = isMuted;
          vid.playbackRate = playbackRate;
          if (vid.duration && Number.isFinite(vid.duration)) {
            setDuration(vid.duration);
          }
          setIsLoading(false);
        }}
        onPlay={() => setIsPlaying(true)}
        onPlaying={() => {
          setIsLoading(false);
          setIsPlaying(true);
          setPlaybackError(null);
        }}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={(e) => {
          if (isScrubbing) return;
          const vid = e.currentTarget;
          setCurrentTime(vid.currentTime);
          if (vid.buffered.length > 0) {
            setBufferedEnd(vid.buffered.end(vid.buffered.length - 1));
          }
        }}
        onVolumeChange={(e) => {
          const vid = e.currentTarget;
          setVolume(vid.volume);
          setIsMuted(vid.muted);
        }}
        onEnded={() => setIsPlaying(false)}
        onError={handleVideoError}
        className="w-full h-full object-contain bg-black cursor-pointer"
      />

      {/* Top Stream Verification & Attribution Bar */}
      <div className="absolute top-0 left-0 right-0 p-3 sm:p-4 bg-gradient-to-b from-black/90 via-black/45 to-transparent flex items-center justify-between gap-4 pointer-events-none">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#FF6B00] shrink-0" />
            <p className="text-xs sm:text-sm font-bold text-white truncate font-display">
              {item.title} {episodeTitle ? `— ${episodeTitle}` : ''}
            </p>
          </div>
          <p className="text-[10px] sm:text-[11px] text-zinc-300 truncate font-mono-tabular mt-0.5">
            {videoSource.title} · {videoSource.resolutionLabel}
          </p>
        </div>
      </div>

      {/* Loading Spinner State */}
      {isLoading && !playbackError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/55 pointer-events-none z-10">
          <Loader2 className="w-9 h-9 sm:w-10 sm:h-10 text-[#FF6B00] animate-spin" />
          <span className="mt-2 text-xs font-medium text-zinc-200">
            Buffering authorized demo stream...
          </span>
        </div>
      )}

      {/* Center Play Button Overlay when Paused */}
      {!isPlaying && !isLoading && !playbackError && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <button
            type="button"
            onClick={togglePlay}
            className="pointer-events-auto w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-[#FF6B00] text-black flex items-center justify-center shadow-2xl hover:bg-[#FF8533] transition-transform duration-150 hover:scale-105 cursor-pointer"
            aria-label={`Play ${item.title}`}
          >
            <Play className="w-6 h-6 sm:w-8 sm:h-8 fill-current ml-1" />
          </button>
        </div>
      )}

      {/* Clear Playback Error Overlay with Retry & Backup Stream Recovery */}
      {playbackError && (
        <div
          role="alert"
          className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center p-4 sm:p-6 text-center z-20 overflow-y-auto"
        >
          <AlertCircle className="w-9 h-9 sm:w-11 sm:h-11 text-[#FF6B00] mb-2 sm:mb-3 shrink-0" />
          <h4 className="text-sm sm:text-lg font-bold text-white font-display">
            Video Playback Error
          </h4>
          <p className="text-xs sm:text-sm text-zinc-300 max-w-md mt-1 leading-relaxed">
            {playbackError}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={() => handleRetryStream(false)}
              className="min-h-[42px] px-3.5 py-2 rounded-xl border border-white/15 bg-zinc-900 text-xs font-semibold text-white hover:bg-zinc-800 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Stream</span>
            </button>
            {videoSource.fallbackMp4Url && (
              <button
                type="button"
                onClick={() => handleRetryStream(true)}
                className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#FF6B00] text-xs font-bold text-black hover:bg-[#FF8533] transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>
                  {useFallbackMirror
                    ? 'Use Primary Stream'
                    : 'Use Backup Authorized Stream'}
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Bottom Transport Controls Bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/80 to-transparent pt-8 pb-2.5 sm:pb-3.5 px-3 sm:px-4 space-y-1.5 sm:space-y-2.5 z-10">
        {/* Interactive Seek Bar & Elapsed / Total Time */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="relative flex-1 flex items-center h-6">
            {/* Track Background */}
            <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              {/* Buffered Progress */}
              <div
                className="h-full bg-zinc-500/50 transition-all duration-150"
                style={{ width: `${bufferedPercent}%` }}
              />
            </div>
            {/* Elapsed Progress */}
            <div
              className="absolute left-0 h-1.5 bg-[#FF6B00] rounded-full pointer-events-none"
              style={{ width: `${progressPercent}%` }}
            />
            {/* Scrubber Thumb Indicator */}
            <div
              className="absolute w-3.5 h-3.5 rounded-full bg-[#FF6B00] ring-2 ring-white shadow pointer-events-none -translate-x-1/2"
              style={{ left: `${progressPercent}%` }}
            />
            <input
              type="range"
              min={0}
              max={duration > 0 ? duration : 100}
              step={0.1}
              value={currentTime}
              onMouseDown={() => setIsScrubbing(true)}
              onMouseUp={() => setIsScrubbing(false)}
              onTouchStart={() => setIsScrubbing(true)}
              onTouchEnd={() => setIsScrubbing(false)}
              onChange={handleSeekInput}
              aria-label="Seek video timeline"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>

          <span className="text-[11px] sm:text-xs text-zinc-200 font-mono-tabular whitespace-nowrap shrink-0">
            {formatTimecode(currentTime)} / {formatTimecode(duration)}
          </span>
        </div>

        {/* Transport Buttons Row — Touch-friendly >=42px targets with zero horizontal overflow */}
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-0.5 sm:gap-1.5">
            {/* Play / Pause */}
            <button
              type="button"
              onClick={togglePlay}
              className="min-h-[42px] min-w-[42px] rounded-lg text-white hover:text-[#FF6B00] hover:bg-white/10 transition-colors flex items-center justify-center cursor-pointer"
              aria-label={isPlaying ? 'Pause video' : 'Play video'}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5 fill-current" />
              )}
            </button>

            {/* Rewind 10s */}
            <button
              type="button"
              onClick={() => skipSeconds(-10)}
              className="min-h-[42px] min-w-[42px] rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center cursor-pointer"
              aria-label="Rewind 10 seconds"
              title="Rewind 10s"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Forward 10s */}
            <button
              type="button"
              onClick={() => skipSeconds(10)}
              className="min-h-[42px] min-w-[42px] rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center cursor-pointer"
              aria-label="Forward 10 seconds"
              title="Forward 10s"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* Volume Mute + Slider */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggleMute}
                className="min-h-[42px] min-w-[42px] rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center cursor-pointer"
                aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-[#FF6B00]" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                aria-label="Audio volume"
                className="hidden sm:block w-20 md:w-24 accent-[#FF6B00] cursor-pointer"
              />
            </div>
          </div>

          {/* Right Controls: Playback Speed (Mobile Tap Cycle + Desktop Bar) & Fullscreen */}
          <div className="flex items-center gap-1 sm:gap-1.5">
            {/* Compact Mobile Speed Button */}
            <button
              type="button"
              onClick={cycleSpeedMobile}
              className="sm:hidden min-h-[42px] px-2.5 rounded-lg bg-zinc-900/90 border border-white/10 text-xs font-mono-tabular font-bold text-[#FF6B00] cursor-pointer"
              aria-label={`Playback speed ${playbackRate}x, tap to change`}
            >
              {playbackRate}x
            </button>

            {/* Desktop Segmented Speed Selector */}
            <div
              role="group"
              aria-label="Playback speed"
              className="hidden sm:flex items-center bg-zinc-900/90 border border-white/10 rounded-lg p-0.5"
            >
              {SPEED_OPTIONS.map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => changeSpeed(rate)}
                  className={`min-h-[32px] px-2.5 py-1 text-[11px] font-mono-tabular rounded-md transition-colors cursor-pointer ${
                    playbackRate === rate
                      ? 'bg-[#FF6B00] text-black font-bold'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={toggleFullscreen}
              className="min-h-[42px] min-w-[42px] rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center cursor-pointer"
              aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              title={isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}
            >
              {isFullscreen ? (
                <Minimize className="w-4 h-4" />
              ) : (
                <Maximize className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
