export type ContentType = 'movie' | 'series';

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

export interface EpisodeInfo {
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  durationMinutes: number;
  synopsis: string;
  playableSourceId?: string;
}

export interface MediaItem {
  id: string;
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
  availabilityStatus: AvailabilityStatus;
  availabilityNote: string;
  /**
   * Reference ID to VIDEO_SOURCES map in videoSources.ts.
   * Kept separate from general metadata so unauthorized streams are never fabricated.
   */
  videoSourceId?: string;
  featured?: boolean;
  trendingRank?: number;
  popularScore?: number;
  recentlyAdded?: boolean;
  // TV Show specific metadata
  seasonsCount?: number;
  episodesCount?: number;
  episodes?: EpisodeInfo[];
  // Artwork theme parameters for resilient fallback / SVG poster generation
  visualTheme: {
    primaryHex: string;
    secondaryHex: string;
    accentHex: string;
    motif: 'horizon' | 'velocity' | 'noir' | 'valley' | 'orbit' | 'bastion' | 'harbor' | 'clockwork' | 'canyon' | 'symphony';
  };
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
