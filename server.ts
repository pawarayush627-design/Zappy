import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { SAMPLE_CATALOG } from './src/data/catalog.ts';
import {
  INITIAL_AUTHORIZED_VIDEO_ASSETS,
  AUTHORIZED_VIDEO_SOURCES,
} from './src/data/videoSources.ts';
import {
  AuthorizedVideoAsset,
  Genre,
  MediaItem,
  PlaybackResolutionResponse,
  RightsStatus,
  StreamFormat,
  TMDBMediaType,
  VideoAdConfig,
} from './src/types/media.ts';
import {
  createPosterDataUri,
  createBackdropDataUri,
} from './src/utils/artworkGenerator.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
const maxRequestsPerMinute = 120;
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
  12: 'Action',
  16: 'Animation',
  35: 'Comedy',
  80: 'Thriller',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Sci-Fi',
  9648: 'Mystery',
  878: 'Sci-Fi',
  53: 'Thriller',
  10759: 'Action',
  10765: 'Sci-Fi',
};

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

function mapTmdbRecordToMediaItem(raw: any, forcedType?: TMDBMediaType): MediaItem {
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
    directorOrCreator: 'TMDB Catalog Verified',
    cast: ['TMDB Cast Ensemble'],
    availabilityStatus: isPlayable ? 'playable_demo' : 'catalog_preview',
    availabilityNote: isPlayable
      ? `Verified Authorized Stream · TMDB ${mediaType.toUpperCase()} #${tmdbId}`
      : `TMDB Metadata Only (#${tmdbId}) · Not available to stream yet`,
    popularScore: Math.min(
      99,
      Math.max(70, Math.round((Number(raw.vote_average) || 7.5) * 10))
    ),
    recentlyAdded: releaseYear >= 2024,
    seasonsCount: mediaType === 'tv' ? Number(raw.number_of_seasons) || 1 : undefined,
    episodesCount: mediaType === 'tv' ? Number(raw.number_of_episodes) || 8 : undefined,
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
        ? `Verified Authorized Stream · TMDB ${item.mediaType.toUpperCase()} #${item.tmdbId}`
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

/**
 * Helper to extract slug title and media type from a JustWatch URL
 * e.g. https://www.justwatch.com/us/movie/interstellar -> { slugTitle: 'Interstellar', mediaType: 'movie', country: 'US' }
 * e.g. https://www.justwatch.com/in/tv-show/breaking-bad -> { slugTitle: 'Breaking Bad', mediaType: 'tv', country: 'IN' }
 */
function parseJustWatchUrl(rawUrl: string): {
  slugTitle: string;
  mediaType: TMDBMediaType;
  country: string;
  urlPath: string;
} {
  try {
    const parsed = new URL(
      rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`
    );
    const parts = parsed.pathname.split('/').filter(Boolean);
    const country = parts[0] && parts[0].length === 2 ? parts[0].toUpperCase() : 'US';
    const typeSegment = (parts[1] || '').toLowerCase();
    const mediaType: TMDBMediaType =
      typeSegment.includes('tv') ||
      typeSegment.includes('show') ||
      typeSegment.includes('series') ||
      typeSegment.includes('serie')
        ? 'tv'
        : 'movie';
    const rawSlug = parts[parts.length - 1] || '';
    const slugTitle = rawSlug
      .split('-')
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ''))
      .join(' ')
      .trim();

    return {
      slugTitle: slugTitle || 'Untitled',
      mediaType,
      country,
      urlPath: parsed.pathname,
    };
  } catch {
    return {
      slugTitle: rawUrl.trim(),
      mediaType: 'movie',
      country: 'US',
      urlPath: '',
    };
  }
}

/**
 * Queries JustWatch's public GraphQL API to retrieve high-res backdrop/banner images,
 * poster image, TMDB ID, release year, and synopsis for a JustWatch URL or title!
 */
async function queryJustWatchGraphQL(
  searchQuery: string,
  country = 'US',
  urlPath = ''
): Promise<{
  title?: string;
  releaseYear?: number;
  synopsis?: string;
  posterUrl?: string;
  backdropUrl?: string;
  tmdbId?: number;
  mediaType?: TMDBMediaType;
  genres?: Genre[];
  durationMinutes?: number;
} | null> {
  try {
    // 1. Try UrlV2 lookup if we have a concrete JustWatch path
    if (urlPath) {
      const urlQuery = {
        operationName: 'GetUrlTitleDetails',
        variables: { fullPath: urlPath, country: country || 'US', language: 'en' },
        query: `
          query GetUrlTitleDetails($fullPath: String!, $country: Country!, $language: Language!) {
            urlV2(fullPath: $fullPath) {
              node {
                ... on MovieOrShow {
                  id
                  objectId
                  objectType
                  content(country: $country, language: $language) {
                    title
                    originalReleaseYear
                    shortDescription
                    runtime
                    externalIds {
                      tmdbId
                    }
                    posterUrl(profile: S718, format: JPG)
                    backdrops(profile: S1920, format: JPG) {
                      backdropUrl
                    }
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
        body: JSON.stringify(urlQuery),
      });

      if (res.ok) {
        const json = await res.json();
        const node = json?.data?.urlV2?.node;
        const content = node?.content;
        if (content) {
          const rawPoster = content.posterUrl
            ? `https://images.justwatch.com${content.posterUrl
                .replace('{profile}', 's718')
                .replace('{format}', 'jpg')}`
            : undefined;
          const firstBackdrop =
            Array.isArray(content.backdrops) && content.backdrops.length > 0
              ? content.backdrops[0].backdropUrl
              : undefined;
          const rawBackdrop = firstBackdrop
            ? `https://images.justwatch.com${firstBackdrop
                .replace('{profile}', 's1920')
                .replace('{format}', 'jpg')}`
            : rawPoster;

          return {
            title: content.title,
            releaseYear: Number(content.originalReleaseYear) || 2024,
            synopsis: content.shortDescription,
            posterUrl: rawPoster,
            backdropUrl: rawBackdrop,
            tmdbId: Number(content.externalIds?.tmdbId) || undefined,
            mediaType: node.objectType === 'SHOW' ? 'tv' : 'movie',
            durationMinutes: Number(content.runtime) || undefined,
          };
        }
      }
    }

    // 2. Fallback to searchTitles GraphQL query by title
    const searchGql = {
      operationName: 'GetSearchTitles',
      variables: {
        searchTitlesFilter: { searchQuery },
        country: country || 'US',
        language: 'en',
        first: 5,
      },
      query: `
        query GetSearchTitles($searchTitlesFilter: TitleFilter!, $country: Country!, $language: Language!, $first: Int!) {
          popularTitles(country: $country, filter: $searchTitlesFilter, first: $first) {
            edges {
              node {
                id
                objectId
                objectType
                content(country: $country, language: $language) {
                  title
                  originalReleaseYear
                  shortDescription
                  runtime
                  externalIds {
                    tmdbId
                  }
                  posterUrl(profile: S718, format: JPG)
                  backdrops(profile: S1920, format: JPG) {
                    backdropUrl
                  }
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
        const node = edges[0].node;
        const content = node?.content;
        if (content) {
          const rawPoster = content.posterUrl
            ? `https://images.justwatch.com${content.posterUrl
                .replace('{profile}', 's718')
                .replace('{format}', 'jpg')}`
            : undefined;
          const firstBackdrop =
            Array.isArray(content.backdrops) && content.backdrops.length > 0
              ? content.backdrops[0].backdropUrl
              : undefined;
          const rawBackdrop = firstBackdrop
            ? `https://images.justwatch.com${firstBackdrop
                .replace('{profile}', 's1920')
                .replace('{format}', 'jpg')}`
            : rawPoster;

          return {
            title: content.title,
            releaseYear: Number(content.originalReleaseYear) || 2024,
            synopsis: content.shortDescription,
            posterUrl: rawPoster,
            backdropUrl: rawBackdrop,
            tmdbId: Number(content.externalIds?.tmdbId) || undefined,
            mediaType: node.objectType === 'SHOW' ? 'tv' : 'movie',
            durationMinutes: Number(content.runtime) || undefined,
          };
        }
      }
    }
  } catch {
    // Ignore GraphQL errors and fall through to HTML scraping
  }
  return null;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

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
   * POST /api/justwatch/extract
   * Given a JustWatch link (e.g. https://www.justwatch.com/us/movie/dune-part-two)
   * or title, automatically extracts the JustWatch Banner/Backdrop image, Poster image,
   * Title, Synopsis, Release Year, Media Type, and TMDB ID (plus auto-generates the
   * CineSrc.st embed link: https://cinesrc.st/embed/movie/:tmdbId or /tv/:tmdbId).
   */
  app.post('/api/justwatch/extract', async (req, res) => {
    try {
      const justWatchUrl =
        typeof req.body?.justWatchUrl === 'string'
          ? req.body.justWatchUrl.trim()
          : '';
      const fallbackTitle =
        typeof req.body?.title === 'string' ? req.body.title.trim() : '';

      if (!justWatchUrl && !fallbackTitle) {
        res.status(400).json({
          error: 'Please provide a JustWatch URL or movie/TV show title.',
        });
        return;
      }

      const parsedInfo = parseJustWatchUrl(justWatchUrl || fallbackTitle);
      let extractedTitle = fallbackTitle || parsedInfo.slugTitle;
      let extractedYear = 2024;
      let extractedSynopsis = '';
      let extractedPosterUrl = '';
      let extractedBackdropUrl = '';
      let extractedTmdbId: number | undefined = undefined;
      let extractedMediaType: TMDBMediaType = parsedInfo.mediaType;
      let extractedDuration = parsedInfo.mediaType === 'tv' ? 45 : 115;

      // Step 1: Query JustWatch GraphQL API (fastest & provides native S1920 backdrops + S718 posters + TMDB ID!)
      const gqlResult = await queryJustWatchGraphQL(
        extractedTitle,
        parsedInfo.country,
        parsedInfo.urlPath
      );

      if (gqlResult) {
        if (gqlResult.title) extractedTitle = gqlResult.title;
        if (gqlResult.releaseYear) extractedYear = gqlResult.releaseYear;
        if (gqlResult.synopsis) extractedSynopsis = gqlResult.synopsis;
        if (gqlResult.posterUrl) extractedPosterUrl = gqlResult.posterUrl;
        if (gqlResult.backdropUrl) extractedBackdropUrl = gqlResult.backdropUrl;
        if (gqlResult.tmdbId) extractedTmdbId = gqlResult.tmdbId;
        if (gqlResult.mediaType) extractedMediaType = gqlResult.mediaType;
        if (gqlResult.durationMinutes) extractedDuration = gqlResult.durationMinutes;
      }

      // Step 2: If backdrop or poster is still missing and a JustWatch HTTP URL was provided, scrape the HTML meta/images
      if (
        justWatchUrl.startsWith('http') &&
        (!extractedBackdropUrl || !extractedPosterUrl)
      ) {
        try {
          const htmlRes = await fetch(justWatchUrl, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              'Accept-Language': 'en-US,en;q=0.9',
            },
          });
          if (htmlRes.ok) {
            const html = await htmlRes.text();

            // Look for JustWatch backdrop URLs in HTML
            const backdropMatches = html.match(
              /https:\/\/images\.justwatch\.com\/backdrop\/\d+\/s\d+\/[^"'\s>]+/gi
            );
            if (backdropMatches && backdropMatches.length > 0 && !extractedBackdropUrl) {
              extractedBackdropUrl = backdropMatches[0]
                .replace(/\/s\d+\//i, '/s1440/')
                .replace(/\.avif$/i, '.webp');
            }

            // Look for JustWatch poster URLs in HTML
            const posterMatches = html.match(
              /https:\/\/images\.justwatch\.com\/poster\/\d+\/s\d+\/[^"'\s>]+/gi
            );
            if (posterMatches && posterMatches.length > 0 && !extractedPosterUrl) {
              extractedPosterUrl = posterMatches[0]
                .replace(/\/s\d+\//i, '/s718/')
                .replace(/\.avif$/i, '.webp');
            }

            // Look for og:image
            const ogImgMatch = html.match(
              /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
            );
            if (ogImgMatch?.[1]) {
              if (!extractedBackdropUrl) extractedBackdropUrl = ogImgMatch[1];
              if (!extractedPosterUrl) extractedPosterUrl = ogImgMatch[1];
            }

            // Look for og:title
            const ogTitleMatch = html.match(
              /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i
            );
            if (ogTitleMatch?.[1] && !gqlResult?.title) {
              extractedTitle = ogTitleMatch[1]
                .replace(/\s*-\s*watch.*$/i, '')
                .replace(/\s*streaming.*$/i, '')
                .trim();
            }

            // Look for og:description
            const ogDescMatch = html.match(
              /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i
            );
            if (ogDescMatch?.[1] && !extractedSynopsis) {
              extractedSynopsis = ogDescMatch[1].trim();
            }
          }
        } catch {
          // Ignore HTML scrape error
        }
      }

      // Step 3: If TMDB API is configured on server and we still need TMDB ID or images, enrich via TMDB
      const creds = getTmdbCredentials();
      if (creds.configured && (!extractedTmdbId || !extractedBackdropUrl)) {
        try {
          const tmdbSearch = await fetchFromTmdbServer('/search/multi', {
            query: extractedTitle,
          });
          const firstHit = tmdbSearch?.results?.find(
            (r: any) => r.media_type === 'movie' || r.media_type === 'tv'
          );
          if (firstHit) {
            if (!extractedTmdbId) extractedTmdbId = Number(firstHit.id);
            if (!extractedBackdropUrl && firstHit.backdrop_path) {
              extractedBackdropUrl = `https://image.tmdb.org/t/p/w1280${firstHit.backdrop_path}`;
            }
            if (!extractedPosterUrl && firstHit.poster_path) {
              extractedPosterUrl = `https://image.tmdb.org/t/p/w500${firstHit.poster_path}`;
            }
            if (!extractedSynopsis && firstHit.overview) {
              extractedSynopsis = firstHit.overview;
            }
          }
        } catch {
          // Ignore TMDB enrichment error
        }
      }

      const finalTmdbId = extractedTmdbId || 10000;
      const cinesrcEmbedUrl = `https://cinesrc.st/embed/${extractedMediaType}/${finalTmdbId}`;

      res.json({
        title: extractedTitle,
        releaseYear: extractedYear,
        synopsis:
          extractedSynopsis ||
          `Stream ${extractedTitle} (${extractedYear}) on ZAPPY via CineSrc.st embed player.`,
        posterUrl: extractedPosterUrl,
        backdropUrl: extractedBackdropUrl || extractedPosterUrl,
        tmdbId: extractedTmdbId || null,
        mediaType: extractedMediaType,
        contentType: extractedMediaType === 'tv' ? 'series' : 'movie',
        durationMinutes: extractedDuration,
        cinesrcEmbedUrl,
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to extract artwork from JustWatch link.',
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
        ? `https://cinesrc.st/embed/tv/${tmdbIdNum}?s=${seasonNum}&e=${episodeNum}`
        : `https://cinesrc.st/embed/movie/${tmdbIdNum}`;

    const cinesrcAsset: AuthorizedVideoAsset = {
      assetId: `cinesrc-${mediaTypeParam}-${tmdbIdNum}`,
      tmdbId: tmdbIdNum,
      mediaType: mediaTypeParam,
      seasonNumber: seasonNum,
      episodeNumber: episodeNum,
      title: `CineSrc.st Embed Stream (${mediaTypeParam.toUpperCase()} #${tmdbIdNum})`,
      streamFormat: 'cinesrc',
      manifestOrFileUrl: embedUrl,
      rightsStatus: 'verified',
      allowedTerritories: ['ALL'],
      validFrom: '2020-01-01',
      validUntil: '2035-12-31',
      durationSeconds: 7200,
      resolutionLabel: '1080p HD · CineSrc.st Embed',
      licenseNotice: 'Embedded via CineSrc.st',
      attribution: 'CineSrc.st Player',
    };

    const response: PlaybackResolutionResponse = {
      authorized: true,
      tmdbId: tmdbIdNum,
      mediaType: mediaTypeParam,
      seasonNumber: seasonNum,
      episodeNumber: episodeNum,
      territory,
      reasonCode: 'authorized',
      message: 'CineSrc.st embed stream ready.',
      asset: cinesrcAsset,
      videoAdConfig: serverVideoAdConfig,
    };
    res.json(response);
  });

  app.get('/api/admin/assets', (_req, res) => {
    res.json({
      assets: authorizedAssetsRegistry,
      videoAdConfig: serverVideoAdConfig,
    });
  });

  app.post('/api/admin/ima-config', (req, res) => {
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ZAPPY server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
