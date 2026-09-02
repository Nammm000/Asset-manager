import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { Observable, take, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ChangePasswordRequest,
  EmailRequest,
  LoginRequest,
  LoginResponse,
  LogoutResponse,
  SignupRequest,
  UserDto,
} from 'model/auth.model';
import { MessageResponse } from 'model/common.model';
import type { Role } from 'model/user.model';
import { JwtClaims, decodeJwt, isExpired } from 'util/jwt-util';

/** Single auth facade: JWT session state (signals) + /auth endpoint calls. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly storageKey = 'asset-manager.token';

  // Initialized from storage; null on the server (SSR/prerender never touches localStorage).
  private readonly _token = signal<string | null>(this.readStoredToken());
  readonly token = this._token.asReadonly();

  private readonly _claims = signal<JwtClaims | null>(this._token() ? decodeJwt(this._token()!) : null);
  readonly claims = this._claims.asReadonly();

  readonly email = computed(() => this._claims()?.sub ?? null);
  readonly role = computed<Role | null>(() => this._claims()?.role ?? null);

  // Avatar image URL; browser-only (null on the server). No backend source yet —
  // seeded manually via localStorage until one exists. Deliberately NOT cleared
  // on logout: nothing can restore it, and the initials fallback always derives
  // from the current JWT's sub claim.
  private readonly avatarStorageKey = 'asset-manager.avatar';
  private readonly _avatarUrl = signal<string | null>(this.readStoredAvatar());
  readonly avatarUrl = this._avatarUrl.asReadonly();

  // Method, not computed: Date.now() is not reactive, so a computed would cache a
  // stale "authenticated" for the rest of the session after the token expires.
  isAuthenticated(): boolean {
    const claims = this._claims();
    return this._token() !== null && claims !== null && !isExpired(claims);
  }

  isAdmin(): boolean {
    return this.role() === 'ROLE_ADMIN';
  }

  login(request: LoginRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/auth/login`, request)
      .pipe(tap((response) => this.setSession(response.jwtToken)));
  }

  signup(request: SignupRequest): Observable<UserDto> {
    return this.http.post<UserDto>(`${environment.apiUrl}/auth/signup`, request);
  }

  logout(): void {
    const email = this.email();
    if (email !== null) {
      // Fire the request while the session is still live so the interceptor attaches
      // the Bearer header (interceptors run synchronously at subscribe time), then
      // clear local state. The JWT is stateless server-side: local clearing is the
      // real logout and must happen even if this call fails.
      this.http
        .post<LogoutResponse>(`${environment.apiUrl}/auth/logout`, { email })
        .pipe(take(1))
        .subscribe({ error: () => undefined });
    }
    this.clearSession();
  }

  forgotPassword(body: EmailRequest): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${environment.apiUrl}/auth/forgot-password`, body);
  }

  changePassword(body: ChangePasswordRequest): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${environment.apiUrl}/auth/change-password`, body);
  }

  hello(): Observable<string> {
    return this.http.get(`${environment.apiUrl}/auth/hello`, { responseType: 'text' });
  }

  private setSession(token: string): void {
    this._token.set(token);
    this._claims.set(decodeJwt(token));
    this.persist();
  }

  private clearSession(): void {
    this._token.set(null);
    this._claims.set(null);
    this.persist();
  }

  private persist(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    if (this._token() === null) {
      localStorage.removeItem(this.storageKey);
    } else {
      localStorage.setItem(this.storageKey, this._token()!);
    }
  }

  private readStoredToken(): string | null {
    return isPlatformBrowser(this.platformId) ? localStorage.getItem(this.storageKey) : null;
  }

  /** Set (or clear with null) the avatar URL and persist it. No UI caller yet. */
  setAvatarUrl(url: string | null): void {
    this._avatarUrl.set(url);
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    if (url === null) {
      localStorage.removeItem(this.avatarStorageKey);
    } else {
      localStorage.setItem(this.avatarStorageKey, url);
    }
  }

  private readStoredAvatar(): string | null {
    return isPlatformBrowser(this.platformId) ? localStorage.getItem(this.avatarStorageKey) : null;
  }
}
