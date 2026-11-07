import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { SAMPLE_CATALOG } from './src/data/catalog.ts';
import {
  INITIAL_AUTHORIZED_VIDEO_ASSETS,
} from './src/data/videoSources.ts';
import {
  CODE_LEGAL_PAGES,
  LegalPagesConfig,
  normalizeLegalPagesConfig,
} from './src/data/legalDocuments.ts';
import {
  AuthorizedVideoAsset,
  Genre,
  MediaItem,
  PersonCredit,
  PlaybackResolutionResponse,
  TMDBMediaType,
  VideoAdConfig,
} from './src/types/media.ts';
import {
  createPosterDataUri,
  createBackdropDataUri,
} from './src/utils/artworkGenerator.ts';
import {
  verifyAdminRequest,
  checkEmailRegisteredOnServer,
} from './src/utils/adminAuthServer.ts';
import {
  generateAndStoreOtp,
  verifyOtp,
  sendOtpEmail,
  sendTestEmail,
  getPublicSmtpStatus,
  saveSmtpConfig,
  validateRegistrationToken,
  consumeRegistrationToken,
} from './src/server/smtpService.ts';
import { recordRegisteredEmail } from './src/server/registeredUsers.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let serverLegalPages: LegalPagesConfig = normalizeLegalPagesConfig(CODE_LEGAL_PAGES);

function persistLegalPagesToSourceFile(nextConfig: LegalPagesConfig): boolean {
  try {
    const legalFilePath = path.join(__dirname, 'src', 'data', 'legalDocuments.ts');
    if (!fs.existsSync(legalFilePath)) return false;
    const currentSource = fs.readFileSync(legalFilePath, 'utf8');
    const startMarker = 'export const CODE_LEGAL_PAGES: LegalPagesConfig = ';
    const endMarker = '\nexport function fixTypoEmail';
    const startIdx = currentSource.indexOf(startMarker);
    const endIdx = currentSource.indexOf(endMarker);
    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
      return false;
    }

    const serializedObject = JSON.stringify(nextConfig, null, 2);
    const updatedSource =
      currentSource.slice(0, startIdx) +
      `${startMarker}${serializedObject};\n` +
      currentSource.slice(endIdx);

    fs.writeFileSync(legalFilePath, updatedSource, 'utf8');
    return true;
  } catch (err) {
    console.warn('Could not write legalDocuments.ts to disk:', err);
    return false;
  }
}

let authorizedAssetsRegistry: AuthorizedVideoAsset[] = [
  ...INITIAL_AUTHORIZED_VIDEO_ASSETS,
];

let serverVideoAdConfig: VideoAdConfig = {
  imaEnabled: true,
  testMode: process.env.IMA_TEST_MODE !== 'false',
  vastTagUrl: process.env.IMA_VAST_TAG_URL
    ? process.env.IMA_VAST_TAG_URL.trim()
    : '',
  enablePreRoll: true,
  enableMidRoll: true,
};

const rateLimitWindowMs = 60_000;
const maxRequestsPerMinute = 2500;
const ipRequestCounts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const entry = ipRequestCounts.get(ip);
  if (!entry || now > entry.resetAt) {
    ipRequestCounts.set(ip, { count: 1, resetAt: now + rateLimitWindowMs });
    return { allowed: true, retryAfterSec: 0 };
  }
  entry.count += 1;
  if (entry.count > maxRequestsPerMinute) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    };
  }
  return { allowed: true, retryAfterSec: 0 };
}

function getTmdbCredentials(): {
  configured: boolean;
  apiKey: string;
  bearerToken: string;
} {
  const apiKey = (process.env.TMDB_API_KEY || '').trim();
  const bearerToken = (process.env.TMDB_READ_ACCESS_TOKEN || '').trim();
  const validKey =
    Boolean(apiKey) &&
    apiKey !== 'MY_TMDB_API_KEY' &&
    apiKey !== 'YOUR_TMDB_API_KEY';
  const validBearer =
    Boolean(bearerToken) &&
    bearerToken !== 'MY_TMDB_READ_ACCESS_TOKEN' &&
    bearerToken !== 'YOUR_TMDB_READ_ACCESS_TOKEN';
  return {
    configured: validKey || validBearer,
    apiKey: validKey ? apiKey : '',
    bearerToken: validBearer ? bearerToken : '',
  };
}

const TMDB_GENRE_MAP: Record<number, Genre> = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  27: 'Horror',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Sci-Fi',
  53: 'Thriller',
  10759: 'Action',
  10765: 'Sci-Fi',
};

const JUSTWATCH_GENRE_MAP: Record<string, Genre> = {
  act: 'Action',
  ani: 'Animation',
  cmy: 'Comedy',
  crm: 'Crime',
  doc: 'Documentary',
  drm: 'Drama',
  fnt: 'Fantasy',
  hst: 'Drama',
  hrr: 'Horror',
  fml: 'Family',
  msc: 'Drama',
  rma: 'Romance',
  scf: 'Sci-Fi',
  spt: 'Action',
  trl: 'Thriller',
  war: 'Adventure',
  wsn: 'Adventure',
};

interface ServerSupportTicket {
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

let supportTicketsRegistry: ServerSupportTicket[] = [];

const MOTIFS: MediaItem['visualTheme']['motif'][] = [
  'horizon',
  'velocity',
  'noir',
  'valley',
  'orbit',
  'bastion',
  'harbor',
  'clockwork',
  'canyon',
  'symphony',
];

function mapAgeCertification(
  rawCert: string | undefined | null,
  mediaType: TMDBMediaType
): 'G' | 'PG' | 'PG-13' | 'TV-PG' | 'TV-14' {
  const c = (rawCert || '').toUpperCase().trim();
  if (c === 'G' || c === 'U' || c === 'TV-G' || c === 'TV-Y') return 'G';
  if (c === 'PG' || c === 'UA' || c === 'U/A 7+') return 'PG';
  if (c === 'TV-PG' || c === 'U/A 13+') return 'TV-PG';
  if (mediaType === 'tv') return 'TV-14';
  if (c === 'PG-13' || c === 'R' || c === 'A' || c === '16' || c === '18') {
    return 'PG-13';
  }
  return 'PG-13';
}

function createPersonAvatarSvgDataUri(
  name: string,
  role: 'DIRECTOR' | 'ACTOR'
): string {
  const parts = name.trim().split(/\s+/);
  const initials =
    parts.length >= 2
      ? `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase()
      : (name.slice(0, 2) || 'ZP').toUpperCase();
  const bg1 = role === 'DIRECTOR' ? '#2E1C44' : '#1E1830';
  const bg2 = role === 'DIRECTOR' ? '#161122' : '#120E1C';
  const accent = role === 'DIRECTOR' ? '#FF8A3D' : '#B892FF';
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

const personPhotoCache = new Map<string, string>();

/**
 * Fetches real portrait photos for a list of cast & director names
 */
async function resolvePersonPhotos(
  rawCredits: Array<{
    name: string;
    role: 'DIRECTOR' | 'ACTOR';
    characterName?: string;
    personId?: number;
  }>
): Promise<PersonCredit[]> {
  if (rawCredits.length === 0) return [];

  const uniqueNames = Array.from(
    new Set(rawCredits.map((c) => c.name.trim()).filter(Boolean))
  );
  const photoMap = new Map<string, string>();
  const uncachedNames: string[] = [];

  for (const name of uniqueNames) {
    const cached = personPhotoCache.get(name.toLowerCase());
    if (cached) {
      photoMap.set(name.toLowerCase(), cached);
    } else {
      uncachedNames.push(name);
    }
  }

  // Step 1: Batch query Wikipedia pageimages API for uncached names
  if (uncachedNames.length > 0) {
    try {
      const titlesParam = uncachedNames.slice(0, 15).join('|');
    const wikiBatchUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(
      titlesParam
    )}&prop=pageimages&format=json&pithumbsize=400&redirects=1`;

    const res = await fetch(wikiBatchUrl, {
      headers: {
        'User-Agent': 'ZappyStreamingPlatform/1.0 (contact@zappy.app)',
      },
    });

    if (res.ok) {
      const data = await res.json();
      const queryObj = data?.query;
      const redirects = new Map<string, string>();
      if (Array.isArray(queryObj?.redirects)) {
        for (const r of queryObj.redirects) {
          if (r.from && r.to) {
            redirects.set(r.to.toLowerCase(), r.from.toLowerCase());
          }
        }
      }
      const pages = queryObj?.pages || {};
      for (const page of Object.values(pages) as any[]) {
        const thumbUrl = page?.thumbnail?.source;
        const pageTitle = (page?.title || '').toLowerCase();
          if (thumbUrl && pageTitle) {
            photoMap.set(pageTitle, thumbUrl);
            personPhotoCache.set(pageTitle, thumbUrl);
            const origFrom = redirects.get(pageTitle);
            if (origFrom) {
              photoMap.set(origFrom, thumbUrl);
              personPhotoCache.set(origFrom, thumbUrl);
            }
          }
        }
      }
    } catch {
      // Ignore Wikipedia batch error
    }
  }

  // Step 2: Fallback for missing credits
  const missingCredits = rawCredits.filter(
    (c) => !photoMap.has(c.name.trim().toLowerCase())
  );

  await Promise.all(
    missingCredits.slice(0, 8).map(async (credit) => {
      const cleanName = credit.name.trim();
      const key = cleanName.toLowerCase();
      const suffix = credit.role === 'DIRECTOR' ? '(director)' : '(actor)';

      try {
        const wikiSuffixUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
          `${cleanName} ${suffix}`
        )}`;
        const wRes = await fetch(wikiSuffixUrl, {
          headers: { 'User-Agent': 'ZappyStreamingPlatform/1.0' },
        });
        if (wRes.ok) {
          const wJson = await wRes.json();
          if (wJson?.thumbnail?.source) {
            photoMap.set(key, wJson.thumbnail.source);
            personPhotoCache.set(key, wJson.thumbnail.source);
            return;
          }
        }
      } catch {
        // Ignore
      }

      try {
        const tvMazeRes = await fetch(
          `https://api.tvmaze.com/search/people?q=${encodeURIComponent(cleanName)}`
        );
        if (tvMazeRes.ok) {
          const tvMazeData = await tvMazeRes.json();
          const img =
            tvMazeData?.[0]?.person?.image?.medium ||
            tvMazeData?.[0]?.person?.image?.original;
          if (img) {
            photoMap.set(key, img);
            personPhotoCache.set(key, img);
            return;
          }
        }
      } catch {
        // Ignore
      }
    })
  );

  return rawCredits.map((c) => {
    const key = c.name.trim().toLowerCase();
    const matchedPhoto =
      photoMap.get(key) || createPersonAvatarSvgDataUri(c.name, c.role);
    return {
      name: c.name.trim(),
      role: c.role,
      characterName: c.characterName?.trim() || '',
      imageUrl: matchedPhoto,
      personId: c.personId,
    };
  });
}

