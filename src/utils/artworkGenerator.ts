import { MediaItem } from '../types/media';

/**
 * Generates multi-layered theatrical SVG key art for vertical posters (3:4)
 * and widescreen hero backdrops (16:9), complete with volumetric lighting,
 * anamorphic lens flare streaks, environmental silhouettes, and billing-block credits.
 */
function getDetailedMotifScene(
  motif: MediaItem['visualTheme']['motif'],
  accentHex: string,
  secondaryHex: string,
  isWide: boolean
): string {
  const cx = isWide ? 1060 : 300;
  const cy = isWide ? 400 : 350;
  const width = isWide ? 1600 : 600;
  const height = isWide ? 900 : 800;

  switch (motif) {
    case 'horizon':
      return `
        <!-- Starfield & atmospheric dust -->
        <g opacity="0.6">
          <circle cx="${cx - 260}" cy="${cy - 210}" r="1.5" fill="#FFF" />
          <circle cx="${cx + 190}" cy="${cy - 240}" r="2" fill="#FFF" opacity="0.7" />
          <circle cx="${cx + 310}" cy="${cy - 120}" r="1.2" fill="#FFF" />
          <circle cx="${cx - 140}" cy="${cy - 280}" r="1.8" fill="${accentHex}" />
          <circle cx="${cx + 80}" cy="${cy - 190}" r="1.2" fill="#FFF" />
        </g>
        <!-- Colossal eclipsed planet & orbital ring -->
        <circle cx="${cx}" cy="${cy - 35}" r="${isWide ? 245 : 155}" fill="none" stroke="${accentHex}" stroke-width="2" opacity="0.35" />
        <circle cx="${cx}" cy="${cy - 35}" r="${isWide ? 190 : 120}" fill="#050507" stroke="${accentHex}" stroke-width="3" opacity="0.95" />
        <ellipse cx="${cx}" cy="${cy - 35}" rx="${isWide ? 390 : 245}" ry="${isWide ? 64 : 42}" fill="none" stroke="${accentHex}" stroke-width="6" opacity="0.85" transform="rotate(-16 ${cx} ${cy - 35})" />
        <ellipse cx="${cx}" cy="${cy - 35}" rx="${isWide ? 430 : 270}" ry="${isWide ? 76 : 50}" fill="none" stroke="#FFFFFF" stroke-width="1.5" opacity="0.4" transform="rotate(-16 ${cx} ${cy - 35})" />
        <!-- Anamorphic lens flare streak -->
        <ellipse cx="${cx - 125}" cy="${cy - 85}" rx="${isWide ? 260 : 160}" ry="3" fill="${accentHex}" opacity="0.85" />
        <circle cx="${cx - 125}" cy="${cy - 85}" r="9" fill="#FFFFFF" />
        <!-- Craggy obsidian ridge & lone astronaut silhouette -->
        <polygon points="0,${height} 0,${cy + 210} ${cx - 290},${cy + 135} ${cx - 80},${cy + 65} ${cx + 95},${cy + 140} ${width},${cy + 95} ${width},${height}" fill="#0B0B0F" />
        <polygon points="0,${height} ${cx - 210},${cy + 150} ${cx - 65},${cy + 75} ${cx + 150},${cy + 190} ${width},${cy + 145} ${width},${height}" fill="#060608" />
        <!-- Lone Explorer Figure on Ridge -->
        <g transform="translate(${cx - 72}, ${cy + 32})">
          <rect x="-6" y="14" width="12" height="28" rx="4" fill="#050507" stroke="${accentHex}" stroke-width="1.5" />
          <circle cx="0" cy="6" r="7" fill="#050507" stroke="#FFFFFF" stroke-width="1.5" />
          <line x1="-5" y1="42" x2="-8" y2="58" stroke="#050507" stroke-width="4" />
          <line x1="5" y1="42" x2="8" y2="58" stroke="#050507" stroke-width="4" />
        </g>
      `;

    case 'velocity':
      return `
        <!-- Perspective highway tunnel arches -->
        <g opacity="0.45" stroke="${accentHex}" fill="none">
          <rect x="${cx - 320}" y="${cy - 210}" width="640" height="420" rx="40" stroke-width="2" />
          <rect x="${cx - 230}" y="${cy - 150}" width="460" height="300" rx="30" stroke-width="2" />
          <rect x="${cx - 150}" y="${cy - 95}" width="300" height="190" rx="20" stroke-width="1.5" />
        </g>
        <!-- Speed lines & wet asphalt reflections -->
        <polygon points="${cx},${cy - 30} 0,${height} ${width},${height}" fill="${secondaryHex}" opacity="0.65" />
        <line x1="${cx}" y1="${cy - 30}" x2="0" y2="${cy + 260}" stroke="${accentHex}" stroke-width="5" opacity="0.8" />
        <line x1="${cx}" y1="${cy - 30}" x2="${width}" y2="${cy + 260}" stroke="${accentHex}" stroke-width="5" opacity="0.8" />
        <line x1="${cx}" y1="${cy - 30}" x2="${cx - 180}" y2="${height}" stroke="#FFFFFF" stroke-width="2" opacity="0.35" stroke-dasharray="28 18" />
        <line x1="${cx}" y1="${cy - 30}" x2="${cx + 180}" y2="${height}" stroke="#FFFFFF" stroke-width="2" opacity="0.35" stroke-dasharray="28 18" />
        <!-- Fastback GT Silhouette & Taillight Bar -->
        <g transform="translate(${cx}, ${cy + 35})">
          <path d="M-130,35 L-95,-22 L95,-22 L130,35 L145,85 L-145,85 Z" fill="#070709" stroke="#FFFFFF" stroke-opacity="0.25" stroke-width="2" />
          <path d="M-82,-16 L82,-16 L104,24 L-104,24 Z" fill="#111116" />
          <rect x="-125" y="42" width="250" height="10" rx="5" fill="${accentHex}" />
          <rect x="-115" y="45" width="75" height="4" rx="2" fill="#FFFFFF" />
          <rect x="40" y="45" width="75" height="4" rx="2" fill="#FFFFFF" />
          <!-- Wet road taillight reflection -->
          <ellipse cx="-80" cy="115" rx="65" ry="12" fill="${accentHex}" opacity="0.45" />
          <ellipse cx="80" cy="115" rx="65" ry="12" fill="${accentHex}" opacity="0.45" />
        </g>
      `;

    case 'noir':
      return `
        <!-- Modernist skyscraper glass grid -->
        <g opacity="0.55">
          <rect x="${cx - 240}" y="${cy - 250}" width="95" height="460" fill="${secondaryHex}" stroke="#FFFFFF" stroke-opacity="0.1" />
          <rect x="${cx - 125}" y="${cy - 290}" width="130" height="500" fill="#0B0F19" stroke="${accentHex}" stroke-opacity="0.35" stroke-width="1.5" />
          <rect x="${cx + 25}" y="${cy - 220}" width="110" height="430" fill="${secondaryHex}" stroke="#FFFFFF" stroke-opacity="0.1" />
          <rect x="${cx + 155}" y="${cy - 260}" width="85" height="470" fill="#0B0F19" />
          <!-- Illuminated office windows -->
          <rect x="${cx - 105}" y="${cy - 190}" width="32" height="18" fill="${accentHex}" opacity="0.85" />
          <rect x="${cx - 60}" y="${cy - 190}" width="32" height="18" fill="${accentHex}" opacity="0.5" />
          <rect x="${cx - 105}" y="${cy - 110}" width="32" height="18" fill="${accentHex}" opacity="0.4" />
          <rect x="${cx + 45}" y="${cy - 150}" width="36" height="18" fill="${accentHex}" opacity="0.75" />
        </g>
        <!-- Streetlamp light cone & detective silhouette -->
        <polygon points="${cx - 20},${cy - 40} ${cx + 180},${cy + 290} ${cx - 220},${cy + 290}" fill="${accentHex}" opacity="0.28" />
        <circle cx="${cx - 20}" cy="${cy - 40}" r="8" fill="#FFFFFF" />
        <g transform="translate(${cx - 20}, ${cy + 75})">
          <polygon points="-18,95 -10,0 10,0 18,95" fill="#050507" />
          <circle cx="0" cy="-12" r="9" fill="#050507" />
          <ellipse cx="0" cy="-16" rx="18" ry="4" fill="#050507" />
        </g>
      `;

    case 'valley':
      return `
        <!-- Golden sunset disc -->
        <circle cx="${cx}" cy="${cy - 55}" r="${isWide ? 175 : 125}" fill="${accentHex}" opacity="0.45" />
        <circle cx="${cx}" cy="${cy - 55}" r="${isWide ? 120 : 85}" fill="#FFF" opacity="0.22" />
        <!-- Layered mountain ranges -->
        <path d="M0 ${cy + 140} L${cx - 240} ${cy - 30} L${cx - 70} ${cy + 65} L${cx + 140} ${cy - 75} L${width} ${cy + 110} L${width} ${height} L0 ${height} Z" fill="${secondaryHex}" opacity="0.85" />
        <path d="M0 ${cy + 200} L${cx - 130} ${cy + 45} L${cx + 55} ${cy + 135} L${cx + 260} ${cy + 15} L${width} ${cy + 170} L${width} ${height} L0 ${height} Z" fill="#08090C" />
        <!-- Expedition Airship / Dragon Silhouette -->
        <g transform="translate(${cx - 45}, ${cy - 95})">
          <ellipse cx="0" cy="0" rx="52" ry="18" fill="#070709" stroke="${accentHex}" stroke-width="2" />
          <rect x="-18" y="22" width="36" height="10" rx="3" fill="#070709" stroke="#FFF" stroke-opacity="0.4" />
          <line x1="-12" y1="16" x2="-12" y2="22" stroke="${accentHex}" stroke-width="1.5" />
          <line x1="12" y1="16" x2="12" y2="22" stroke="${accentHex}" stroke-width="1.5" />
        </g>
      `;

    case 'orbit':
      return `
        <g opacity="0.85">
          <circle cx="${cx}" cy="${cy - 25}" r="${isWide ? 200 : 135}" fill="none" stroke="${accentHex}" stroke-width="2.5" stroke-dasharray="16 10" />
          <circle cx="${cx}" cy="${cy - 25}" r="${isWide ? 140 : 95}" fill="none" stroke="#FFFFFF" stroke-width="1.5" opacity="0.35" />
          <circle cx="${cx}" cy="${cy - 25}" r="${isWide ? 75 : 52}" fill="${secondaryHex}" stroke="${accentHex}" stroke-width="3" />
          <polygon points="${cx},${cy - 145} ${cx + 62},${cy + 25} ${cx - 62},${cy + 25}" fill="#070709" stroke="${accentHex}" stroke-width="2.5" />
          <circle cx="${cx}" cy="${cy - 25}" r="10" fill="${accentHex}" />
        </g>
      `;

    case 'bastion':
      return `
        <g opacity="0.85">
          <polygon points="0,${height} ${cx - 280},${cy - 90} ${cx - 95},${cy + 65} ${cx + 95},${cy - 140} ${width},${cy + 160} ${width},${height}" fill="${secondaryHex}" opacity="0.6" />
          <polygon points="${cx},${cy - 170} ${cx + 145},${cy - 35} ${cx + 92},${cy + 145} ${cx - 92},${cy + 145} ${cx - 145},${cy - 35}" fill="none" stroke="${accentHex}" stroke-width="3.5" />
          <polygon points="${cx},${cy - 115} ${cx + 95},${cy - 15} ${cx},${cy + 100} ${cx - 95},${cy - 15}" fill="#08080B" stroke="#FFFFFF" stroke-opacity="0.3" stroke-width="2" />
          <circle cx="${cx}" cy="${cy - 15}" r="14" fill="${accentHex}" />
        </g>
      `;

    case 'harbor':
      return `
        <g opacity="0.85">
          <!-- Lighthouse beam cutting through coastal fog -->
          <polygon points="${cx - 60},${cy - 135} ${cx + 380},${cy - 240} ${cx + 380},${cy - 20}" fill="${accentHex}" opacity="0.38" />
          <path d="M${cx - 82} ${cy - 145} L${cx - 38} ${cy - 145} L${cx - 20} ${cy + 95} L${cx - 100} ${cy + 95} Z" fill="#070709" stroke="${accentHex}" stroke-width="2.5" />
          <circle cx="${cx - 60}" cy="${cy - 135}" r="12" fill="#FFFFFF" />
          <!-- Ocean horizon waves -->
          <line x1="0" y1="${cy + 95}" x2="${width}" y2="${cy + 95}" stroke="${accentHex}" stroke-width="2.5" opacity="0.7" />
          <line x1="0" y1="${cy + 125}" x2="${width}" y2="${cy + 125}" stroke="#FFFFFF" stroke-width="1.5" opacity="0.25" stroke-dasharray="40 20" />
          <line x1="0" y1="${cy + 155}" x2="${width}" y2="${cy + 155}" stroke="${accentHex}" stroke-width="1.5" opacity="0.35" stroke-dasharray="25 30" />
        </g>
      `;

    case 'clockwork':
      return `
        <g opacity="0.85">
          <circle cx="${cx}" cy="${cy - 25}" r="${isWide ? 185 : 130}" fill="none" stroke="${accentHex}" stroke-width="8" stroke-dasharray="24 14" />
          <circle cx="${cx}" cy="${cy - 25}" r="${isWide ? 135 : 95}" fill="none" stroke="#FFFFFF" stroke-width="2" opacity="0.35" />
          <circle cx="${cx}" cy="${cy - 25}" r="${isWide ? 105 : 74}" fill="#08080B" stroke="${accentHex}" stroke-width="2.5" />
          <line x1="${cx}" y1="${cy - 25}" x2="${cx}" y2="${cy - 110}" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" />
          <line x1="${cx}" y1="${cy - 25}" x2="${cx + 68}" y2="${cy + 15}" stroke="${accentHex}" stroke-width="5" stroke-linecap="round" />
          <circle cx="${cx}" cy="${cy - 25}" r="10" fill="${accentHex}" />
        </g>
      `;

    case 'canyon':
      return `
        <circle cx="${cx + 70}" cy="${cy - 95}" r="82" fill="${accentHex}" opacity="0.6" />
        <polygon points="0,${cy + 185} ${cx - 165},${cy - 85} ${cx - 25},${cy + 85} ${cx + 165},${cy - 115} ${width},${cy + 165} ${width},${height} 0,${height}" fill="${secondaryHex}" opacity="0.9" />
        <polygon points="0,${cy + 245} ${cx - 65},${cy + 65} ${cx + 95},${cy + 155} ${width},${cy + 95} ${width},${height} 0,${height}" fill="#070709" />
      `;

    case 'symphony':
    default:
      return `
        <g opacity="0.85">
          <path d="M ${cx - 260} ${cy - 10} Q ${cx - 130} ${cy - 190} ${cx} ${cy - 10} T ${cx + 260} ${cy - 10}" fill="none" stroke="${accentHex}" stroke-width="6" />
          <path d="M ${cx - 260} ${cy + 25} Q ${cx - 130} ${cy - 135} ${cx} ${cy + 25} T ${cx + 260} ${cy + 25}" fill="none" stroke="#FFFFFF" stroke-width="2.5" opacity="0.55" />
          <path d="M ${cx - 260} ${cy + 60} Q ${cx - 130} ${cy - 80} ${cx} ${cy + 60} T ${cx + 260} ${cy + 60}" fill="none" stroke="${accentHex}" stroke-width="2" opacity="0.4" />
          <circle cx="${cx}" cy="${cy - 10}" r="14" fill="${accentHex}" />
          <circle cx="${cx - 130}" cy="${cy - 100}" r="7" fill="#FFFFFF" />
          <circle cx="${cx + 130}" cy="${cy + 80}" r="7" fill="#FFFFFF" />
        </g>
      `;
  }
}

