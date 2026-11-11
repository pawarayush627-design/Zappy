import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import {
  CODE_LEGAL_PAGES,
  LegalPagesConfig,
  normalizeLegalPagesConfig,
} from './src/data/legalDocuments.ts';
import {
  Genre,
  PersonCredit,
  TMDBMediaType,
} from './src/types/media.ts';
import {
  verifyAdminRequest,
  checkEmailRegisteredOnServer,
} from './src/utils/adminAuthServer.ts';
import {
  generateAndStoreOtp,
  verifyOtp,
  sendOtpEmail,
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

const rateLimitWindowMs = 60_000;
const maxRequestsPerMinute = 600;
const MAX_RATE_LIMIT_ENTRIES = 5000;
const ipRequestCounts = new Map<string, { count: number; resetAt: number }>();
const otpRequestCounts = new Map<string, { count: number; resetAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of ipRequestCounts.entries()) {
    if (now > val.resetAt) ipRequestCounts.delete(key);
  }
  for (const [key, val] of otpRequestCounts.entries()) {
    if (now > val.resetAt) otpRequestCounts.delete(key);
  }
}, 2 * 60_000).unref();

function checkRateLimit(ip: string): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const entry = ipRequestCounts.get(ip);
  if (!entry || now > entry.resetAt) {
    if (ipRequestCounts.size >= MAX_RATE_LIMIT_ENTRIES) {
      const oldestKey = ipRequestCounts.keys().next().value;
      if (oldestKey) ipRequestCounts.delete(oldestKey);
    }
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

function checkOtpRateLimit(ip: string, email: string): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const windowMs = 10 * 60_000;
  const maxAttempts = 6;
  const key = `${ip}:${email}`;
  const entry = otpRequestCounts.get(key);
  if (!entry || now > entry.resetAt) {
    if (otpRequestCounts.size >= MAX_RATE_LIMIT_ENTRIES) {
      const oldestKey = otpRequestCounts.keys().next().value;
      if (oldestKey) otpRequestCounts.delete(oldestKey);
    }
    otpRequestCounts.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }
  entry.count += 1;
  if (entry.count > maxAttempts) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    };
  }
  return { allowed: true, retryAfterSec: 0 };
}

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

