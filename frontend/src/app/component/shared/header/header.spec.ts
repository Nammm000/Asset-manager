import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../../environments/environment';
import { Header } from './header';
import { ModalService } from 'service/modal.service';
import { AuthService } from 'service/auth.service';
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

describe('Header (logged out)', () => {
  let component: Header;
  let fixture: ComponentFixture<Header>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.removeItem(AVATAR_KEY);
    await TestBed.configureTestingModule({
      imports: [Header],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(Header);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.removeItem(AVATAR_KEY);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows Login and Sign Up buttons and the hamburger, no avatar', () => {
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('.btn--login')).toBeTruthy();
    expect(element.querySelector('.btn--signup')).toBeTruthy();
    expect(element.querySelector('.header__hamburger')).toBeTruthy();
    expect(element.querySelector('.header__avatar-btn')).toBeFalsy();
    expect(element.querySelector('.header__dropdown')).toBeFalsy();
  });
});

describe('Header (logged in)', () => {
  let component: Header;
  let fixture: ComponentFixture<Header>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.removeItem(AVATAR_KEY);
    await TestBed.configureTestingModule({
      imports: [Header],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    // Seed the in-memory session before the fixture reads it (tokens are never persisted).
    TestBed.inject(AuthService).applyAuthenticationResponse({ accessToken: makeToken({ sub: 'user@test.com' }) });
    fixture = TestBed.createComponent(Header);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.removeItem(AVATAR_KEY);
  });

  const avatarButton = (): HTMLElement =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.header__avatar-btn')!;

  it('replaces buttons and hamburger with the avatar showing the email initial', () => {
    const element: HTMLElement = fixture.nativeElement;
    const initials = element.querySelector<HTMLElement>('.header__avatar-initials');

    expect(element.querySelector('.header__avatar-btn')).toBeTruthy();
    expect(initials?.textContent).toBe('U');
    expect(element.querySelector('img.header__avatar-img')).toBeFalsy();
    expect(element.querySelector('.btn--login')).toBeFalsy();
    expect(element.querySelector('.btn--signup')).toBeFalsy();
    expect(element.querySelector('.header__hamburger')).toBeFalsy();
  });

  it('renders the stored avatar image instead of the initials', () => {
    TestBed.inject(AuthService).setAvatarUrl('https://example.com/me.png');
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    const img = element.querySelector<HTMLImageElement>('img.header__avatar-img');

    expect(img?.src).toBe('https://example.com/me.png');
    expect(element.querySelector('.header__avatar-initials')).toBeFalsy();
  });

  it('falls back to initials when the avatar image fails to load', () => {
    TestBed.inject(AuthService).setAvatarUrl('https://example.com/me.png');
    fixture.detectChanges();
    component.onAvatarError();
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('img.header__avatar-img')).toBeFalsy();
    expect(element.querySelector<HTMLElement>('.header__avatar-initials')?.textContent).toBe('U');
  });

  it('opens the dropdown on avatar click and closes it on Escape / outside click', () => {
    avatarButton().click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.header__dropdown')).toBeTruthy();
    expect(avatarButton().getAttribute('aria-expanded')).toBe('true');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.header__dropdown')).toBeFalsy();

    avatarButton().click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.header__dropdown')).toBeTruthy();

    document.body.click(); // outside the header element
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.header__dropdown')).toBeFalsy();
  });

  it('opens the change-password modal from the dropdown', () => {
    avatarButton().click();
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    const item = element.querySelector<HTMLElement>(
      '.header__dropdown-item:not(.header__dropdown-item--danger)',
    )!;
    item.click();
    fixture.detectChanges();

    expect(TestBed.inject(ModalService).isChangePasswordVisible()).toBe(true);
    expect(element.querySelector('.header__dropdown')).toBeFalsy();
  });

  it('logs out from the dropdown, flips back to buttons, and keeps the avatar key', () => {
    localStorage.setItem(AVATAR_KEY, 'https://example.com/me.png');

    const element: HTMLElement = fixture.nativeElement;
    avatarButton().click();
    fixture.detectChanges();
    element.querySelector<HTMLElement>('.header__dropdown-item--danger')!.click();

    const logout = httpMock.expectOne((req) => req.url === `${environment.apiUrl}/auth/logout`);
    // No body: the HttpOnly cookie identifies the token; the request is credentialed.
    expect(logout.request.body).toBeNull();
    expect(logout.request.withCredentials).toBe(true);
    logout.flush({ message: 'Bye' });
    fixture.detectChanges();

    expect(element.querySelector('.btn--login')).toBeTruthy();
    expect(element.querySelector('.header__avatar-btn')).toBeFalsy();
    // Tokens were never persisted, and the avatar deliberately survives logout.
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(AVATAR_KEY)).toBe('https://example.com/me.png');
  });
});
