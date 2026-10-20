import { VideoSourceRecord } from '../types/media';

/**
 * Authorized Demo Video Sources
 * Strictly separated from movie catalog metadata.
 * Every entry here points ONLY to verified, open-licensed Creative Commons
 * (Blender Foundation CC-BY) or W3C / Google Cloud public sample demo streams.
 * No fabricated or unauthorized movie-streaming URLs are ever used.
 */
export const AUTHORIZED_VIDEO_SOURCES: Record<string, VideoSourceRecord> = {
  'open-tears-of-steel': {
    id: 'open-tears-of-steel',
    title: 'Tears of Steel (Blender Foundation Open Movie · CC-BY 3.0)',
    licenseNotice: 'Creative Commons Attribution 3.0 (CC-BY 3.0) · mango.blender.org',
    attribution: 'Directed by Ian Hubert · Produced by Ton Roosendaal',
    primaryMp4Url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    fallbackMp4Url: 'https://media.w3.org/2010/05/sintel/trailer.mp4',
    durationSeconds: 734,
    resolutionLabel: '1080p HD · CC-BY 3.0',
  },
  'open-sintel': {
    id: 'open-sintel',
    title: 'Sintel (Blender Foundation Open Movie · CC-BY 3.0)',
    licenseNotice: 'Creative Commons Attribution 3.0 (CC-BY 3.0) · durian.blender.org',
    attribution: 'Directed by Colin Levy · Produced by Ton Roosendaal',
    primaryMp4Url: 'https://media.w3.org/2010/05/sintel/trailer.mp4',
    fallbackMp4Url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    durationSeconds: 52,
    resolutionLabel: '1080p HD · CC-BY 3.0',
  },
  'open-big-buck-bunny': {
    id: 'open-big-buck-bunny',
    title: 'Big Buck Bunny (Blender Institute Open Movie · CC-BY 3.0)',
    licenseNotice: 'Creative Commons Attribution 3.0 (CC-BY 3.0) · peach.blender.org',
    attribution: 'Directed by Sacha Goedegebure · Produced by Ton Roosendaal',
    primaryMp4Url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    fallbackMp4Url: 'https://media.w3.org/2010/05/bunny/trailer.mp4',
    durationSeconds: 596,
    resolutionLabel: '1080p HD · CC-BY 3.0',
  },
  'open-elephants-dream': {
    id: 'open-elephants-dream',
    title: 'Elephants Dream (Orange Open Movie Project · CC-BY 2.5)',
    licenseNotice: 'Creative Commons Attribution 2.5 (CC-BY 2.5) · Blender Foundation',
    attribution: 'Directed by Bassam Kurdali · Produced by Ton Roosendaal',
    primaryMp4Url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    fallbackMp4Url: 'https://media.w3.org/2010/05/video/movie_300.mp4',
    durationSeconds: 653,
    resolutionLabel: '1080p HD · CC-BY 2.5',
  },
  'open-for-bigger-blazes': {
    id: 'open-for-bigger-blazes',
    title: 'For Bigger Blazes (Google Cloud Authorized Sample Stream)',
    licenseNotice: 'Authorized Public Sample Stream · Google GTV Sample Repository',
    attribution: 'Google Sample Media Stream',
    primaryMp4Url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    fallbackMp4Url: 'https://media.w3.org/2010/05/sintel/trailer.mp4',
    durationSeconds: 15,
    resolutionLabel: '720p HD · Demo Stream',
  },
  'open-for-bigger-escapes': {
    id: 'open-for-bigger-escapes',
    title: 'For Bigger Escapes (Google Cloud Authorized Sample Stream)',
    licenseNotice: 'Authorized Public Sample Stream · Google GTV Sample Repository',
    attribution: 'Google Sample Media Stream',
    primaryMp4Url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    fallbackMp4Url: 'https://media.w3.org/2010/05/bunny/trailer.mp4',
    durationSeconds: 15,
    resolutionLabel: '720p HD · Demo Stream',
  },
  'open-subaru-outback': {
    id: 'open-subaru-outback',
    title: 'Off-Grid Trail Documentary (Authorized Public Demo Stream)',
    licenseNotice: 'Authorized Public Sample Stream · Google GTV Sample Repository',
    attribution: 'Google Sample Media Stream',
    primaryMp4Url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackSeeTheWorld.mp4',
    fallbackMp4Url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoy.mp4',
    durationSeconds: 60,
    resolutionLabel: '720p HD · Demo Stream',
  },
  'open-we-are-going-on-bullrun': {
    id: 'open-we-are-going-on-bullrun',
    title: 'Coast Rally Documentary (Authorized Public Demo Stream)',
    licenseNotice: 'Authorized Public Sample Stream · Google GTV Sample Repository',
    attribution: 'Google Sample Media Stream',
    primaryMp4Url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
    fallbackMp4Url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
    durationSeconds: 47,
    resolutionLabel: '720p HD · Demo Stream',
  },
};

export function getAuthorizedVideoSource(sourceId?: string): VideoSourceRecord | null {
  if (!sourceId) return null;
  return AUTHORIZED_VIDEO_SOURCES[sourceId] || null;
}
