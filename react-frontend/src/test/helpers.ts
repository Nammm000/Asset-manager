import type { JwtClaims } from '../app/util/jwt-util';

/** Ported spec helpers (from auth.service.spec.ts / auth.interceptor.spec.ts): build real JWTs so decodeJwt/claims behave genuinely. */

export function base64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function makeToken(claims: Partial<JwtClaims> = {}): string {
  const full: JwtClaims = {
    sub: 'user@test.com',
    role: 'ROLE_USER',
    iat: 1000,
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...claims,
  };
  return `header.${base64Url(JSON.stringify(full))}.signature`;
}

/** The refresh token travels as the HttpOnly cookie, never in these bodies. */
export function authResponse(claims: Partial<JwtClaims> = {}): { accessToken: string } {
  return { accessToken: makeToken(claims) };
}

export function unauthorized(): { status: number; message: string } {
  return { status: 401, message: 'Invalid refresh token' };
}

/** A real fetch Response for the stubbed global (rawRequest parses via res.text/json). */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(body === null || body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Flush pending microtask chains (fire-and-forget promises, .then callbacks). */
export function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
