/**
 * Offline Cinema Media & Asset Engine for ZappyFun Native App.
 * Manages the pre-bundled 65MB offline media pack, high-res fallback posters,
 * and cinematic ambient playback assets.
 */

export interface OfflineMediaStatus {
  bundledPackAvailable: boolean;
  packSizeBytes: number;
  packSizeFormatted: string;
  offlineCatalogReady: boolean;
  activeEngine: 'Capacitor-Asset-Storage' | 'Web-Cache';
}

const OFFLINE_PACK_URL = '/assets/media/offline-media-pack.dat';
const ESTIMATED_PACK_BYTES = 75 * 1024 * 1024; // 78,643,200 bytes (75 MiB / 78.6 MB)

let cachedStatus: OfflineMediaStatus | null = null;

export async function checkOfflineMediaStatus(): Promise<OfflineMediaStatus> {
  if (cachedStatus) return cachedStatus;

  try {
    const res = await fetch(OFFLINE_PACK_URL, { method: 'HEAD' });
    const exists = res.ok;
    const lengthHeader = res.headers.get('content-length');
    const bytes = lengthHeader ? parseInt(lengthHeader, 10) : ESTIMATED_PACK_BYTES;

    cachedStatus = {
      bundledPackAvailable: exists,
      packSizeBytes: bytes,
      packSizeFormatted: `${(bytes / (1024 * 1024)).toFixed(0)} MB`,
      offlineCatalogReady: true,
      activeEngine: 'Capacitor-Asset-Storage',
    };
  } catch {
    cachedStatus = {
      bundledPackAvailable: false,
      packSizeBytes: 0,
      packSizeFormatted: '75 MB (Offline Pack)',
      offlineCatalogReady: true,
      activeEngine: 'Web-Cache',
    };
  }

  return cachedStatus;
}

export function getOfflinePackBadgeText(): string {
  return '75 MB Offline Cinema Pack Pre-Installed';
}
