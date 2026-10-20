export type ContentType = 'movie' | 'series';
export type TMDBMediaType = 'movie' | 'tv';

export type Genre =
  | 'Action'
  | 'Comedy'
  | 'Drama'
  | 'Thriller'
  | 'Family'
  | 'Sci-Fi'
  | 'Animation'
  | 'Mystery'
  | 'Documentary';

export type AvailabilityStatus = 'playable_demo' | 'catalog_preview';
export type RightsStatus = 'verified' | 'pending' | 'expired' | 'revoked';
export type StreamFormat = 'mp4' | 'hls' | 'dash' | 'cinesrc';

export interface EpisodeInfo {
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  durationMinutes: number;
  synopsis: string;
  stillUrl?: string;
  playableSourceId?: string;
}

export interface SeasonSummary {
  seasonNumber: number;
  name: string;
  episodeCount: number;
  airDate?: string;
}

export interface MediaItem {
  id: string;
  tmdbId: number;
  mediaType: TMDBMediaType;
  title: string;
  tagline: string;
  synopsis: string;
  contentType: ContentType;
  genres: Genre[];
  releaseYear: number;
  durationMinutes: number;
  maturityRating: 'G' | 'PG' | 'PG-13' | 'TV-PG' | 'TV-14';
  directorOrCreator: string;
  cast: string[];
  posterUrl: string;
  backdropUrl: string;
  cinesrcEmbedUrl?: string;
  justWatchUrl?: string;
  visibility?: 'public' | 'hidden';
  authorUid?: string;
  availabilityStatus: AvailabilityStatus;
  availabilityNote: string;
  videoSourceId?: string;
  featured?: boolean;
  trendingRank?: number;
  popularScore?: number;
  recentlyAdded?: boolean;
  seasonsCount?: number;
  episodesCount?: number;
  seasons?: SeasonSummary[];
  episodes?: EpisodeInfo[];
  visualTheme: {
    primaryHex: string;
    secondaryHex: string;
    accentHex: string;
    motif:
      | 'horizon'
      | 'velocity'
      | 'noir'
      | 'valley'
      | 'orbit'
      | 'bastion'
      | 'harbor'
      | 'clockwork'
      | 'canyon'
      | 'symphony';
  };
}

export interface AuthorizedVideoAsset {
  assetId: string;
  tmdbId: number;
  mediaType: TMDBMediaType;
  seasonNumber?: number;
  episodeNumber?: number;
  title: string;
  streamFormat: StreamFormat;
  manifestOrFileUrl: string;
  backupStreamUrl?: string;
  rightsStatus: RightsStatus;
  allowedTerritories: string[];
  validFrom: string;
  validUntil: string;
  durationSeconds: number;
  resolutionLabel: string;
  licenseNotice: string;
  attribution: string;
  midRollCueSeconds?: number[];
}

export interface VideoAdConfig {
  imaEnabled: boolean;
  testMode: boolean;
  vastTagUrl: string;
  enablePreRoll: boolean;
  enableMidRoll: boolean;
}

export interface PlaybackResolutionResponse {
  authorized: boolean;
  tmdbId: number;
  mediaType: TMDBMediaType;
  seasonNumber?: number;
  episodeNumber?: number;
  territory: string;
  reasonCode:
    | 'authorized'
    | 'no_asset_registered'
    | 'rights_unverified'
    | 'territory_restricted'
    | 'date_window_expired';
  message: string;
  asset: AuthorizedVideoAsset | null;
  videoAdConfig: VideoAdConfig;
}

export interface VideoSourceRecord {
  id: string;
  title: string;
  licenseNotice: string;
  attribution: string;
  primaryMp4Url: string;
  fallbackMp4Url?: string;
  durationSeconds: number;
  resolutionLabel: string;
}

export interface AdConfiguration {
  enabled: boolean;
  providerStatus: 'unconfigured_demo' | 'configured';
  providerName: string;
  showHomepageBanners: boolean;
  showDetailsBanner: boolean;
}