function hasVerifiedAsset(mediaType: TMDBMediaType, tmdbId: number): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return authorizedAssetsRegistry.some(
    (a) =>
      a.mediaType === mediaType &&
      a.tmdbId === tmdbId &&
      a.rightsStatus === 'verified' &&
      today >= a.validFrom &&
      today <= a.validUntil
  );
}

function mapTmdbRecordToMediaItem(
  raw: any,
  forcedType?: TMDBMediaType
): MediaItem {
  const mediaType: TMDBMediaType =
    forcedType || (raw.media_type === 'tv' || raw.first_air_date ? 'tv' : 'movie');
  const tmdbId = Number(raw.id) || 0;
  const title = raw.title || raw.name || 'Untitled TMDB Record';
  const releaseDateStr = raw.release_date || raw.first_air_date || '2024-01-01';
  const releaseYear = Number(releaseDateStr.slice(0, 4)) || 2024;

  const mappedGenres: Genre[] = Array.isArray(raw.genre_ids)
    ? Array.from(
        new Set(
          raw.genre_ids
            .map((gid: number) => TMDB_GENRE_MAP[gid])
            .filter(Boolean) as Genre[]
        )
      )
    : ['Drama'];
  if (mappedGenres.length === 0) mappedGenres.push('Drama');

  const isPlayable = hasVerifiedAsset(mediaType, tmdbId);
  const motif = MOTIFS[tmdbId % MOTIFS.length];

  const baseSeed: Omit<MediaItem, 'posterUrl' | 'backdropUrl'> = {
    id: `${mediaType}-${tmdbId}`,
    tmdbId,
    mediaType,
    title,
    tagline: raw.tagline || `TMDB ${mediaType.toUpperCase()} #${tmdbId}`,
    synopsis:
      raw.overview ||
      'No synopsis provided by TMDB metadata feed for this title.',
    contentType: mediaType === 'tv' ? 'series' : 'movie',
    genres: mappedGenres,
    releaseYear,
    durationMinutes: Number(raw.runtime) || (mediaType === 'tv' ? 42 : 110),
    maturityRating: mediaType === 'tv' ? 'TV-14' : 'PG-13',
    directorOrCreator: 'TMDB Catalog Metadata',
    cast: ['TMDB Cast Ensemble'],
    availabilityStatus: isPlayable ? 'playable_demo' : 'catalog_preview',
    availabilityNote: isPlayable
      ? `Third-Party Embed Stream (Unverified Licensing) · TMDB ${mediaType.toUpperCase()} #${tmdbId}`
      : `TMDB Metadata Only (#${tmdbId}) · Not available to stream yet`,
    popularScore: Math.min(
      99,
      Math.max(70, Math.round((Number(raw.vote_average) || 7.5) * 10))
    ),
    recentlyAdded: releaseYear >= 2024,
    seasonsCount:
      mediaType === 'tv' ? Number(raw.number_of_seasons) || 1 : undefined,
    episodesCount:
      mediaType === 'tv' ? Number(raw.number_of_episodes) || 8 : undefined,
    visualTheme: {
      primaryHex: '#1A1625',
      secondaryHex: '#251E35',
      accentHex: '#B892FF',
      motif,
    },
  };

  return {
    ...baseSeed,
    posterUrl: raw.poster_path
      ? `https://image.tmdb.org/t/p/w500${raw.poster_path}`
      : createPosterDataUri(baseSeed),
    backdropUrl: raw.backdrop_path
      ? `https://image.tmdb.org/t/p/w1280${raw.backdrop_path}`
      : createBackdropDataUri(baseSeed),
  };
}

function getHydratedFallbackCatalog(): MediaItem[] {
  return SAMPLE_CATALOG.map((item) => {
    const playable = hasVerifiedAsset(item.mediaType, item.tmdbId);
    return {
      ...item,
      availabilityStatus: playable ? 'playable_demo' : 'catalog_preview',
      availabilityNote: playable
        ? `Third-Party Embed Stream (Unverified Licensing) · TMDB ${item.mediaType.toUpperCase()} #${item.tmdbId}`
        : `TMDB Metadata Only (#${item.tmdbId}) · Not available to stream yet`,
    };
  });
}

async function fetchFromTmdbServer(
  endpointPath: string,
  queryParams: Record<string, string> = {}
): Promise<any> {
  const creds = getTmdbCredentials();
  if (!creds.configured) {
    throw new Error('TMDB_NOT_CONFIGURED');
  }

  const url = new URL(`https://api.themoviedb.org/3${endpointPath}`);
  Object.entries(queryParams).forEach(([k, v]) => {
    if (v !== undefined && v !== '') {
      url.searchParams.set(k, v);
    }
  });

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (creds.bearerToken) {
    headers.Authorization = `Bearer ${creds.bearerToken}`;
  } else if (creds.apiKey) {
    url.searchParams.set('api_key', creds.apiKey);
  }

  const response = await fetch(url.toString(), { headers });
  if (response.status === 429) {
    const err = new Error('TMDB_RATE_LIMIT');
    (err as any).status = 429;
    throw err;
  }
  if (!response.ok) {
    throw new Error(`TMDB_HTTP_${response.status}`);
  }
  return response.json();
}

const RESERVED_JUSTWATCH_SEGMENTS = new Set([
  'search',
  'movies',
  'tv-shows',
  'tv-series',
  'popular',
  'new',
  'lists',
  'watchlist',
  'provider',
  'providers',
  'guide',
  'about',
]);

