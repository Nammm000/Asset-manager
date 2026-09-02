import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Dashboard } from './dashboard';
import type { JwtClaims } from 'util/jwt-util';

const STORAGE_KEY = 'asset-manager.token';

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

function quickLinkTitles(): string[] {
  return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.quick-link__title')).map(
    (el) => el.textContent?.trim(),
  );
}

let component: Dashboard;
let fixture: ComponentFixture<Dashboard>;

async function createDashboard(): Promise<void> {
  await TestBed.configureTestingModule({
    imports: [Dashboard],
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  }).compileComponents();

  fixture = TestBed.createComponent(Dashboard);
  component = fixture.componentInstance;
  await fixture.whenStable();
}

describe('Dashboard', () => {
  afterEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  it('greets the signed-in user by email', async () => {
    localStorage.setItem(STORAGE_KEY, makeToken({ sub: 'owner@test.com' }));
    await createDashboard();

    expect(component.welcome()).toBe('Welcome, owner@test.com');
  });

  it('shows the five non-admin quick links for ROLE_USER', async () => {
    localStorage.setItem(STORAGE_KEY, makeToken({ role: 'ROLE_USER' }));
    await createDashboard();

    expect(quickLinkTitles()).toEqual([
      'Dashboard',
      'Savings Passbooks',
      'Land Assets',
      'Cash Assets',
      'Other Assets',
    ]);
  });

  it('shows all seven quick links for ROLE_ADMIN', async () => {
    localStorage.setItem(STORAGE_KEY, makeToken({ role: 'ROLE_ADMIN' }));
    await createDashboard();

    expect(quickLinkTitles()).toHaveLength(7);
    expect(quickLinkTitles()).toContain('Currencies');
    expect(quickLinkTitles()).toContain('Users');
  });
});
