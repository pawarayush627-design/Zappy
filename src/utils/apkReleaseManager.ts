export interface ApkReleaseConfig {
  releaseId: string;
  version: string;
  whatsImproved: string;
  apkUrl: string;
  fileName: string;
  fileSizeFormatted: string;
  updatedAtMs: number;
}

export const DEFAULT_APK_RELEASE: ApkReleaseConfig = {
  releaseId: '',
  version: '1.0.0',
  whatsImproved: '',
  apkUrl: '/zappyfun.apk',
  fileName: 'zappyfun.apk',
  fileSizeFormatted: '80 MB',
  updatedAtMs: 0,
};

const SEEN_RELEASE_STORAGE_KEY = 'zappy_seen_apk_release_id_v1';

export function normalizeApkReleaseConfig(raw: unknown): ApkReleaseConfig {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_APK_RELEASE };
  }
  const obj = raw as Record<string, unknown>;

  // Support nested overridesJson if stored inside Firestore ui_config/apk_release
  if (typeof obj.overridesJson === 'string' && obj.overridesJson.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(obj.overridesJson) as Record<string, unknown>;
      return normalizeApkReleaseConfig(parsed);
    } catch {
      // Fall through
    }
  }

  const version =
    typeof obj.version === 'string' && obj.version.trim()
      ? obj.version.trim()
      : DEFAULT_APK_RELEASE.version;
  const releaseId =
    typeof obj.releaseId === 'string' ? obj.releaseId.trim() : '';
  const whatsImproved =
    typeof obj.whatsImproved === 'string' ? obj.whatsImproved.trim() : '';
  const apkUrl =
    typeof obj.apkUrl === 'string' && obj.apkUrl.trim()
      ? obj.apkUrl.trim()
      : DEFAULT_APK_RELEASE.apkUrl;
  const fileName =
    typeof obj.fileName === 'string' && obj.fileName.trim()
      ? obj.fileName.trim()
      : `zappyfun-v${version.replace(/^v/i, '')}.apk`;
  const fileSizeFormatted =
    typeof obj.fileSizeFormatted === 'string' && obj.fileSizeFormatted.trim()
      ? obj.fileSizeFormatted.trim()
      : DEFAULT_APK_RELEASE.fileSizeFormatted;
  const updatedAtMs =
    typeof obj.updatedAtMs === 'number' && Number.isFinite(obj.updatedAtMs)
      ? obj.updatedAtMs
      : 0;

  return {
    releaseId,
    version,
    whatsImproved,
    apkUrl,
    fileName,
    fileSizeFormatted,
    updatedAtMs,
  };
}

export function hasUserSeenApkRelease(releaseId: string): boolean {
  if (!releaseId || typeof window === 'undefined') return true;
  try {
    const seen = window.localStorage.getItem(SEEN_RELEASE_STORAGE_KEY);
    return seen === releaseId;
  } catch {
    return false;
  }
}

export function markApkReleaseSeen(releaseId: string): void {
  if (!releaseId || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SEEN_RELEASE_STORAGE_KEY, releaseId);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Triggers direct download of the configured APK file.
 */
export async function triggerDirectApkDownload(
  release?: ApkReleaseConfig | null,
  onFallbackNotReady?: () => void
): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const targetUrl = (release?.apkUrl || '/zappyfun.apk').trim();
  const cleanFileName = (release?.fileName || 'zappyfun.apk').trim().endsWith('.apk')
    ? (release?.fileName || 'zappyfun.apk').trim()
    : `${(release?.fileName || 'zappyfun').trim()}.apk`;

  // If the admin configured an external direct APK link (e.g., GitHub Release, cloud storage, CDN)
  if (/^https?:\/\//i.test(targetUrl)) {
    const a = document.createElement('a');
    a.href = targetUrl;
    a.download = cleanFileName;
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  }

  // Otherwise check the local/server binary endpoint (/zappyfun.apk) and fallback backend origin
  const candidateUrls = [
    `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}t=${Date.now()}`,
  ];
  const fallbackOrigin = 'https://ais-pre-h3khdspljkh5i75p226uvc-268382957607.asia-east1.run.app';
  if (
    targetUrl.startsWith('/') &&
    window.location.origin !== fallbackOrigin
  ) {
    candidateUrls.push(
      `${fallbackOrigin}${targetUrl}${targetUrl.includes('?') ? '&' : '?'}t=${Date.now()}`
    );
  }

  for (const urlToTry of candidateUrls) {
    try {
      const headRes = await fetch(urlToTry, { method: 'HEAD' });
      const contentType = (headRes.headers.get('content-type') || '').toLowerCase();
      if (
        headRes.ok &&
        (contentType.includes('vnd.android.package-archive') ||
          contentType.includes('application/octet-stream'))
      ) {
        const a = document.createElement('a');
        a.href = urlToTry;
        a.download = cleanFileName;
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return true;
      }
    } catch {
      // Try next candidate
    }
  }

  if (onFallbackNotReady) {
    onFallbackNotReady();
  }
  return false;
}