function parseJustWatchUrl(rawUrl: string): {
  slugTitle: string;
  mediaType: TMDBMediaType;
  country: string;
  urlPath: string;
} {
  const trimmedInput = rawUrl.trim();
  if (
    !trimmedInput.startsWith('http://') &&
    !trimmedInput.startsWith('https://') &&
    !trimmedInput.includes('justwatch.com')
  ) {
    return {
      slugTitle: trimmedInput,
      mediaType: 'movie',
      country: 'IN',
      urlPath: '',
    };
  }

  try {
    const parsed = new URL(
      trimmedInput.startsWith('http') ? trimmedInput : `https://${trimmedInput}`
    );

    const queryTitle = (
      parsed.searchParams.get('q') ||
      parsed.searchParams.get('query') ||
      parsed.searchParams.get('title') ||
      parsed.searchParams.get('search') ||
      ''
    ).trim();

    const queryType = (
      parsed.searchParams.get('content_type') ||
      parsed.searchParams.get('type') ||
      ''
    )
      .toLowerCase()
      .trim();

    const cleanedPathname = decodeURIComponent(parsed.pathname)
      .replace(/\/+$/, '')
      .replace(/\/season-\d+.*$/i, '')
      .replace(/\/episode-\d+.*$/i, '');

    const parts = cleanedPathname.split('/').filter(Boolean);
    const hasCountryPrefix = Boolean(parts[0] && /^[a-z]{2}$/i.test(parts[0]));
    const country = hasCountryPrefix ? parts[0].toUpperCase() : 'IN';

    const typeSegment = (hasCountryPrefix ? parts[1] || '' : parts[0] || '')
      .toLowerCase()
      .trim();
    const rawSlugCandidate = (
      hasCountryPrefix ? parts[2] || '' : parts[1] || ''
    ).trim();

    let mediaType: TMDBMediaType = 'movie';
    if (
      typeSegment.includes('tv') ||
      typeSegment.includes('show') ||
      typeSegment.includes('series') ||
      typeSegment.includes('serie') ||
      queryType.includes('tv') ||
      queryType.includes('show')
    ) {
      mediaType = 'tv';
    }

    // If URL is a search page like /in/search?q=Pushpa+2, use queryTitle and do NOT pass /in/search as urlPath
    if (
      typeSegment === 'search' ||
      RESERVED_JUSTWATCH_SEGMENTS.has(typeSegment) ||
      RESERVED_JUSTWATCH_SEGMENTS.has(rawSlugCandidate.toLowerCase())
    ) {
      if (queryTitle && !RESERVED_JUSTWATCH_SEGMENTS.has(queryTitle.toLowerCase())) {
        return {
          slugTitle: queryTitle,
          mediaType,
          country,
          urlPath: '',
        };
      }
      // If someone had /in/movies/some-slug where parts[2] is a real slug
      if (
        rawSlugCandidate &&
        !RESERVED_JUSTWATCH_SEGMENTS.has(rawSlugCandidate.toLowerCase())
      ) {
        const slugTitleFromCandidate = rawSlugCandidate
          .split('-')
          .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ''))
          .join(' ')
          .trim();
        return {
          slugTitle: slugTitleFromCandidate,
          mediaType,
          country,
          urlPath: cleanedPathname,
        };
      }
      return {
        slugTitle: '',
        mediaType,
        country,
        urlPath: '',
      };
    }

    if (queryTitle && !rawSlugCandidate) {
      return {
        slugTitle: queryTitle,
        mediaType,
        country,
        urlPath: '',
      };
    }

    const slugTitle = rawSlugCandidate
      .split('-')
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ''))
      .join(' ')
      .trim();

    return {
      slugTitle: slugTitle || queryTitle || '',
      mediaType,
      country,
      urlPath: rawSlugCandidate ? cleanedPathname : '',
    };
  } catch {
    return {
      slugTitle: trimmedInput,
      mediaType: 'movie',
      country: 'IN',
      urlPath: '',
    };
  }
}

export interface TvSeasonEpisodeDetail {
  episodeNumber: number;
  title: string;
  overview: string;
  runtime: number;
  airDate?: string;
  stillUrl?: string;
}

export interface TvSeasonDetail {
  seasonNumber: number;
  episodeCount: number;
  episodes: TvSeasonEpisodeDetail[];
}

interface JustWatchFullMetadata {
  title: string;
  releaseYear: number;
  synopsis: string;
  tagline: string;
  durationMinutes: number;
  maturityRating: 'G' | 'PG' | 'PG-13' | 'TV-PG' | 'TV-14';
  genres: Genre[];
  tmdbId?: number;
  imdbId?: string;
  imdbScore?: number;
  popularScore: number;
  mediaType: TMDBMediaType;
  seasonsCount: number;
  episodesCount: number;
  seasonBreakdown: Array<{ seasonNumber: number; episodeCount: number }>;
  posterUrl?: string;
  backdropUrl?: string;
  extraBackdrops: string[];
  directorOrCreator: string;
  cast: string[];
  justWatchUrl: string;
  rawCredits: Array<{
    name: string;
    role: 'DIRECTOR' | 'ACTOR';
    characterName?: string;
    personId?: number;
  }>;
}

function parseJustWatchNode(node: any): JustWatchFullMetadata | null {
  const content = node?.content;
  if (!content) return null;

  const mediaType: TMDBMediaType = node.objectType === 'SHOW' ? 'tv' : 'movie';
  const title = content.title || 'Untitled';
  const releaseYear = Number(content.originalReleaseYear) || 2024;
  const synopsis = content.shortDescription || '';
  const durationMinutes =
    Number(content.runtime) || (mediaType === 'tv' ? 45 : 120);
  const maturityRating = mapAgeCertification(
    content.ageCertification,
    mediaType
  );

  // Genres
  const mappedGenres: Genre[] = [];
  if (Array.isArray(content.genres)) {
    for (const g of content.genres) {
      const mapped = JUSTWATCH_GENRE_MAP[(g?.shortName || '').toLowerCase()];
      if (mapped && !mappedGenres.includes(mapped)) {
        mappedGenres.push(mapped);
      }
    }
  }
  if (mappedGenres.length === 0) {
    mappedGenres.push('Drama');
  }

  // External IDs & Scores
  const tmdbId = Number(content.externalIds?.tmdbId) || undefined;
  const imdbId = content.externalIds?.imdbId || undefined;
  const imdbScore = Number(content.scoring?.imdbScore) || undefined;
  const tmdbScore = Number(content.scoring?.tmdbScore) || undefined;
  const bestScore = imdbScore || tmdbScore || 8.5;
  const popularScore = Math.min(99, Math.max(60, Math.round(bestScore * 10)));

  // TV Seasons & Episodes (Filter out seasons with 0 episodes / unaired seasons!)
  const seasonBreakdown: Array<{ seasonNumber: number; episodeCount: number }> =
    [];
  if (mediaType === 'tv' && Array.isArray(node.seasons)) {
    const validSeasons = node.seasons
      .map((s: any, idx: number) => ({
        seasonNumber:
          Number(s?.content?.seasonNumber ?? s?.seasonNumber) || idx + 1,
        episodeCount: Number(s?.totalEpisodeCount) || 0,
      }))
      .filter(
        (s: { seasonNumber: number; episodeCount: number }) =>
          s.seasonNumber >= 1 && s.episodeCount > 0
      )
      .sort(
        (a: { seasonNumber: number }, b: { seasonNumber: number }) =>
          a.seasonNumber - b.seasonNumber
      );

    seasonBreakdown.push(...validSeasons);
  }

  const seasonsCount =
    mediaType === 'tv'
      ? seasonBreakdown.length > 0
        ? seasonBreakdown.length
        : Math.max(1, Number(node.totalSeasonCount) || 1)
      : 0;

  let episodesCount = mediaType === 'tv' ? 8 : 0;
  if (mediaType === 'tv' && seasonBreakdown.length > 0) {
    episodesCount = Math.max(1, seasonBreakdown[0].episodeCount || 8);
  }

  // Poster & Backdrops
  const posterUrl = content.posterUrl
    ? `https://images.justwatch.com${content.posterUrl
        .replace('{profile}', 's718')
        .replace('{format}', 'jpg')}`
    : undefined;

  const extraBackdrops: string[] = Array.isArray(content.backdrops)
    ? content.backdrops
        .map((b: any) =>
          b?.backdropUrl
            ? `https://images.justwatch.com${b.backdropUrl
                .replace('{profile}', 's1920')
                .replace('{format}', 'jpg')}`
            : ''
        )
        .filter(Boolean)
    : [];

  const backdropUrl = extraBackdrops[0] || posterUrl;

  // Credits (Directors & Cast)
  const allCredits = Array.isArray(content.credits) ? content.credits : [];
  const directorCredits = allCredits
    .filter((c: any) => c?.role === 'DIRECTOR' && c?.name)
    .slice(0, 3)
    .map((c: any) => ({
      name: String(c.name).trim(),
      role: 'DIRECTOR' as const,
      characterName: 'Director',
      personId: Number(c.personId) || undefined,
    }));

  const actorCredits = allCredits
    .filter((c: any) => c?.role === 'ACTOR' && c?.name)
    .slice(0, 10)
    .map((c: any) => ({
      name: String(c.name).trim(),
      role: 'ACTOR' as const,
      characterName: c.characterName ? String(c.characterName).trim() : '',
      personId: Number(c.personId) || undefined,
    }));

  const directorOrCreator =
    directorCredits.length > 0
      ? directorCredits.map((d: { name: string }) => d.name).join(', ')
      : 'Featured Creator';

  const cast =
    actorCredits.length > 0
      ? actorCredits.map((a: { name: string }) => a.name)
      : ['Featured Cast'];

  const taglineParts = [
    imdbScore ? `IMDb ${imdbScore.toFixed(1)}` : null,
    `${releaseYear}`,
    directorCredits[0] ? `Directed by ${directorCredits[0].name}` : null,
  ].filter(Boolean);

  const fullPath =
    typeof content.fullPath === 'string' && content.fullPath.startsWith('/')
      ? `https://www.justwatch.com${content.fullPath}`
      : '';

  return {
    title,
    releaseYear,
    synopsis,
    tagline: taglineParts.join(' · ') || `Watch ${title} (${releaseYear})`,
    durationMinutes,
    maturityRating,
    genres: mappedGenres.slice(0, 6),
    tmdbId,
    imdbId,
    imdbScore,
    popularScore,
    mediaType,
    seasonsCount,
    episodesCount,
    seasonBreakdown,
    posterUrl,
    backdropUrl,
    extraBackdrops,
    directorOrCreator,
    cast,
    justWatchUrl: fullPath,
    rawCredits: [...directorCredits, ...actorCredits],
  };
}