export function createPosterDataUri(item: {
  title: string;
  releaseYear: number;
  genres: string[];
  directorOrCreator?: string;
  visualTheme: MediaItem['visualTheme'];
}): string {
  const { primaryHex, secondaryHex, accentHex, motif } = item.visualTheme;
  const safeTitle = item.title
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const safeGenre = (item.genres[0] || 'Cinema').toUpperCase();
  const safeDirector = (item.directorOrCreator || 'CineWave Studios')
    .replace(/&/g, '&amp;')
    .toUpperCase();

  // Split title into 2 lines if long so poster typography never clips
  const words = safeTitle.split(' ');
  let line1 = safeTitle;
  let line2 = '';
  if (safeTitle.length > 18 && words.length >= 3) {
    const mid = Math.ceil(words.length / 2);
    line1 = words.slice(0, mid).join(' ');
    line2 = words.slice(mid).join(' ');
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800" width="600" height="800">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#050507" />
        <stop offset="38%" stop-color="${primaryHex}" />
        <stop offset="78%" stop-color="${secondaryHex}" />
        <stop offset="100%" stop-color="#050507" />
      </linearGradient>
      <radialGradient id="glow" cx="50%" cy="42%" r="58%">
        <stop offset="0%" stop-color="${accentHex}" stop-opacity="0.45" />
        <stop offset="65%" stop-color="${secondaryHex}" stop-opacity="0.15" />
        <stop offset="100%" stop-color="#000000" stop-opacity="0" />
      </radialGradient>
      <linearGradient id="scrim" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#050507" stop-opacity="0.65" />
        <stop offset="22%" stop-color="#050507" stop-opacity="0.05" />
        <stop offset="58%" stop-color="#050507" stop-opacity="0.25" />
        <stop offset="82%" stop-color="#060609" stop-opacity="0.94" />
        <stop offset="100%" stop-color="#050507" stop-opacity="1" />
      </linearGradient>
    </defs>

    <!-- Base Canvas & Rim Glow -->
    <rect width="600" height="800" fill="url(#bg)" />
    <rect width="600" height="800" fill="url(#glow)" />

    <!-- Bespoke Scene Illustration -->
    ${getDetailedMotifScene(motif, accentHex, secondaryHex, false)}

    <!-- Theatrical Vignette Scrim -->
    <rect width="600" height="800" fill="url(#scrim)" />

    <!-- Top Festival / Studio Header -->
    <text x="300" y="54" text-anchor="middle" fill="#D4D4D8" font-family="sans-serif" font-size="11" font-weight="600" letter-spacing="5" opacity="0.8">CINEWAVE PREMIERE COLLECTION</text>
    <line x1="210" y1="68" x2="390" y2="68" stroke="${accentHex}" stroke-width="1.5" stroke-opacity="0.55" />

    <!-- Inner Specular Frame -->
    <rect x="22" y="22" width="556" height="756" rx="12" fill="none" stroke="#FFFFFF" stroke-opacity="0.12" stroke-width="1.5" />

    <!-- Bottom Theatrical Title Lockup -->
    <text x="44" y="612" fill="${accentHex}" font-family="sans-serif" font-size="13" font-weight="700" letter-spacing="4">${safeGenre} · ${item.releaseYear}</text>
    ${
      line2
        ? `<text x="44" y="656" fill="#FFFFFF" font-family="sans-serif" font-size="33" font-weight="800" letter-spacing="-0.5">${line1}</text>
           <text x="44" y="694" fill="#FFFFFF" font-family="sans-serif" font-size="33" font-weight="800" letter-spacing="-0.5">${line2}</text>`
        : `<text x="44" y="668" fill="#FFFFFF" font-family="sans-serif" font-size="36" font-weight="800" letter-spacing="-0.5">${line1}</text>`
    }
    <text x="44" y="736" fill="#A1A1AA" font-family="sans-serif" font-size="11" font-weight="600" letter-spacing="2.5">A FILM BY ${safeDirector}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function createBackdropDataUri(item: {
  title: string;
  tagline: string;
  visualTheme: MediaItem['visualTheme'];
}): string {
  const { primaryHex, secondaryHex, accentHex, motif } = item.visualTheme;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" width="1600" height="900">
    <defs>
      <linearGradient id="bgw" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#050507" />
        <stop offset="42%" stop-color="${primaryHex}" />
        <stop offset="82%" stop-color="${secondaryHex}" />
        <stop offset="100%" stop-color="#050507" />
      </linearGradient>
      <radialGradient id="flare" cx="68%" cy="44%" r="54%">
        <stop offset="0%" stop-color="${accentHex}" stop-opacity="0.5" />
        <stop offset="52%" stop-color="${secondaryHex}" stop-opacity="0.22" />
        <stop offset="100%" stop-color="#050507" stop-opacity="0" />
      </radialGradient>
      <linearGradient id="fadeLeft" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#070709" stop-opacity="0.98" />
        <stop offset="38%" stop-color="#070709" stop-opacity="0.72" />
        <stop offset="72%" stop-color="#070709" stop-opacity="0.22" />
        <stop offset="100%" stop-color="#070709" stop-opacity="0.45" />
      </linearGradient>
      <linearGradient id="fadeBottom" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#070709" stop-opacity="0.35" />
        <stop offset="65%" stop-color="#070709" stop-opacity="0" />
        <stop offset="100%" stop-color="#070709" stop-opacity="0.98" />
      </linearGradient>
    </defs>
    <rect width="1600" height="900" fill="url(#bgw)" />
    <rect width="1600" height="900" fill="url(#flare)" />
    ${getDetailedMotifScene(motif, accentHex, secondaryHex, true)}
    <rect width="1600" height="900" fill="url(#fadeLeft)" />
    <rect width="1600" height="900" fill="url(#fadeBottom)" />
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
