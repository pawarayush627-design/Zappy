import { MediaItem, Genre } from '../types/media';

/**
 * All demo movies and TV shows have been removed per user request.
 * Movies and TV shows are now stored in Cloud Firestore (/catalog/{mediaId})
 * and added via the ZAPPY Admin Panel using CineSrc.st embeds and JustWatch links.
 */
export const SAMPLE_CATALOG: MediaItem[] = [];

export const ALL_GENRES: Genre[] = [
  'Action',
  'Comedy',
  'Drama',
  'Thriller',
  'Family',
  'Sci-Fi',
  'Mystery',
  'Documentary',
  'Animation',
];