const JUSTWATCH_FRAGMENT_FIELDS = `
  id
  objectId
  objectType
  ... on Show {
    totalSeasonCount
    seasons {
      id
      totalEpisodeCount
      content(country: $country, language: $language) {
        seasonNumber
        title
      }
    }
  }
  content(country: $country, language: $language) {
    title
    fullPath
    originalReleaseYear
    shortDescription
    runtime
    ageCertification
    externalIds {
      tmdbId
      imdbId
    }
    scoring {
      imdbScore
      tmdbScore
    }
    genres {
      shortName
      translation(language: $language)
    }
    credits {
      role
      name
      characterName
      personId
    }
    posterUrl(profile: S718, format: JPG)
    backdrops(profile: S1920, format: JPG) {
      backdropUrl
    }
  }
`;

async function queryJustWatchGraphQL(
  searchQuery: string,
  country = 'US',
  urlPath = '',
  preferredType?: TMDBMediaType
): Promise<JustWatchFullMetadata | null> {
  try {
    const safeCountry =
      (country || 'IN').toUpperCase() === 'UK'
        ? 'GB'
        : (country || 'IN').toUpperCase();
    if (urlPath) {
      const urlQuery = {
        operationName: 'GetUrlTitleDetails',
        variables: {
          fullPath: urlPath,
          country: safeCountry,
          language: 'en',
        },
        query: `
          query GetUrlTitleDetails($fullPath: String!, $country: Country!, $language: Language!) {
            urlV2(fullPath: $fullPath) {
              node {
                ... on MovieOrShow {
                  ${JUSTWATCH_FRAGMENT_FIELDS}
                }
              }
            }
          }
        `,
      };

      const res = await fetch('https://apis.justwatch.com/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(urlQuery),
      });

      if (res.ok) {
        const json = await res.json();
        const node = json?.data?.urlV2?.node;
        const parsed = parseJustWatchNode(node);
        if (parsed) return parsed;
      }
    }

    const filterObj: Record<string, any> = { searchQuery };
    if (preferredType === 'tv') {
      filterObj.objectTypes = ['SHOW'];
    } else if (preferredType === 'movie') {
      filterObj.objectTypes = ['MOVIE'];
    }

    const searchGql = {
      operationName: 'GetSearchTitles',
      variables: {
        searchTitlesFilter: filterObj,
        country: safeCountry,
        language: 'en',
        first: 6,
      },
      query: `
        query GetSearchTitles($searchTitlesFilter: TitleFilter!, $country: Country!, $language: Language!, $first: Int!) {
          popularTitles(country: $country, filter: $searchTitlesFilter, first: $first) {
            edges {
              node {
                ... on MovieOrShow {
                  ${JUSTWATCH_FRAGMENT_FIELDS}
                }
              }
            }
          }
        }
      `,
    };

    const searchRes = await fetch('https://apis.justwatch.com/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(searchGql),
    });

    if (searchRes.ok) {
      const searchJson = await searchRes.json();
      const edges = searchJson?.data?.popularTitles?.edges;
      if (Array.isArray(edges) && edges.length > 0) {
        for (const edge of edges) {
          const parsed = parseJustWatchNode(edge?.node);
          if (parsed) return parsed;
        }
      }
    }
  } catch {
    // Ignore GraphQL errors
  }
  return null;
}

/**
 * Queries JustWatch GraphQL for multiple browse/search results so Admin can
 * directly select & publish Movies or TV Shows from JustWatch inside the app.
 */
async function searchOrBrowseJustWatchCatalog(
  searchQuery: string,
  objectTypeFilter: 'ALL' | 'MOVIE' | 'SHOW' = 'ALL',
  country = 'IN',
  limit = 16
): Promise<JustWatchFullMetadata[]> {
  try {
    const filterObj: Record<string, any> = {};
    if (searchQuery.trim()) {
      filterObj.searchQuery = searchQuery.trim();
    }
    if (objectTypeFilter === 'MOVIE') {
      filterObj.objectTypes = ['MOVIE'];
    } else if (objectTypeFilter === 'SHOW') {
      filterObj.objectTypes = ['SHOW'];
    } else {
      filterObj.objectTypes = ['MOVIE', 'SHOW'];
    }

    const gqlBody = {
      operationName: 'GetSearchTitles',
      variables: {
        searchTitlesFilter: filterObj,
        country: (country || 'IN').toUpperCase(),
        language: 'en',
        first: Math.min(24, Math.max(4, limit)),
      },
      query: `
        query GetSearchTitles($searchTitlesFilter: TitleFilter!, $country: Country!, $language: Language!, $first: Int!) {
          popularTitles(country: $country, filter: $searchTitlesFilter, first: $first) {
            edges {
              node {
                ... on MovieOrShow {
                  ${JUSTWATCH_FRAGMENT_FIELDS}
                }
              }
            }
          }
        }
      `,
    };

    const res = await fetch('https://apis.justwatch.com/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(gqlBody),
    });

    if (!res.ok) return [];
    const json = await res.json();
    const edges = json?.data?.popularTitles?.edges;
    if (!Array.isArray(edges)) return [];

    const results: JustWatchFullMetadata[] = [];
    for (const edge of edges) {
      const parsed = parseJustWatchNode(edge?.node);
      if (parsed && (parsed.posterUrl || parsed.backdropUrl)) {
        results.push(parsed);
      }
    }
    return results;
  } catch {
    return [];
  }
}

/**
 * Resolves verified IMDb ID, TMDB ID, and real aired TV seasons & episodes
 * using IMDb Suggestion API + TVMaze API + JustWatch GraphQL so TV shows never
 * fail with "Episode not found".
 */
const tvInfoCache = new Map<
  string,
  {
    imdbId?: string;
    tmdbId?: number;
    seasonsCount: number;
    episodesCount: number;
    seasons: TvSeasonDetail[];
    cachedAt: number;
  }
>();

