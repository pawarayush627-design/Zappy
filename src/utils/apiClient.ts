/**
 * Resilient API Client for ZappyFun
 * Ensures API calls work seamlessly across AI Studio Preview, Cloud Run, and Netlify static hosting.
 * Never throws "Unexpected token '<', '<!DOCTYPE '... is not valid JSON" when a static host returns HTML.
 */

export const FALLBACK_BACKEND_ORIGIN =
  'https://ais-pre-h3khdspljkh5i75p226uvc-268382957607.asia-east1.run.app';

export interface SafeJsonResult<T = any> {
  ok: boolean;
  status: number;
  data: T | null;
  isStaticFallback: boolean;
}

function isJsonResponse(res: Response, rawText: string): boolean {
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  const trimmed = rawText.trim();
  if (trimmed.startsWith('<!doctype') || trimmed.startsWith('<html') || trimmed.startsWith('<')) {
    return false;
  }
  if (contentType.includes('application/json')) {
    return true;
  }
  return trimmed.startsWith('{') || trimmed.startsWith('[');
}

/**
 * Fetches an `/api/...` endpoint safely.
 * 1. Tries relative path `/api/...` first.
 * 2. If the host (e.g. Netlify static SPA fallback) returns HTML `<!DOCTYPE html>` instead of JSON,
 *    automatically retries against the live Cloud Run backend origin.
 * 3. Safely parses JSON without ever throwing a SyntaxError on HTML responses.
 */
export async function safeApiFetchJson<T = any>(
  path: string,
  init?: RequestInit
): Promise<SafeJsonResult<T>> {
  try {
    const primaryRes = await fetch(path, init);
    const primaryText = await primaryRes.text();

    if (isJsonResponse(primaryRes, primaryText)) {
      try {
        const parsed = JSON.parse(primaryText) as T;
        if (primaryRes.ok || primaryRes.status < 500) {
          return {
            ok: primaryRes.ok,
            status: primaryRes.status,
            data: parsed,
            isStaticFallback: false,
          };
        }
      } catch {
        // Continue to fallback if JSON parse fails
      }
    }

    // If on Netlify and calling /api/* returned HTML, retry against /.netlify/functions/*
    if (path.startsWith('/api/auth/') || path.startsWith('/api/justwatch/')) {
      const fnMap: Record<string, string> = {
        '/api/auth/send-otp': '/.netlify/functions/send-otp',
        '/api/auth/verify-otp': '/.netlify/functions/verify-otp',
        '/api/auth/check-email': '/.netlify/functions/check-email',
        '/api/auth/record-user': '/.netlify/functions/check-email',
        '/api/auth/validate-registration-token':
          '/.netlify/functions/validate-registration-token',
        '/api/auth/consume-registration-token':
          '/.netlify/functions/validate-registration-token',
        '/api/justwatch/extract': '/.netlify/functions/justwatch-extract',
      };
      const fnTarget = fnMap[path.split('?')[0]];
      if (fnTarget) {
        try {
          const netlifyFnRes = await fetch(fnTarget, init);
          const netlifyText = await netlifyFnRes.text();
          if (isJsonResponse(netlifyFnRes, netlifyText)) {
            const parsed = JSON.parse(netlifyText) as T;
            if (netlifyFnRes.ok || netlifyFnRes.status < 500) {
              return {
                ok: netlifyFnRes.ok,
                status: netlifyFnRes.status,
                data: parsed,
                isStaticFallback: false,
              };
            }
          }
        } catch {
          // Ignore
        }
      }
    }

    // If relative /api/... returned HTML (e.g., on Netlify static hosting without proxy),
    // retry against the remote Cloud Run backend origin if we are not already on that origin.
    if (
      typeof window !== 'undefined' &&
      path.startsWith('/api/') &&
      window.location.origin !== FALLBACK_BACKEND_ORIGIN
    ) {
      try {
        const remoteRes = await fetch(`${FALLBACK_BACKEND_ORIGIN}${path}`, {
          ...init,
          mode: 'cors',
        });
        const remoteText = await remoteRes.text();
        if (isJsonResponse(remoteRes, remoteText)) {
          const parsed = JSON.parse(remoteText) as T;
          return {
            ok: remoteRes.ok,
            status: remoteRes.status,
            data: parsed,
            isStaticFallback: false,
          };
        }
      } catch {
        // Remote backend unreachable, return graceful static fallback
      }
    }

    return {
      ok: false,
      status: primaryRes.status || 503,
      data: null,
      isStaticFallback: true,
    };
  } catch {
    // Network error on primary fetch — try fallback origin if applicable
    if (
      typeof window !== 'undefined' &&
      path.startsWith('/api/') &&
      window.location.origin !== FALLBACK_BACKEND_ORIGIN
    ) {
      try {
        const remoteRes = await fetch(`${FALLBACK_BACKEND_ORIGIN}${path}`, {
          ...init,
          mode: 'cors',
        });
        const remoteText = await remoteRes.text();
        if (isJsonResponse(remoteRes, remoteText)) {
          const parsed = JSON.parse(remoteText) as T;
          return {
            ok: remoteRes.ok,
            status: remoteRes.status,
            data: parsed,
            isStaticFallback: false,
          };
        }
      } catch {
        // Ignore
      }
    }

    return {
      ok: false,
      status: 503,
      data: null,
      isStaticFallback: true,
    };
  }
}
