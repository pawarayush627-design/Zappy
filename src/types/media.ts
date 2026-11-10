export type ContentType = 'movie';
export type TMDBMediaType = 'movie' | 'tv';

export type Genre =
  | 'Action'
  | 'Adventure'
  | 'Comedy'
  | 'Drama'
  | 'Thriller'
  | 'Crime'
  | 'Sci-Fi'
  | 'Fantasy'
  | 'Horror'
  | 'Romance'
  | 'Mystery'
  | 'Family'
  | 'Animation'
  | 'Documentary';

export type AvailabilityStatus = 'playable_demo' | 'catalog_preview';

export interface SupportMessageItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  message: string;
  senderUid: string;
  status: 'open' | 'resolved';
  createdAtMs: number;
}

export interface PersonCredit {
  name: string;
  role: 'DIRECTOR' | 'ACTOR';
  characterName?: string;
  imageUrl: string;
  personId?: number;
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
  credits?: PersonCredit[];
  creditsJson?: string;
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
  heroAddedAtMs?: number;
  trendingRank?: number;
  popularScore?: number;
  recentlyAdded?: boolean;
  createdAtMs?: number;
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