async function resolveVerifiedMediaIdsAndSeasons(params: {
  title: string;
  releaseYear?: number;
  mediaType: TMDBMediaType;
  tmdbId?: number;
  imdbId?: string;
}): Promise<{
  imdbId?: string;
  tmdbId?: number;
  seasonsCount: number;
  episodesCount: number;
  seasons: TvSeasonDetail[];
}> {
  const cleanTitle = (params.title || '').trim();
  const cacheKey = `${params.mediaType}:${cleanTitle.toLowerCase()}:${params.imdbId || ''}:${params.tmdbId || ''}`;
  const cached = tvInfoCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < 1000 * 60 * 30) {
    return cached;
  }

  let resolvedImdbId =
    params.imdbId && /^tt\d{5,12}$/i.test(params.imdbId.trim())
      ? params.imdbId.trim().toLowerCase()
      : undefined;

  let resolvedTmdbId =
    params.tmdbId && params.tmdbId > 0 && params.tmdbId !== 10000
      ? Number(params.tmdbId)
      : undefined;

  // Guard against previously buggy tmdbId that was just stripped digits of imdbId
  if (
    resolvedImdbId &&
    resolvedTmdbId &&
    String(resolvedTmdbId) === resolvedImdbId.replace(/\D/g, '').replace(/^0+/, '')
  ) {
    resolvedTmdbId = undefined;
  }

  let jwSeasonBreakdown: Array<{ seasonNumber: number; episodeCount: number }> =
    [];

  // 1. If tmdbId or imdbId is missing, query JustWatch GraphQL by title + mediaType
  if (cleanTitle && (!resolvedTmdbId || !resolvedImdbId || params.mediaType === 'tv')) {
    const jw = await queryJustWatchGraphQL(
      cleanTitle,
      'US',
      '',
      params.mediaType
    );
    if (jw) {
      if (!resolvedTmdbId && jw.tmdbId) resolvedTmdbId = jw.tmdbId;
      if (!resolvedImdbId && jw.imdbId) {
        resolvedImdbId = jw.imdbId.toLowerCase();
      }
      if (jw.seasonBreakdown.length > 0) {
        jwSeasonBreakdown = jw.seasonBreakdown;
      }
    }
  }

  // 2. If IMDb ID is still missing, query IMDb's fast public Suggestion API
  if (cleanTitle && !resolvedImdbId) {
    try {
      const imdbSugUrl = `https://v3.sg.media-imdb.com/suggestion/x/${encodeURIComponent(
        cleanTitle.slice(0, 50)
      )}.json`;
      const sugRes = await fetch(imdbSugUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      if (sugRes.ok) {
        const sugData = await sugRes.json();
        const items: any[] = Array.isArray(sugData?.d) ? sugData.d : [];
        const matched = items.find((item) => {
          if (!item?.id || !/^tt\d+$/i.test(item.id)) return false;
          if (params.releaseYear && item.y) {
            if (Math.abs(Number(item.y) - params.releaseYear) > 1) {
              return false;
            }
          } else if (resolvedTmdbId && params.releaseYear && !item.y) {
            return false;
          }
          const qid = String(item.qid || '').toLowerCase();
          if (params.mediaType === 'tv') {
            return qid.includes('tv') || qid.includes('series') || qid.includes('mini');
          }
          return qid === 'movie' || qid === 'feature' || !qid.includes('tv');
        });

        if (matched?.id) {
          resolvedImdbId = String(matched.id).toLowerCase();
        }
      }
    } catch {
      // Ignore IMDb suggestion error
    }
  }

  // 3. For TV Shows: Query TVMaze API for exact aired seasons & episodes (with titles, summaries, thumbnails, and airdate filtering!)
  const seasons: TvSeasonDetail[] = [];
  if (params.mediaType === 'tv' && (cleanTitle || resolvedImdbId)) {
    try {
      let tvMazeShowId: number | undefined = undefined;

      if (resolvedImdbId) {
        const lookupRes = await fetch(
          `https://api.tvmaze.com/lookup/shows?imdb=${encodeURIComponent(
            resolvedImdbId
          )}`
        );
        if (lookupRes.ok) {
          const showData = await lookupRes.json();
          if (showData?.id) {
            tvMazeShowId = Number(showData.id);
          }
        }
      }

      let embeddedShowData: any = null;
      if (tvMazeShowId) {
        const fullShowRes = await fetch(
          `https://api.tvmaze.com/shows/${tvMazeShowId}?embed[]=seasons&embed[]=episodes`
        );
        if (fullShowRes.ok) {
          embeddedShowData = await fullShowRes.json();
        }
      } else if (cleanTitle) {
        const singleRes = await fetch(
          `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(
            cleanTitle
          )}&embed[]=seasons&embed[]=episodes`
        );
        if (singleRes.ok) {
          embeddedShowData = await singleRes.json();
        }
      }

      if (embeddedShowData) {
        if (
          !resolvedImdbId &&
          embeddedShowData?.externals?.imdb &&
          /^tt\d+$/i.test(embeddedShowData.externals.imdb)
        ) {
          resolvedImdbId = String(
            embeddedShowData.externals.imdb
          ).toLowerCase();
        }

        const todayIso = new Date().toISOString().slice(0, 10);
        const rawEpisodes: any[] = Array.isArray(
          embeddedShowData?._embedded?.episodes
        )
          ? embeddedShowData._embedded.episodes
          : [];
        const rawSeasons: any[] = Array.isArray(
          embeddedShowData?._embedded?.seasons
        )
          ? embeddedShowData._embedded.seasons
          : [];

        // Group aired episodes by season number >= 1
        const seasonMap = new Map<number, TvSeasonEpisodeDetail[]>();

        for (const ep of rawEpisodes) {
          const sNum = Number(ep?.season) || 0;
          const eNum = Number(ep?.number) || 0;
          if (sNum < 1 || eNum < 1) continue;

          // Skip future unaired episodes so player never gets "Episode not found"
          if (ep?.airdate && String(ep.airdate) > todayIso) {
            continue;
          }

          const cleanSummary = ep?.summary
            ? String(ep.summary)
                .replace(/<[^>]+>/g, '')
                .trim()
            : '';

          const epDetail: TvSeasonEpisodeDetail = {
            episodeNumber: eNum,
            title: ep?.name ? String(ep.name).trim() : `Episode ${eNum}`,
            overview:
              cleanSummary ||
              `Season ${sNum}, Episode ${eNum} of ${cleanTitle || 'this series'}.`,
            runtime: Number(ep?.runtime) || Number(embeddedShowData?.averageRuntime) || 45,
            airDate: ep?.airdate || undefined,
            stillUrl:
              ep?.image?.original || ep?.image?.medium || undefined,
          };

          const list = seasonMap.get(sNum) || [];
          if (!list.some((existing) => existing.episodeNumber === eNum)) {
            list.push(epDetail);
          }
          seasonMap.set(sNum, list);
        }

        // Also check rawSeasons if rawEpisodes wasn't populated for a released season
        for (const sObj of rawSeasons) {
          const sNum = Number(sObj?.number) || 0;
          if (sNum < 1) continue;
          if (sObj?.premiereDate && String(sObj.premiereDate) > todayIso) {
            continue;
          }
          if (!seasonMap.has(sNum)) {
            const epOrder = Number(sObj?.episodeOrder) || 0;
            if (epOrder > 0) {
              const fallbackEps: TvSeasonEpisodeDetail[] = Array.from(
                { length: epOrder },
                (_, idx) => ({
                  episodeNumber: idx + 1,
                  title: `Episode ${idx + 1}`,
                  overview: `Season ${sNum}, Episode ${idx + 1} of ${cleanTitle}.`,
                  runtime: Number(embeddedShowData?.averageRuntime) || 45,
                })
              );
              seasonMap.set(sNum, fallbackEps);
            }
          }
        }

        const sortedSeasonNums = Array.from(seasonMap.keys()).sort(
          (a, b) => a - b
        );
        for (const sNum of sortedSeasonNums) {
          const eps = (seasonMap.get(sNum) || []).sort(
            (a, b) => a.episodeNumber - b.episodeNumber
          );
          if (eps.length > 0) {
            seasons.push({
              seasonNumber: sNum,
              episodeCount: eps.length,
              episodes: eps,
            });
          }
        }
      }
    } catch {
      // Ignore TVMaze error
    }
  }

  // Fallback to JustWatch seasonBreakdown if TVMaze didn't return seasons
  if (params.mediaType === 'tv' && seasons.length === 0 && jwSeasonBreakdown.length > 0) {
    for (const jwSeason of jwSeasonBreakdown) {
      const count = Math.max(1, jwSeason.episodeCount);
      seasons.push({
        seasonNumber: jwSeason.seasonNumber,
        episodeCount: count,
        episodes: Array.from({ length: count }, (_, idx) => ({
          episodeNumber: idx + 1,
          title: `Episode ${idx + 1}`,
          overview: `Season ${jwSeason.seasonNumber}, Episode ${idx + 1} of ${cleanTitle}.`,
          runtime: 45,
        })),
      });
    }
  }

  const seasonsCount =
    params.mediaType === 'tv' ? Math.max(1, seasons.length || 1) : 0;
  const episodesCount =
    params.mediaType === 'tv'
      ? Math.max(1, seasons[0]?.episodeCount || 8)
      : 0;

  const result = {
    imdbId: resolvedImdbId,
    tmdbId: resolvedTmdbId,
    seasonsCount,
    episodesCount,
    seasons,
    cachedAt: Date.now(),
  };

  tvInfoCache.set(cacheKey, result);
  return result;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-email');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.use('/api', (req, res, next) => {

    const clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'local';
    const check = checkRateLimit(clientIp);
    if (!check.allowed) {
      res.setHeader('Retry-After', String(check.retryAfterSec));
      res.status(429).json({
        error: 'Rate limit exceeded. Please wait before sending more requests.',
        retryAfterSeconds: check.retryAfterSec,
      });
      return;
    }
    next();
  });

  /**
   * GET /api/justwatch/search
   * Directly searches or browses popular/trending Movies and TV Shows from JustWatch
   * so Admin can select, preview, and publish titles without leaving the app.
   */
  app.get('/api/justwatch/search', async (req, res) => {
    try {
      const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      const rawType =
        typeof req.query.type === 'string'
          ? req.query.type.toUpperCase()
          : 'MOVIE';
      const objectTypeFilter: 'ALL' | 'MOVIE' | 'SHOW' =
        rawType === 'SHOW' ? 'SHOW' : rawType === 'ALL' ? 'ALL' : 'MOVIE';
      const country =
        typeof req.query.country === 'string' && req.query.country.length === 2
          ? req.query.country.toUpperCase()
          : 'IN';

      const items = await searchOrBrowseJustWatchCatalog(
        q,
        objectTypeFilter,
        country,
        16
      );

      res.json({
        items: items.map((item) => {
          const tmdbNumericId =
            item.tmdbId && item.tmdbId > 0 ? item.tmdbId : 157336;
          return {
            title: item.title,
            releaseYear: item.releaseYear,
            synopsis: item.synopsis,
            tagline: item.tagline,
            durationMinutes: item.durationMinutes,
            maturityRating: item.maturityRating,
            genres: item.genres,
            tmdbId: item.tmdbId || null,
            imdbId: item.imdbId || null,
            imdbScore: item.imdbScore || null,
            popularScore: item.popularScore,
            mediaType: item.mediaType,
            contentType: item.mediaType === 'tv' ? 'series' : 'movie',
            seasonsCount: item.seasonsCount,
            episodesCount: item.episodesCount,
            posterUrl: item.posterUrl || '',
            backdropUrl: item.backdropUrl || item.posterUrl || '',
            extraBackdrops: item.extraBackdrops,
            directorOrCreator: item.directorOrCreator,
            cast: item.cast,
            justWatchUrl: item.justWatchUrl,
            cinesrcEmbedUrl:
              item.mediaType === 'tv'
                ? `https://vidly.pro/tv/${tmdbNumericId}/1/1`
                : `https://vidly.pro/movie/${tmdbNumericId}`,
          };
        }),
      });
    } catch {
      res.status(500).json({
        error: 'Failed to search JustWatch catalog.',
        items: [],
      });
    }
  });

  /**
   * GET /api/tv-info
   * Resolves verified IMDb ID, TMDB ID, and exact aired seasons & episodes
   * for any TV series or movie so no episode ever shows "Episode not found".
   */
  app.get('/api/tv-info', async (req, res) => {
    try {
      const title =
        typeof req.query.title === 'string' ? req.query.title.trim() : '';
      const mediaType: TMDBMediaType =
        req.query.mediaType === 'movie' ? 'movie' : 'tv';
      const tmdbId = req.query.tmdbId ? Number(req.query.tmdbId) : undefined;
      const imdbId =
        typeof req.query.imdbId === 'string' ? req.query.imdbId.trim() : undefined;
      const releaseYear = req.query.year ? Number(req.query.year) : undefined;

      const resolved = await resolveVerifiedMediaIdsAndSeasons({
        title,
        releaseYear,
        mediaType,
        tmdbId,
        imdbId,
      });

      res.json(resolved);
    } catch {
      res.status(500).json({
        seasonsCount: 1,
        episodesCount: 8,
        seasons: [],
      });
    }
  });

  /**
   * POST /api/justwatch/extract
   * Given a JustWatch link or title, automatically extracts full metadata,
   * cast & director photos, verified IMDb + TMDB IDs, and real season/episode counts.
   */
  app.post('/api/justwatch/extract', async (req, res) => {
    try {
      const justWatchUrl =
        typeof req.body?.justWatchUrl === 'string'
          ? req.body.justWatchUrl.trim()
          : '';
      const fallbackTitle =
        typeof req.body?.title === 'string' ? req.body.title.trim() : '';
      const preferredType: TMDBMediaType | undefined =
        req.body?.mediaType === 'tv'
          ? 'tv'
          : req.body?.mediaType === 'movie'
          ? 'movie'
          : undefined;

      if (!justWatchUrl && !fallbackTitle) {
        res.status(400).json({
          error: 'Please provide a JustWatch URL or movie/TV show title.',
        });
        return;
      }

      const parsedInfo = parseJustWatchUrl(justWatchUrl || fallbackTitle);
      let extractedTitle = (fallbackTitle || parsedInfo.slugTitle || '').trim();

      if (
        (!extractedTitle ||
          RESERVED_JUSTWATCH_SEGMENTS.has(extractedTitle.toLowerCase())) &&
        !parsedInfo.urlPath
      ) {
        res.status(400).json({
          error:
            'Skipped blank/non-title JustWatch page (such as /in/search without a movie slug). Please use a movie or TV show link.',
        });
        return;
      }

      let extractedYear = 2024;
      let extractedSynopsis = '';
      let extractedTagline = '';
      let extractedPosterUrl = '';
      let extractedBackdropUrl = '';
      let extraBackdrops: string[] = [];
      let extractedTmdbId: number | undefined = undefined;
      let extractedImdbId: string | undefined = undefined;
      let extractedImdbScore: number | undefined = undefined;
      let extractedPopularScore = 92;
      let extractedMediaType: TMDBMediaType =
        preferredType || parsedInfo.mediaType;
      let extractedDuration = extractedMediaType === 'tv' ? 45 : 120;
      let extractedMaturity: 'G' | 'PG' | 'PG-13' | 'TV-PG' | 'TV-14' =
        extractedMediaType === 'tv' ? 'TV-14' : 'PG-13';
      let extractedGenres: Genre[] = ['Drama'];
      let extractedSeasonsCount = extractedMediaType === 'tv' ? 1 : 0;
      let extractedEpisodesCount = extractedMediaType === 'tv' ? 8 : 0;
      let extractedDirector = 'Featured Creator';
      let extractedCast: string[] = ['Featured Cast'];
      let resolvedJustWatchUrl = justWatchUrl;
      let rawCredits: Array<{
        name: string;
        role: 'DIRECTOR' | 'ACTOR';
        characterName?: string;
        personId?: number;
      }> = [];

      // Step 1: Query JustWatch GraphQL API (fast ~150ms, works for both urlPath and searchQuery)
      const gqlResult = await queryJustWatchGraphQL(
        extractedTitle,
        parsedInfo.country,
        parsedInfo.urlPath,
        preferredType || parsedInfo.mediaType
      );

      if (gqlResult) {
        extractedTitle = gqlResult.title;
        extractedYear = gqlResult.releaseYear;
        extractedSynopsis = gqlResult.synopsis;
        extractedTagline = gqlResult.tagline;
        extractedDuration = gqlResult.durationMinutes;
        extractedMaturity = gqlResult.maturityRating;
        extractedGenres = gqlResult.genres;
        if (gqlResult.tmdbId) extractedTmdbId = gqlResult.tmdbId;
        if (gqlResult.imdbId) extractedImdbId = gqlResult.imdbId;
        if (gqlResult.imdbScore) extractedImdbScore = gqlResult.imdbScore;
        extractedPopularScore = gqlResult.popularScore;
        extractedMediaType = gqlResult.mediaType;
        extractedSeasonsCount = gqlResult.seasonsCount;
        extractedEpisodesCount = gqlResult.episodesCount;
        if (gqlResult.posterUrl) extractedPosterUrl = gqlResult.posterUrl;
        if (gqlResult.backdropUrl) extractedBackdropUrl = gqlResult.backdropUrl;
        extraBackdrops = gqlResult.extraBackdrops;
        extractedDirector = gqlResult.directorOrCreator;
        extractedCast = gqlResult.cast;
        if (gqlResult.justWatchUrl) {
          resolvedJustWatchUrl = gqlResult.justWatchUrl;
        }
        rawCredits = gqlResult.rawCredits;
      }

      // Step 2: Scrape HTML fallback ONLY if GraphQL returned nothing (with fast 2.5s timeout)
      if (!gqlResult && justWatchUrl.startsWith('http')) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2500);
          const htmlRes = await fetch(justWatchUrl, {
            signal: controller.signal,
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              'Accept-Language': 'en-US,en;q=0.9',
            },
          });
          clearTimeout(timeoutId);
          if (htmlRes.ok) {
            const html = await htmlRes.text();
            const ldJsonMatches = html.match(
              /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
            );
            if (ldJsonMatches) {
              for (const block of ldJsonMatches) {
                try {
                  const inner = block
                    .replace(/<script[^>]*>/i, '')
                    .replace(/<\/script>/i, '')
                    .trim();
                  const ld = JSON.parse(inner);
                  if (
                    ld &&
                    (ld['@type'] === 'Movie' || ld['@type'] === 'TVSeries')
                  ) {
                    if (
                      ld.name &&
                      !RESERVED_JUSTWATCH_SEGMENTS.has(
                        String(ld.name).trim().toLowerCase()
                      )
                    ) {
                      extractedTitle = String(ld.name).trim();
                    }
                    if (ld.description && !extractedSynopsis) {
                      extractedSynopsis = String(ld.description);
                    }
                    const dateStr = ld.dateCreated || ld.datePublished;
                    if (dateStr) {
                      const yr = Number(String(dateStr).slice(0, 4));
                      if (yr >= 1900 && yr <= 2100) extractedYear = yr;
                    }
                  }
                } catch {
                  // Ignore JSON-LD parse error
                }
              }
            }
          }
        } catch {
          // Ignore HTML scrape timeout/error
        }
      }

      if (
        !extractedTitle ||
        RESERVED_JUSTWATCH_SEGMENTS.has(extractedTitle.trim().toLowerCase())
      ) {
        res.status(400).json({
          error:
            'Could not find a valid movie or TV show title for this link.',
        });
        return;
      }

      // Step 3: Verify IMDb ID, TMDB ID, and real aired season/episode counts + resolve cast photos in parallel
      const [creditsWithPhotos, verifiedMediaInfo] = await Promise.all([
        resolvePersonPhotos(rawCredits),
        extractedMediaType === 'tv' || !extractedImdbId || !extractedTmdbId
          ? resolveVerifiedMediaIdsAndSeasons({
              title: extractedTitle,
              releaseYear: extractedYear,
              mediaType: extractedMediaType,
              tmdbId: extractedTmdbId,
              imdbId: extractedImdbId,
            })
          : Promise.resolve({
              imdbId: extractedImdbId,
              tmdbId: extractedTmdbId,
              seasonsCount: 0,
              episodesCount: 0,
              seasons: [],
            }),
      ]);

      if (verifiedMediaInfo.imdbId) {
        extractedImdbId = verifiedMediaInfo.imdbId;
      }
      if (verifiedMediaInfo.tmdbId) {
        extractedTmdbId = verifiedMediaInfo.tmdbId;
      }
      if (extractedMediaType === 'tv') {
        if (verifiedMediaInfo.seasonsCount > 0) {
          extractedSeasonsCount = verifiedMediaInfo.seasonsCount;
        }
        if (verifiedMediaInfo.episodesCount > 0) {
          extractedEpisodesCount = verifiedMediaInfo.episodesCount;
        }
      }

      // Compute a unique deterministic numeric ID if tmdbId is missing so different titles NEVER collide on 157336
      let finalTmdbId = extractedTmdbId && extractedTmdbId > 0 ? extractedTmdbId : 0;
      if (!finalTmdbId) {
        if (extractedImdbId && /^tt\d+$/i.test(extractedImdbId)) {
          finalTmdbId =
            Number(extractedImdbId.replace(/\D/g, '').replace(/^0+/, '')) || 900000;
        } else {
          let hash = 0;
          const seedStr = `${extractedMediaType}:${extractedTitle.toLowerCase()}:${extractedYear}`;
          for (let i = 0; i < seedStr.length; i++) {
            hash = (hash * 31 + seedStr.charCodeAt(i)) % 90000000;
          }
          finalTmdbId = 10000000 + Math.abs(hash);
        }
      }

      const streamTmdbId =
        finalTmdbId > 0
          ? finalTmdbId
          : extractedTmdbId && extractedTmdbId > 0
          ? extractedTmdbId
          : 157336;

      const cinesrcEmbedUrl =
        extractedMediaType === 'tv'
          ? `https://vidly.pro/tv/${streamTmdbId}/1/1`
          : `https://vidly.pro/movie/${streamTmdbId}`;

      res.json({
        title: extractedTitle,
        releaseYear: extractedYear,
        synopsis:
          extractedSynopsis ||
          `Stream ${extractedTitle} (${extractedYear}) in 4K UHD.`,
        tagline:
          extractedTagline ||
          `Watch ${extractedTitle} (${extractedYear}) in HD`,
        durationMinutes: extractedDuration,
        maturityRating: extractedMaturity,
        genres: extractedGenres,
        popularScore: extractedPopularScore,
        imdbScore: extractedImdbScore || null,
        imdbId: extractedImdbId || null,
        posterUrl: extractedPosterUrl,
        backdropUrl: extractedBackdropUrl || extractedPosterUrl,
        extraBackdrops,
        tmdbId: finalTmdbId,
        mediaType: extractedMediaType,
        contentType: extractedMediaType === 'tv' ? 'series' : 'movie',
        seasonsCount: extractedSeasonsCount,
        episodesCount: extractedEpisodesCount,
        seasons: verifiedMediaInfo.seasons,
        directorOrCreator: extractedDirector,
        cast: extractedCast,
        credits: creditsWithPhotos,
        justWatchUrl: resolvedJustWatchUrl,
        cinesrcEmbedUrl,
      });
    } catch {
      res.status(500).json({
        error: 'Failed to extract details from JustWatch link.',
      });
    }
  });

  app.get('/api/config', (_req, res) => {
    const creds = getTmdbCredentials();
    const adSlotsEnabledDefault = process.env.AD_SLOTS_ENABLED !== 'false';

    res.json({
      platformName: 'ZAPPY',
      externalMetadataConfigured: creds.configured,
      metadataSource: creds.configured ? 'tmdb_live' : 'firestore_catalog',
      defaultTerritory: process.env.DEFAULT_TERRITORY || 'US',
      authorizedAssetsCount: authorizedAssetsRegistry.length,
      videoAdConfig: serverVideoAdConfig,
      adConfig: {
        enabled: adSlotsEnabledDefault,
        providerStatus: 'unconfigured_demo',
        providerName: 'ZAPPY Ad Slot Placeholder (Separated From Video Player)',
        showHomepageBanners: true,
        showDetailsBanner: true,
      },
    });
  });

  const handleCatalogOrDiscover = async (
    req: express.Request,
    res: express.Response
  ) => {
    try {
      const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      const creds = getTmdbCredentials();
      let items: MediaItem[] = getHydratedFallbackCatalog();

      if (creds.configured && q) {
        try {
          const tmdbData = await fetchFromTmdbServer('/search/multi', {
            query: q,
            include_adult: 'false',
          });
          if (tmdbData && Array.isArray(tmdbData.results)) {
            items = tmdbData.results
              .filter(
                (r: any) =>
                  r.media_type !== 'person' && (r.title || r.name)
              )
              .slice(0, 18)
              .map((r: any) => mapTmdbRecordToMediaItem(r));
          }
        } catch {
          // Ignore TMDB error
        }
      }

      res.json({
        items,
        total: items.length,
        source: creds.configured ? 'tmdb_live' : 'firestore_catalog',
        tmdbConfigured: creds.configured,
      });
    } catch {
      res.status(500).json({
        error: 'Failed to load catalog data.',
        items: [],
      });
    }
  };

  app.get('/api/catalog', handleCatalogOrDiscover);
  app.get('/api/tmdb/discover', handleCatalogOrDiscover);

  app.get('/api/playback/:mediaType/:tmdbId', (req, res) => {
    const mediaTypeParam = req.params.mediaType === 'tv' ? 'tv' : 'movie';
    const tmdbIdNum = Number(req.params.tmdbId) || 0;
    const seasonNum = req.query.season ? Number(req.query.season) : 1;
    const episodeNum = req.query.episode ? Number(req.query.episode) : 1;
    const territory = (
      typeof req.query.territory === 'string' && req.query.territory.trim()
        ? req.query.territory.trim().toUpperCase()
        : process.env.DEFAULT_TERRITORY || 'US'
    ).slice(0, 5);

    const embedUrl =
      mediaTypeParam === 'tv'
        ? `https://vidly.pro/tv/${tmdbIdNum}/${seasonNum}/${episodeNum}`
        : `https://vidly.pro/movie/${tmdbIdNum}`;

    const cinesrcAsset: AuthorizedVideoAsset = {
      assetId: `stream-${mediaTypeParam}-${tmdbIdNum}`,
      tmdbId: tmdbIdNum,
      mediaType: mediaTypeParam,
      seasonNumber: seasonNum,
      episodeNumber: episodeNum,
      title: `Third-Party Embed Stream (${mediaTypeParam.toUpperCase()} #${tmdbIdNum})`,
      streamFormat: 'cinesrc',
      manifestOrFileUrl: embedUrl,
      rightsStatus: 'pending',
      allowedTerritories: ['ALL'],
      validFrom: '2020-01-01',
      validUntil: '2035-12-31',
      durationSeconds: 7200,
      resolutionLabel: 'Third-Party Embed · Vidly.pro',
      licenseNotice: 'Third-Party Embed Stream (Licensing Unverified)',
      attribution: 'Vidly.pro Third-Party Embed Player',
    };

    const response: PlaybackResolutionResponse = {
      authorized: false,
      tmdbId: tmdbIdNum,
      mediaType: mediaTypeParam,
      seasonNumber: seasonNum,
      episodeNumber: episodeNum,
      territory,
      reasonCode: 'rights_unverified',
      message:
        'Third-party embed stream URL resolved; content licensing is not verified by ZappyFun.',
      asset: cinesrcAsset,
      videoAdConfig: serverVideoAdConfig,
    };
    res.json(response);
  });

  app.get('/api/admin/assets', async (req, res) => {
    const authResult = await verifyAdminRequest(req);
    if (!authResult.authorized) {
      res.status(authResult.statusCode).json({ error: authResult.error });
      return;
    }
    res.json({
      assets: authorizedAssetsRegistry,
      videoAdConfig: serverVideoAdConfig,
    });
  });

  app.post('/api/admin/ima-config', async (req, res) => {
    const authResult = await verifyAdminRequest(req);
    if (!authResult.authorized) {
      res.status(authResult.statusCode).json({ error: authResult.error });
      return;
    }
    const body = req.body || {};
    serverVideoAdConfig = {
      imaEnabled:
        typeof body.imaEnabled === 'boolean'
          ? body.imaEnabled
          : serverVideoAdConfig.imaEnabled,
      testMode:
        typeof body.testMode === 'boolean'
          ? body.testMode
          : serverVideoAdConfig.testMode,
      vastTagUrl:
        typeof body.vastTagUrl === 'string'
          ? body.vastTagUrl.trim()
          : serverVideoAdConfig.vastTagUrl,
      enablePreRoll:
        typeof body.enablePreRoll === 'boolean'
          ? body.enablePreRoll
          : serverVideoAdConfig.enablePreRoll,
      enableMidRoll:
        typeof body.enableMidRoll === 'boolean'
          ? body.enableMidRoll
          : serverVideoAdConfig.enableMidRoll,
    };
    res.json({ videoAdConfig: serverVideoAdConfig });
  });

  app.get('/api/support', async (req, res) => {
    const authResult = await verifyAdminRequest(req);
    if (!authResult.authorized) {
      res
        .status(authResult.statusCode)
        .json({ error: authResult.error, messages: [] });
      return;
    }
    res.json({
      messages: supportTicketsRegistry.sort(
        (a, b) => b.createdAtMs - a.createdAtMs
      ),
    });
  });

  app.post('/api/support', (req, res) => {
    const body = req.body || {};
    const id =
      typeof body.id === 'string' && body.id.trim()
        ? body.id.trim().slice(0, 120)
        : `msg-${Date.now()}`;
    const firstName = String(body.firstName || 'Guest').trim().slice(0, 80);
    const lastName = String(body.lastName || 'User').trim().slice(0, 80);
    const email = String(body.email || '').trim().slice(0, 160);
    const phone = String(body.phone || '').trim().slice(0, 40);
    const message = String(body.message || '').trim().slice(0, 2000);
    const senderUid = String(body.senderUid || 'guest').trim().slice(0, 128);

    if (!message) {
      res.status(400).json({ error: 'Message content is required.' });
      return;
    }

    const existingIdx = supportTicketsRegistry.findIndex((t) => t.id === id);
    const ticket: ServerSupportTicket = {
      id,
      firstName: firstName || 'Guest',
      lastName: lastName || '-',
      email: email || 'no-email@zappy.app',
      phone,
      message,
      senderUid,
      status: 'open',
      createdAtMs: Date.now(),
    };

    if (existingIdx >= 0) {
      supportTicketsRegistry[existingIdx] = ticket;
    } else {
      supportTicketsRegistry.unshift(ticket);
    }

    res.json({ ticket });
  });

  app.patch('/api/support/:id', async (req, res) => {
    const authResult = await verifyAdminRequest(req);
    if (!authResult.authorized) {
      res.status(authResult.statusCode).json({ error: authResult.error });
      return;
    }
    const id = req.params.id;
    const nextStatus =
      req.body?.status === 'resolved' ? 'resolved' : 'open';
    supportTicketsRegistry = supportTicketsRegistry.map((t) =>
      t.id === id ? { ...t, status: nextStatus } : t
    );
    res.json({ ok: true });
  });

  app.delete('/api/support/:id', async (req, res) => {
    const authResult = await verifyAdminRequest(req);
    if (!authResult.authorized) {
      res.status(authResult.statusCode).json({ error: authResult.error });
      return;
    }
    const id = req.params.id;
    supportTicketsRegistry = supportTicketsRegistry.filter((t) => t.id !== id);
    res.json({ ok: true });
  });

  /**
   * GET /api/legal
   * Returns the authoritative LegalPagesConfig from code/server state.
   */
  app.get('/api/legal', (_req, res) => {
    res.json({ legalPages: serverLegalPages });
  });

  /**
   * PUT / POST /api/legal
   * Updates the LegalPagesConfig in memory AND writes the updated legal documents
   * directly into /src/data/legalDocuments.ts so changes are persisted in source code.
   */
  const handleSaveLegalToCode = async (
    req: express.Request,
    res: express.Response
  ) => {
    try {
      const incoming = req.body?.legalPages || req.body;
      if (!incoming || typeof incoming !== 'object') {
        res.status(400).json({ error: 'Invalid legalPages payload.' });
        return;
      }

      const normalized = normalizeLegalPagesConfig({
        ...serverLegalPages,
        ...incoming,
        updatedAtMs: Date.now(),
      });

      serverLegalPages = normalized;
      const wroteToCode = persistLegalPagesToSourceFile(normalized);

      res.json({
        ok: true,
        wroteToCode,
        legalPages: serverLegalPages,
      });
    } catch (err) {
      res.status(500).json({
        error:
          'Failed to update legal documents in code: ' +
          (err instanceof Error ? err.message : String(err)),
      });
    }
  };

  app.put('/api/legal', handleSaveLegalToCode);
  app.post('/api/legal', handleSaveLegalToCode);

  /**
   * AUTH & EMAIL OTP ROUTES
   */
  // 1. Get SMTP Public Status (whether password is saved and ready to send via Gmail)
  app.get('/api/auth/smtp-status', (_req, res) => {
    res.json(getPublicSmtpStatus());
  });

  // 1.5. Check if email is already registered (secure server-side verification)
  app.post('/api/auth/check-email', async (req, res) => {
    try {
      const email = req.body?.email;
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        res.status(400).json({ error: 'Valid email address is required.' });
        return;
      }
      const cleanEmail = email.trim().toLowerCase();
      const status = await checkEmailRegisteredOnServer(cleanEmail);
      res.json({
        email: cleanEmail,
        registered: status.registered,
        hasPassword: status.hasPassword ?? (status.registered === true),
        isGithubOnly: status.isGithubOnly ?? false,
        providers: status.providers || [],
        fallbackToClient: status.registered === null,
      });
    } catch (err) {
      res.status(500).json({
        error:
          'Failed to verify email status: ' +
          (err instanceof Error ? err.message : String(err)),
        fallbackToClient: true,
      });
    }
  });

  // 2. Request cryptographically secure 6-digit OTP for email verification
  app.post('/api/auth/send-otp', async (req, res) => {
    try {
      const email = req.body?.email;
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        res.status(400).json({ error: 'Valid email address is required.' });
        return;
      }
      const cleanEmail = email.trim().toLowerCase();
      const otp = generateAndStoreOtp(cleanEmail);
      const result = await sendOtpEmail(cleanEmail, otp);
      if (!result.success) {
        res.status(500).json({
          ok: false,
          error:
            result.error ||
            'Failed to send verification code. Please check your email address.',
        });
        return;
      }
      res.json({
        ok: true,
        message: `6-digit verification code sent to ${cleanEmail}.`,
      });
    } catch (err) {
      res.status(500).json({
        error:
          'Failed to send verification code: ' +
          (err instanceof Error ? err.message : String(err)),
      });
    }
  });

  // 2.5 Record a confirmed registered or logged-in email
  app.post('/api/auth/record-user', (req, res) => {
    const email = req.body?.email;
    if (email && typeof email === 'string' && email.includes('@')) {
      recordRegisteredEmail(email.trim().toLowerCase());
    }
    res.json({ ok: true });
  });

  // 3. Verify 6-digit OTP and issue single-use registration authorization token
  app.post('/api/auth/verify-otp', (req, res) => {
    try {
      const { email, otp } = req.body || {};
      if (!email || !otp) {
        res
          .status(400)
          .json({ valid: false, reason: 'Email and 6-digit code are required.' });
        return;
      }
      const result = verifyOtp(String(email), String(otp));
      res.json(result);
    } catch (err) {
      res.status(500).json({
        valid: false,
        reason: 'Verification error: ' + (err instanceof Error ? err.message : String(err)),
      });
    }
  });

  // 3.5 Validate registration authorization token before creating account
  app.post('/api/auth/validate-registration-token', (req, res) => {
    try {
      const { email, registrationToken } = req.body || {};
      if (!email || !registrationToken) {
        res.status(400).json({
          valid: false,
          reason: 'Email and registration authorization token are required.',
        });
        return;
      }
      const result = validateRegistrationToken(String(registrationToken), String(email));
      res.json(result);
    } catch (err) {
      res.status(500).json({
        valid: false,
        reason: 'Token validation error: ' + (err instanceof Error ? err.message : String(err)),
      });
    }
  });

  // 3.6 Atomically consume registration authorization token upon account creation
  app.post('/api/auth/consume-registration-token', (req, res) => {
    try {
      const { email, registrationToken } = req.body || {};
      if (!email || !registrationToken) {
        res.status(400).json({
          valid: false,
          reason: 'Email and registration authorization token are required.',
        });
        return;
      }
      const result = consumeRegistrationToken(String(registrationToken), String(email));
      if (result.valid) {
        recordRegisteredEmail(String(email).trim().toLowerCase());
      }
      res.json(result);
    } catch (err) {
      res.status(500).json({
        valid: false,
        reason: 'Token consumption error: ' + (err instanceof Error ? err.message : String(err)),
      });
    }
  });

  // 4. Update SMTP configuration (Admin protected)
  app.post('/api/admin/smtp', async (req, res) => {
    const authResult = await verifyAdminRequest(req);
    if (!authResult.authorized) {
      res.status(authResult.statusCode).json({ error: authResult.error });
      return;
    }
    const body = req.body || {};
    saveSmtpConfig(body);
    res.json({
      ok: true,
      status: getPublicSmtpStatus(),
    });
  });

  // 5. Test SMTP connection & send test email (Admin protected)
  app.post('/api/admin/test-smtp', async (req, res) => {
    const authResult = await verifyAdminRequest(req);
    if (!authResult.authorized) {
      res.status(authResult.statusCode).json({ error: authResult.error });
      return;
    }
    const targetEmail = req.body?.email || authResult.admin.email;
    const result = await sendTestEmail(targetEmail);
    res.json(result);
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`ZAPPY server running on http://0.0.0.0:${PORT}`);
  });

  server.on('error', (err) => {
    console.error('Server socket error:', err);
  });
}

process.on('unhandledRejection', (reason) => {
  console.warn('Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
