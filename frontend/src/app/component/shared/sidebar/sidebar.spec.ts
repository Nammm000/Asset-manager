import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Sidebar } from './sidebar';
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

@Component({ template: '' })
class DummyPage {}

function linkLabels(): string[] {
  return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.sidebar__link')).map(
    (a) => a.textContent?.trim(),
  );
}

let fixture: ComponentFixture<Sidebar>;

async function createSidebar(): Promise<void> {
  await TestBed.configureTestingModule({
    imports: [Sidebar],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([{ path: '**', component: DummyPage }]),
    ],
  }).compileComponents();

  fixture = TestBed.createComponent(Sidebar);
  await fixture.whenStable();
}

describe('Sidebar', () => {
  afterEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  it('shows the five non-admin items for ROLE_USER', async () => {
    localStorage.setItem(STORAGE_KEY, makeToken({ role: 'ROLE_USER' }));
    await createSidebar();

    expect(linkLabels()).toEqual([
      'Dashboard',
      'Savings Passbooks',
      'Land Assets',
      'Cash Assets',
      'Other Assets',
    ]);
  });

  it('shows the five non-admin items for ROLE_CUSTOMER too', async () => {
    localStorage.setItem(STORAGE_KEY, makeToken({ role: 'ROLE_CUSTOMER' }));
    await createSidebar();

    expect(linkLabels()).toHaveLength(5);
    expect(linkLabels()).not.toContain('Currencies');
  });

  it('adds the two admin items for ROLE_ADMIN', async () => {
    localStorage.setItem(STORAGE_KEY, makeToken({ role: 'ROLE_ADMIN' }));
    await createSidebar();

    expect(linkLabels()).toEqual([
      'Dashboard',
      'Savings Passbooks',
      'Land Assets',
      'Cash Assets',
      'Other Assets',
      'Currencies',
      'Users',
    ]);
  });

  it('links each item to its route path', async () => {
    localStorage.setItem(STORAGE_KEY, makeToken({ role: 'ROLE_USER' }));
    await createSidebar();

    const first = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>('.sidebar__link')!;
    expect(first.getAttribute('href')).toBe('/dashboard');
  });
});
