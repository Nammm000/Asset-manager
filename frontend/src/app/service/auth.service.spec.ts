import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import type { JwtClaims } from 'util/jwt-util';

const STORAGE_KEY = 'asset-manager.token';
const AVATAR_KEY = 'asset-manager.avatar';

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

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.removeItem(STORAGE_KEY);
  });

  it('stores the token, decodes claims, and persists to localStorage on login', () => {
    const jwtToken = makeToken({ sub: 'a@b.c', role: 'ROLE_ADMIN' });

    service.login({ email: 'a@b.c', password: 'pw' }).subscribe();
    httpMock
      .expectOne((req) => req.url === `${environment.apiUrl}/auth/login`)
      .flush({ jwtToken });

    expect(service.token()).toBe(jwtToken);
    expect(service.email()).toBe('a@b.c');
    expect(service.role()).toBe('ROLE_ADMIN');
    expect(service.isAuthenticated()).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(jwtToken);
  });

  it('leaves state untouched when login fails', () => {
    service.login({ email: 'a@b.c', password: 'wrong' }).subscribe({ error: () => undefined });
    httpMock
      .expectOne((req) => req.url === `${environment.apiUrl}/auth/login`)
      .flush({ status: 400, message: 'Incorrect username or password!' }, { status: 400, statusText: 'Bad Request' });

    expect(service.token()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('reports unauthenticated when the stored token is expired', () => {
    const expiredToken = makeToken({ exp: Math.floor(Date.now() / 1000) - 10 });

    service.login({ email: 'a@b.c', password: 'pw' }).subscribe();
    httpMock
      .expectOne((req) => req.url === `${environment.apiUrl}/auth/login`)
      .flush({ jwtToken: expiredToken });

    expect(service.token()).toBe(expiredToken);
    expect(service.isAuthenticated()).toBe(false);
  });

  it('clears local session on logout even when the API call fails', () => {
    service.login({ email: 'a@b.c', password: 'pw' }).subscribe();
    httpMock
      .expectOne((req) => req.url === `${environment.apiUrl}/auth/login`)
      .flush({ jwtToken: makeToken({ sub: 'a@b.c' }) });

    service.logout();
    httpMock
      .expectOne((req) => req.url === `${environment.apiUrl}/auth/logout`)
      .flush(null, { status: 404, statusText: 'Not Found' });

    expect(service.token()).toBeNull();
    expect(service.email()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe('AuthService (session restore)', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    // Set before the first injection: the service reads storage in its constructor.
    localStorage.setItem(STORAGE_KEY, makeToken({ sub: 'stored@b.c' }));
    localStorage.setItem(AVATAR_KEY, 'https://example.com/me.png');
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(AVATAR_KEY);
  });

  it('restores token and claims from localStorage on construction', () => {
    expect(service.token()).not.toBeNull();
    expect(service.email()).toBe('stored@b.c');
    expect(service.isAuthenticated()).toBe(true);
  });

  it('restores the avatar URL from localStorage on construction', () => {
    expect(service.avatarUrl()).toBe('https://example.com/me.png');
  });
});

describe('AuthService (avatar)', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(AVATAR_KEY);
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(AVATAR_KEY);
  });

  it('persists the avatar URL through setAvatarUrl and clears it with null', () => {
    service.setAvatarUrl('https://example.com/other.png');
    expect(service.avatarUrl()).toBe('https://example.com/other.png');
    expect(localStorage.getItem(AVATAR_KEY)).toBe('https://example.com/other.png');

    service.setAvatarUrl(null);
    expect(service.avatarUrl()).toBeNull();
    expect(localStorage.getItem(AVATAR_KEY)).toBeNull();
  });

  it('keeps the avatar URL on logout', () => {
    service.login({ email: 'a@b.c', password: 'pw' }).subscribe();
    httpMock
      .expectOne((req) => req.url === `${environment.apiUrl}/auth/login`)
      .flush({ jwtToken: makeToken({ sub: 'a@b.c' }) });

    service.setAvatarUrl('https://example.com/me.png');
    service.logout();
    httpMock
      .expectOne((req) => req.url === `${environment.apiUrl}/auth/logout`)
      .flush({ message: 'Bye' });

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(service.avatarUrl()).toBe('https://example.com/me.png');
    expect(localStorage.getItem(AVATAR_KEY)).toBe('https://example.com/me.png');
  });
});
