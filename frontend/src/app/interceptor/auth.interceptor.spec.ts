import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../environments/environment';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from 'service/auth.service';
import type { JwtClaims } from 'util/jwt-util';

const STORAGE_KEY = 'asset-manager.token';
const URL = `${environment.apiUrl}/currencies`;

function base64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function makeToken(claims: Partial<JwtClaims> = {}): string {
  const full: JwtClaims = {
    sub: 'user@test.com',
    role: 'ROLE_USER',
    iat: 1000,
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...claims,
  };
  return `header.${base64Url(JSON.stringify(full))}.signature`;
}

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.removeItem(STORAGE_KEY);
  });

  /** Drive a real login through the mock backend so the service state is genuine. */
  function login(claims: Partial<JwtClaims> = {}): void {
    auth.login({ email: 'user@test.com', password: 'pw' }).subscribe();
    httpMock
      .expectOne((req) => req.url === `${environment.apiUrl}/auth/login`)
      .flush({ jwtToken: makeToken(claims) });
  }

  it('adds no Authorization header without a session', () => {
    http.get(URL).subscribe();
    const req = httpMock.expectOne((r) => r.url === URL);

    expect(req.request.headers.has('Authorization')).toBe(false);
  });

  it('attaches the Bearer header for a live session', () => {
    login({ sub: 'a@b.c' });
    http.get(URL).subscribe();
    const req = httpMock.expectOne((r) => r.url === URL);

    expect(req.request.headers.get('Authorization')).toMatch(/^Bearer header\..+\.signature$/);
  });

  it('does not attach an expired token', () => {
    login({ exp: Math.floor(Date.now() / 1000) - 10 });
    http.get(URL).subscribe();
    const req = httpMock.expectOne((r) => r.url === URL);

    expect(req.request.headers.has('Authorization')).toBe(false);
  });
});
