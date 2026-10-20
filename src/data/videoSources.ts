import { AuthorizedVideoAsset, VideoSourceRecord } from '../types/media';

/**
 * Demo video assets removed per user request.
 * Playback uses CineSrc.st embed links (https://cinesrc.st/embed/movie/:tmdbId or /tv/:tmdbId)
 * managed via Cloud Firestore and the ZAPPY Admin Panel.
 */
export const INITIAL_AUTHORIZED_VIDEO_ASSETS: AuthorizedVideoAsset[] = [];

export const AUTHORIZED_VIDEO_SOURCES: Record<string, VideoSourceRecord> = {};

export function getAuthorizedVideoSource(sourceId?: string): VideoSourceRecord | null {
  if (!sourceId) return null;
  return AUTHORIZED_VIDEO_SOURCES[sourceId] || null;
}