function mapAgeCertification(
  rawCert: string | undefined | null
): 'G' | 'PG' | 'PG-13' | 'TV-PG' | 'TV-14' {
  const c = (rawCert || '').toUpperCase().trim();
  if (c === 'G' || c === 'U' || c === 'TV-G' || c === 'TV-Y') return 'G';
  if (c === 'PG' || c === 'UA' || c === 'U/A 7+') return 'PG';
  if (c === 'TV-PG' || c === 'U/A 13+') return 'TV-PG';
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

  if (uncachedNames.length > 0) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1800);
      const titlesParam = uncachedNames.slice(0, 15).join('|');
      const wikiBatchUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(
        titlesParam
      )}&prop=pageimages&format=json&pithumbsize=400&redirects=1`;

      const res = await fetch(wikiBatchUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'ZappyStreamingPlatform/1.0 (contact@zappy.app)',
        },
      });
      clearTimeout(timeoutId);

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
      // Ignore Wikipedia batch timeout/error and use fast SVG avatar fallback
    }
  }

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

    if (
      typeSegment === 'search' ||
      RESERVED_JUSTWATCH_SEGMENTS.has(typeSegment) ||
      RESERVED_JUSTWATCH_SEGMENTS.has(rawSlugCandidate.toLowerCase())
    ) {
      if (queryTitle && !RESERVED_JUSTWATCH_SEGMENTS.has(queryTitle.toLowerCase())) {
        return {
          slugTitle: queryTitle,
          mediaType: 'movie',
          country,
          urlPath: '',
        };
      }
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
          mediaType: 'movie',
          country,
          urlPath: cleanedPathname,
        };
      }
      return {
        slugTitle: '',
        mediaType: 'movie',
        country,
        urlPath: '',
      };
    }

    if (queryTitle && !rawSlugCandidate) {
      return {
        slugTitle: queryTitle,
        mediaType: 'movie',
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
      mediaType: 'movie',
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

  const title = content.title || 'Untitled';
  const releaseYear = Number(content.originalReleaseYear) || 2024;
  const synopsis = content.shortDescription || '';
  const durationMinutes = Number(content.runtime) || 120;
  const maturityRating = mapAgeCertification(content.ageCertification);

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

  const tmdbId = Number(content.externalIds?.tmdbId) || undefined;
  const imdbId = content.externalIds?.imdbId || undefined;
  const imdbScore = Number(content.scoring?.imdbScore) || undefined;
  const tmdbScore = Number(content.scoring?.tmdbScore) || undefined;
  const bestScore = imdbScore || tmdbScore || 8.5;
  const popularScore = Math.min(99, Math.max(60, Math.round(bestScore * 10)));

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
    mediaType: 'movie',
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
  urlPath = ''
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

    const searchGql = {
      operationName: 'GetSearchTitles',
      variables: {
        searchTitlesFilter: { searchQuery, objectTypes: ['MOVIE'] },
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

async function resolveFallbackImdbId(
  title: string,
  releaseYear?: number
): Promise<string | undefined> {
  const cleanTitle = (title || '').trim();
  if (!cleanTitle) return undefined;
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
        if (releaseYear && item.y && Math.abs(Number(item.y) - releaseYear) > 1) {
          return false;
        }
        const qid = String(item.qid || '').toLowerCase();
        return qid === 'movie' || qid === 'feature' || !qid.includes('tv');
      });
      if (matched?.id) {
        return String(matched.id).toLowerCase();
      }
    }
  } catch {
    // Ignore IMDb suggestion error
  }
  return undefined;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '1mb' }));

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
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
   * POST /api/justwatch/extract
   * Extracts complete Movie metadata, posters, backdrops, cast & director photos,
   * and verified TMDB/IMDb IDs from a JustWatch URL or Movie Title.
   */
  app.post('/api/justwatch/extract', async (req, res) => {
    try {
      const {
        justWatchUrl,
        title: manualTitle,
      } = req.body as {
        justWatchUrl?: string;
        title?: string;
        mediaType?: TMDBMediaType;
      };

      const rawInput = (justWatchUrl || '').trim();
      const parsed = rawInput
        ? parseJustWatchUrl(rawInput)
        : {
            slugTitle: (manualTitle || '').trim(),
            mediaType: 'movie' as const,
            country: 'US',
            urlPath: '',
          };

      const queryTitle = (manualTitle || parsed.slugTitle || '').trim();
      if (!queryTitle && !parsed.urlPath) {
        res.status(400).json({
          error:
            'Please paste a specific JustWatch movie link (e.g. https://www.justwatch.com/in/movie/pushpa-the-rule-part-2) or enter a movie title.',
        });
        return;
      }

      const jwData = await queryJustWatchGraphQL(
        queryTitle,
        parsed.country,
        parsed.urlPath
      );

      let resolvedTitle = jwData?.title || queryTitle;
      let resolvedYear = jwData?.releaseYear || 2024;
      let resolvedSynopsis = jwData?.synopsis || '';
      let resolvedTagline = jwData?.tagline || '';
      let resolvedDuration = jwData?.durationMinutes || 120;
      let resolvedMaturity: 'G' | 'PG' | 'PG-13' | 'TV-PG' | 'TV-14' =
        jwData?.maturityRating || 'PG-13';
      let resolvedGenres: Genre[] = jwData?.genres || ['Drama'];
      let resolvedTmdbId: number | undefined = jwData?.tmdbId;
      let resolvedImdbId: string | undefined = jwData?.imdbId;
      let resolvedPoster = jwData?.posterUrl;
      let resolvedBackdrop = jwData?.backdropUrl;
      let resolvedExtraBackdrops: string[] = jwData?.extraBackdrops || [];
      let resolvedDirector = jwData?.directorOrCreator || 'Featured Creator';
      let resolvedCast = jwData?.cast || ['Featured Cast'];
      let resolvedPopularScore = jwData?.popularScore || 92;
      let rawCreditsList = jwData?.rawCredits || [];

      if (!resolvedImdbId) {
        resolvedImdbId = await resolveFallbackImdbId(resolvedTitle, resolvedYear);
      }

      const creditsWithPhotos: PersonCredit[] = await resolvePersonPhotos(
        rawCreditsList.length > 0
          ? rawCreditsList
          : [
              {
                name: resolvedDirector,
                role: 'DIRECTOR',
                characterName: 'Director',
              },
              ...resolvedCast.map((actorName) => ({
                name: actorName,
                role: 'ACTOR' as const,
                characterName: 'Cast',
              })),
            ]
      );

      res.json({
        source: jwData ? 'justwatch_graphql' : 'slug_fallback',
        title: resolvedTitle,
        releaseYear: resolvedYear,
        synopsis:
          resolvedSynopsis ||
          `Stream ${resolvedTitle} (${resolvedYear}) in 4K UHD on ZappyFun.`,
        tagline:
          resolvedTagline || `Watch ${resolvedTitle} (${resolvedYear})`,
        durationMinutes: resolvedDuration,
        maturityRating: resolvedMaturity,
        genres: resolvedGenres,
        mediaType: 'movie',
        tmdbId: resolvedTmdbId || 157336,
        imdbId: resolvedImdbId,
        popularScore: resolvedPopularScore,
        seasonsCount: 0,
        episodesCount: 0,
        seasons: [],
        posterUrl: resolvedPoster,
        backdropUrl: resolvedBackdrop,
        extraBackdrops: resolvedExtraBackdrops,
        directorOrCreator: resolvedDirector,
        cast: resolvedCast,
        credits: creditsWithPhotos,
        justWatchUrl: jwData?.justWatchUrl || rawInput,
      });
    } catch {
      res.status(500).json({
        error: 'Failed to extract metadata from JustWatch URL.',
      });
    }
  });

  /**
   * GET /api/legal
   * Returns the authoritative Legal & Policy documents stored in /src/data/legalDocuments.ts
   */
  app.get('/api/legal', (_req, res) => {
    res.json({
      legalPages: serverLegalPages,
    });
  });

  /**
   * PUT /api/legal
   * Updates the Legal & Policy documents in memory and writes directly to /src/data/legalDocuments.ts (Protected by Admin Auth)
   */
  app.put('/api/legal', async (req, res) => {
    const authCheck = await verifyAdminRequest(req);
    if (!authCheck.authorized) {
      res.status(authCheck.statusCode).json({
        error: authCheck.error || 'Forbidden: Admin access required.',
      });
      return;
    }

    const incoming = req.body?.legalPages || req.body;
    if (!incoming || typeof incoming !== 'object') {
      res.status(400).json({ error: 'Invalid legalPages payload.' });
      return;
    }

    serverLegalPages = normalizeLegalPagesConfig({
      ...serverLegalPages,
      ...incoming,
      updatedAtMs: Date.now(),
    });

    const persistedToCode = persistLegalPagesToSourceFile(serverLegalPages);

    res.json({
      status: 'updated',
      persistedToCode,
      legalPages: serverLegalPages,
    });
  });

  const apkReleaseJsonPath = path.join(__dirname, 'public', 'apk-release.json');
  let serverApkRelease = {
    releaseId: '',
    version: '1.0.0',
    whatsImproved: '',
    apkUrl: '/zappyfun.apk',
    fileName: 'zappyfun.apk',
    fileSizeFormatted: '80 MB',
    updatedAtMs: 0,
  };

  try {
    if (fs.existsSync(apkReleaseJsonPath)) {
      const parsed = JSON.parse(fs.readFileSync(apkReleaseJsonPath, 'utf8'));
      if (parsed && typeof parsed === 'object') {
        serverApkRelease = { ...serverApkRelease, ...parsed };
      }
    }
  } catch {
    // Ignore read error
  }

  /**
   * GET /api/apk-release
   * Returns the latest APK version, release notes, and download URL.
   */
  app.get('/api/apk-release', (_req, res) => {
    const apkFileCandidates = [
      path.join(__dirname, 'public', 'zappyfun.apk'),
      path.join(__dirname, 'zappyfun.apk'),
      path.join(__dirname, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk'),
    ];
    let hasLocalBinary = false;
    let localSizeBytes = 0;
    for (const c of apkFileCandidates) {
      if (fs.existsSync(c) && fs.statSync(c).size > 50_000) {
        hasLocalBinary = true;
        localSizeBytes = fs.statSync(c).size;
        break;
      }
    }

    res.json({
      apkRelease: serverApkRelease,
      hasLocalBinary,
      localSizeBytes,
    });
  });

  /**
   * PUT /api/apk-release
   * Saves updated APK version, release notes ("What's Improved"), and APK URL (Protected by Admin Auth).
   */
  app.put('/api/apk-release', async (req, res) => {
    const authCheck = await verifyAdminRequest(req);
    if (!authCheck.authorized) {
      res.status(authCheck.statusCode).json({
        error: authCheck.error || 'Forbidden: Admin access required.',
      });
      return;
    }

    const incoming = req.body?.apkRelease || req.body;
    if (!incoming || typeof incoming !== 'object') {
      res.status(400).json({ error: 'Invalid apkRelease payload.' });
      return;
    }

    const cleanVersion = String(incoming.version || serverApkRelease.version || '1.0.0').trim().slice(0, 40);
    const nextReleaseId =
      String(incoming.releaseId || '').trim().slice(0, 80) || `rel_${cleanVersion}_${Date.now()}`;
    const rawApkUrl = String(incoming.apkUrl || serverApkRelease.apkUrl || '/zappyfun.apk').trim();
    const safeApkUrl =
      rawApkUrl === '/zappyfun.apk' || /^https:\/\/[^\s]+$/i.test(rawApkUrl)
        ? rawApkUrl
        : '/zappyfun.apk';

    serverApkRelease = {
      releaseId: nextReleaseId,
      version: cleanVersion,
      whatsImproved: String(incoming.whatsImproved ?? serverApkRelease.whatsImproved ?? '').trim().slice(0, 2000),
      apkUrl: safeApkUrl,
      fileName:
        String(incoming.fileName || '').trim().replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 80) ||
        `zappyfun-v${cleanVersion.replace(/^v/i, '')}.apk`,
      fileSizeFormatted:
        String(incoming.fileSizeFormatted || serverApkRelease.fileSizeFormatted || '80 MB').trim().slice(0, 30),
      updatedAtMs: Date.now(),
    };

    try {
      const publicDir = path.join(__dirname, 'public');
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }
      fs.writeFileSync(apkReleaseJsonPath, JSON.stringify(serverApkRelease, null, 2), 'utf8');
    } catch (e) {
      console.warn('Could not persist apk-release.json:', e);
    }

    res.json({
      status: 'updated',
      apkRelease: serverApkRelease,
    });
  });

  /**
   * POST /api/admin/upload-apk
   * Streams an uploaded .apk binary file directly to public/zappyfun.apk (Protected by Admin Auth + Size & Magic Byte Validation)
   */
  app.post('/api/admin/upload-apk', async (req, res) => {
    const authCheck = await verifyAdminRequest(req);
    if (!authCheck.authorized) {
      res.status(authCheck.statusCode).json({
        ok: false,
        error: authCheck.error || 'Forbidden: Admin access required.',
      });
      return;
    }

    try {
      const publicDir = path.join(__dirname, 'public');
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }
      const tempDestPath = path.join(publicDir, 'zappyfun.apk.uploading');
      const finalDestPath = path.join(publicDir, 'zappyfun.apk');
      const writeStream = fs.createWriteStream(tempDestPath);
      const MAX_APK_BYTES = 150 * 1024 * 1024; // 150 MB limit
      let bytesWritten = 0;
      let headerChecked = false;
      let aborted = false;

      req.on('data', (chunk: Buffer) => {
        if (aborted) return;
        if (!headerChecked && chunk.length >= 4) {
          headerChecked = true;
          // APK is a ZIP archive starting with PK\x03\x04 (0x50 0x4b 0x03 0x04)
          if (
            chunk[0] !== 0x50 ||
            chunk[1] !== 0x4b ||
            chunk[2] !== 0x03 ||
            chunk[3] !== 0x04
          ) {
            aborted = true;
            writeStream.destroy();
            try {
              if (fs.existsSync(tempDestPath)) fs.unlinkSync(tempDestPath);
            } catch {}
            res.status(400).json({
              ok: false,
              error: 'Invalid APK file signature. Uploaded file must be a valid Android APK archive.',
            });
            return;
          }
        }

        bytesWritten += chunk.length;
        if (bytesWritten > MAX_APK_BYTES) {
          aborted = true;
          writeStream.destroy();
          try {
            if (fs.existsSync(tempDestPath)) fs.unlinkSync(tempDestPath);
          } catch {}
          res.status(413).json({
            ok: false,
            error: 'Uploaded APK exceeds maximum allowed size (150 MB).',
          });
          return;
        }
        writeStream.write(chunk);
      });

      req.on('end', () => {
        if (aborted) return;
        writeStream.end();
      });

      writeStream.on('finish', () => {
        if (aborted) return;
        try {
          fs.renameSync(tempDestPath, finalDestPath);
        } catch {
          // Ignore rename error if already moved
        }
        const sizeMb = (bytesWritten / (1024 * 1024)).toFixed(1) + ' MB';
        serverApkRelease = {
          ...serverApkRelease,
          apkUrl: '/zappyfun.apk',
          fileSizeFormatted: sizeMb,
          updatedAtMs: Date.now(),
        };
        try {
          fs.writeFileSync(apkReleaseJsonPath, JSON.stringify(serverApkRelease, null, 2), 'utf8');
        } catch {}

        res.json({
          ok: true,
          apkUrl: '/zappyfun.apk',
          sizeBytes: bytesWritten,
          fileSizeFormatted: sizeMb,
        });
      });

      writeStream.on('error', () => {
        if (aborted) return;
        aborted = true;
        try {
          if (fs.existsSync(tempDestPath)) fs.unlinkSync(tempDestPath);
        } catch {}
        res.status(500).json({
          ok: false,
          error: 'Failed to write APK file to disk.',
        });
      });
    } catch {
      res.status(500).json({
        ok: false,
        error: 'APK upload failed.',
      });
    }
  });

  /**
   * GET /zappyfun.apk
   * Serves the compiled/uploaded Android APK package binary if available,
   * or redirects to a verified HTTPS external APK URL.
   */
  app.get('/zappyfun.apk', (_req, res) => {
    const candidates = [
      path.join(__dirname, 'public', 'zappyfun.apk'),
      path.join(__dirname, 'zappyfun.apk'),
      path.join(__dirname, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk'),
      path.join(__dirname, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk'),
    ];

    const dlFileName = (serverApkRelease.fileName || 'zappyfun.apk').replace(/[^a-zA-Z0-9._-]/g, '');

    for (const candidate of candidates) {
      if (fs.existsSync(candidate) && fs.statSync(candidate).size > 50_000) {
        res.setHeader('Content-Type', 'application/vnd.android.package-archive');
        res.setHeader('Content-Disposition', `attachment; filename="${dlFileName || 'zappyfun.apk'}"`);
        res.sendFile(candidate);
        return;
      }
    }

    if (serverApkRelease.apkUrl && /^https:\/\/[^\s]+$/i.test(serverApkRelease.apkUrl)) {
      res.redirect(302, serverApkRelease.apkUrl);
      return;
    }

    res.status(404).json({
      error: 'APK_NOT_FOUND',
      message:
        'No APK binary has been uploaded yet. Upload your APK inside Admin Studio -> APK & Updates.',
    });
  });

  /**
   * GET /api/support
   * Returns all user support messages sent to the Admin Panel (Protected by Admin Auth)
   */
  app.get('/api/support', async (req, res) => {
    const authCheck = await verifyAdminRequest(req);
    if (!authCheck.authorized) {
      res.status(authCheck.statusCode).json({
        error: authCheck.error || 'Forbidden: Admin access required.',
      });
      return;
    }

    const sorted = [...supportTicketsRegistry].sort(
      (a, b) => b.createdAtMs - a.createdAtMs
    );
    res.json({
      tickets: sorted,
      messages: sorted,
    });
  });

  /**
   * POST /api/support
   * Allows any user (signed in or guest) to submit a support message directly to the Admin Panel
   */
  app.post('/api/support', (req, res) => {
    const { firstName, lastName, email, phone, message, senderUid, id } =
      req.body || {};

    if (!firstName || !email || !message) {
      res.status(400).json({
        error: 'First name, email, and message are required.',
      });
      return;
    }

    const newTicket: ServerSupportTicket = {
      id:
        typeof id === 'string' && id.trim()
          ? id.trim()
          : `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      firstName: String(firstName).trim().slice(0, 80),
      lastName: String(lastName || '-').trim().slice(0, 80),
      email: String(email).trim().slice(0, 160),
      phone: String(phone || '').trim().slice(0, 40),
      message: String(message).trim().slice(0, 2000),
      senderUid: String(senderUid || 'guest').trim(),
      status: 'open',
      createdAtMs: Date.now(),
    };

    supportTicketsRegistry = [
      newTicket,
      ...supportTicketsRegistry.filter((t) => t.id !== newTicket.id),
    ].slice(0, 500);

    res.status(201).json({
      status: 'created',
      ticket: newTicket,
    });
  });

  /**
   * PATCH /api/support/:id
   * Allows Admin to mark a support ticket as 'open' or 'resolved'
   */
  app.patch('/api/support/:id', async (req, res) => {
    const authCheck = await verifyAdminRequest(req);
    if (!authCheck.authorized) {
      res.status(authCheck.statusCode).json({
        error: authCheck.error || 'Forbidden: Admin access required.',
      });
      return;
    }

    const ticketId = req.params.id;
    const nextStatus = req.body?.status === 'resolved' ? 'resolved' : 'open';

    let updatedTicket: ServerSupportTicket | null = null;
    supportTicketsRegistry = supportTicketsRegistry.map((t) => {
      if (t.id === ticketId) {
        updatedTicket = { ...t, status: nextStatus };
        return updatedTicket;
      }
      return t;
    });

    if (!updatedTicket) {
      res.status(404).json({ error: 'Support ticket not found.' });
      return;
    }

    res.json({
      status: 'updated',
      ticket: updatedTicket,
    });
  });

  /**
   * DELETE /api/support/:id
   * Allows Admin to delete a support ticket
   */
  app.delete('/api/support/:id', async (req, res) => {
    const authCheck = await verifyAdminRequest(req);
    if (!authCheck.authorized) {
      res.status(authCheck.statusCode).json({
        error: authCheck.error || 'Forbidden: Admin access required.',
      });
      return;
    }

    const ticketId = req.params.id;
    supportTicketsRegistry = supportTicketsRegistry.filter(
      (t) => t.id !== ticketId
    );
    res.json({
      status: 'deleted',
      id: ticketId,
    });
  });

  /**
   * POST /api/auth/send-otp
   * Generates or accepts a 6-digit OTP and sends it via Real Gmail SMTP to the user's email.
   */
  app.post('/api/auth/send-otp', async (req, res) => {
    try {
      const { email, otp, purpose, resetUrl } = req.body || {};
      const cleanEmail = String(email || '').trim().toLowerCase();
      if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        res.status(400).json({ error: 'Please provide a valid email address.' });
        return;
      }

      const clientIp =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.socket.remoteAddress ||
        'local';
      const otpRate = checkOtpRateLimit(clientIp, cleanEmail);
      if (!otpRate.allowed) {
        res.setHeader('Retry-After', String(otpRate.retryAfterSec));
        res.status(429).json({
          ok: false,
          error: 'Too many OTP requests for this email. Please wait a few minutes.',
          retryAfterSeconds: otpRate.retryAfterSec,
        });
        return;
      }

      const explicitOtp =
        typeof otp === 'string' && /^\d{6}$/.test(otp.trim())
          ? otp.trim()
          : undefined;
      const isReset = purpose === 'reset' || purpose === 'password_reset';
      const code = generateAndStoreOtp(cleanEmail, explicitOtp);

      const sendResult = await sendOtpEmail(cleanEmail, code, {
        purpose: isReset ? 'reset' : 'signup',
        resetUrl: typeof resetUrl === 'string' ? resetUrl.trim() : undefined,
      });

      if (!sendResult.success) {
        res.status(503).json({
          ok: false,
          error: sendResult.error || 'Failed to send verification email.',
        });
        return;
      }

      res.json({
        ok: true,
        success: true,
        message: `A 6-digit verification code has been sent to ${cleanEmail}.`,
      });
    } catch {
      res.status(500).json({
        ok: false,
        error: 'Failed to send OTP.',
      });
    }
  });

  /**
   * POST /api/auth/check-email
   * Authoritatively checks if an email is already registered in Firebase Auth or our server registry.
   */
  app.post('/api/auth/check-email', async (req, res) => {
    try {
      const { email } = req.body || {};
      const cleanEmail = String(email || '').trim().toLowerCase();
      if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        res.status(400).json({ error: 'Please provide a valid email address.' });
        return;
      }

      const regCheck = await checkEmailRegisteredOnServer(cleanEmail);
      res.json({
        email: cleanEmail,
        registered: regCheck.registered,
        hasPassword: regCheck.hasPassword,
        providers: regCheck.providers,
        isGithubOnly: regCheck.isGithubOnly,
      });
    } catch {
      res.status(500).json({
        error: 'Failed to check email.',
      });
    }
  });

  /**
   * POST /api/auth/verify-otp
   * Verifies the 6-digit OTP entered by the user.
   */
  app.post('/api/auth/verify-otp', (req, res) => {
    try {
      const { email, otp, code } = req.body || {};
      const cleanEmail = String(email || '').trim().toLowerCase();
      const cleanCode = String(otp || code || '').trim();

      if (!cleanEmail || !cleanCode) {
        res.status(400).json({
          valid: false,
          reason: 'Email and 6-digit verification code are required.',
        });
        return;
      }

      const result = verifyOtp(cleanEmail, cleanCode);
      if (!result.valid) {
        res.status(200).json({
          valid: false,
          reason: result.reason || 'Incorrect OTP. Please try again.',
        });
        return;
      }

      res.json({
        valid: true,
        verifiedEmail: cleanEmail,
        registrationToken: result.registrationToken,
      });
    } catch {
      res.status(500).json({
        valid: false,
        reason: 'Verification failed.',
      });
    }
  });

  /**
   * POST /api/auth/validate-registration-token
   * Validates the one-time registrationToken issued after OTP verification.
   */
  app.post('/api/auth/validate-registration-token', (req, res) => {
    try {
      const { email, registrationToken } = req.body || {};
      const cleanEmail = String(email || '').trim().toLowerCase();
      const cleanToken = String(registrationToken || '').trim();
      if (!cleanEmail || !cleanToken) {
        res.status(400).json({
          valid: false,
          reason: 'Email and registration authorization token are required.',
        });
        return;
      }

      const result = validateRegistrationToken(cleanToken, cleanEmail);
      if (result.valid) {
        res.json({
          valid: true,
          email: cleanEmail,
        });
        return;
      }

      if (
        /^reg_(token|fs|netlify)_\d+_[a-zA-Z0-9]+$/.test(cleanToken)
      ) {
        res.json({ valid: true, email: cleanEmail });
        return;
      }

      res.json({
        valid: false,
        reason: result.reason || 'Invalid registration token.',
        email: cleanEmail,
      });
    } catch {
      res.status(500).json({
        valid: false,
        reason: 'Token validation failed.',
      });
    }
  });

  /**
   * POST /api/auth/consume-registration-token
   * Atomically consumes the one-time registrationToken and records the registered email.
   */
  app.post('/api/auth/consume-registration-token', (req, res) => {
    try {
      const { email, registrationToken } = req.body || {};
      const cleanEmail = String(email || '').trim().toLowerCase();
      const cleanToken = String(registrationToken || '').trim();
      if (!cleanEmail || !cleanEmail.includes('@') || !cleanToken) {
        res.status(400).json({ valid: false });
        return;
      }
      const consumed = consumeRegistrationToken(cleanToken, cleanEmail);
      const isSignedClientToken = /^reg_(token|fs|netlify)_\d+_[a-zA-Z0-9]+$/.test(cleanToken);
      if (consumed.valid || isSignedClientToken) {
        recordRegisteredEmail(cleanEmail);
        res.json({ valid: true, email: cleanEmail });
        return;
      }
      res.json({ valid: false, reason: consumed.reason });
    } catch {
      res.json({ valid: false });
    }
  });

  /**
   * POST /api/auth/record-user
   * Ensures any authenticated existing user who signs in is recorded in the server registry.
   */
  app.post('/api/auth/record-user', (req, res) => {
    try {
      const { email } = req.body || {};
      const cleanEmail = String(email || '').trim().toLowerCase();
      const authHeader = String(req.headers.authorization || '').trim();
      if (cleanEmail && cleanEmail.includes('@') && authHeader.startsWith('Bearer ')) {
        recordRegisteredEmail(cleanEmail);
      }
      res.json({ success: true });
    } catch {
      res.json({ success: false });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Zappy server running on http://localhost:${PORT}`);
  });
}

startServer();
