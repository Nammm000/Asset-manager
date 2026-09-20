import { environment } from '../../environments/environment';

/**
 * HttpErrorResponse-equivalent for the fetch world. `.error` exposes the parsed
 * response body so util/api-util's getApiErrorMessage() works unchanged (it
 * reads `error.error`); status 0 means the network never answered at all —
 * the notification reconnect logic keys on exactly that.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`Http failure, status ${status}`);
    this.name = 'ApiError';
  }

  /** HttpErrorResponse-compat: the parsed error body. */
  get error(): unknown {
    return this.body;
  }
}

export interface RawRequestInit {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** JSON-serialized unless it is a FormData (passed through untouched) or null (empty body). */
  body?: unknown;
  /** Query params, HttpParams-equivalent. */
  params?: Record<string, string>;
  responseType?: 'json' | 'text' | 'blob';
  /** 'include' on /auth/* so the HttpOnly refresh cookie flows cross-origin. */
  credentials?: 'include';
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

/**
 * Thin fetch wrapper with Angular-HttpClient semantics: URL = apiUrl + path,
 * JSON bodies by default, text/blob response modes, and every non-2xx (or
 * network) failure normalized into an ApiError.
 */
export async function rawRequest<T>(path: string, init: RawRequestInit = {}): Promise<T> {
  const url = new URL(environment.apiUrl + path);
  if (init.params) {
    for (const [key, value] of Object.entries(init.params)) {
      url.searchParams.set(key, value);
    }
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: init.method ?? 'GET',
      credentials: init.credentials,
      headers: {
        // NEVER for FormData — fetch derives the multipart boundary itself.
        ...(init.body !== undefined && init.body !== null && !(init.body instanceof FormData)
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...init.headers,
      },
      body:
        init.body === undefined || init.body === null
          ? undefined
          : init.body instanceof FormData
            ? init.body
            : JSON.stringify(init.body),
      signal: init.signal,
    });
  } catch {
    // The browser couldn't reach the server at all (offline, DNS, CORS-blocked).
    throw new ApiError(0, null);
  }

  if (!response.ok) {
    const body = await response
      .text()
      .then((text) => {
        try {
          return JSON.parse(text) as unknown;
        } catch {
          return text; // bare-string error bodies
        }
      })
      .catch(() => null);
    throw new ApiError(response.status, body);
  }

  if (init.responseType === 'text') {
    return (await response.text()) as T;
  }
  if (init.responseType === 'blob') {
    return (await response.blob()) as T;
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}
