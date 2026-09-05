import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { SavingsPassbooks } from './savings-passbooks';
import { AdditionalDepositForm } from './additional-deposit-form/additional-deposit-form';
import { ModalService } from 'service/modal.service';
import { AuthService } from 'service/auth.service';
import type { SavingsPassbook } from 'model/asset.model';

function base64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function makeToken(): string {
  const claims = {
    sub: 'saver@test.com',
    role: 'ROLE_USER',
    iat: 1000,
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  return `header.${base64Url(JSON.stringify(claims))}.signature`;
}

const row = (id: number): SavingsPassbook => ({
  id,
  userId: 1,
  principalAmount: 10_000_000,
  savingsPassbookNumber: 'SP-001',
  depositTerm: 360,
  interestRate: 5.5,
  maturityDate: '2027-01-01T00:00:00.000Z',
  assetType: 'SAVINGS_PASSBOOK',
  createdAt: '2026-01-10T10:00:00',
});

const paged = (content: SavingsPassbook[]) => ({
  content,
  page: 0,
  size: 10,
  totalElements: content.length,
  totalPages: 1,
  first: true,
  last: true,
});

describe('SavingsPassbooks', () => {
  let component: SavingsPassbooks;
  let fixture: ComponentFixture<SavingsPassbooks>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SavingsPassbooks],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    // Seed the in-memory session before the component reads it (tokens are never persisted).
    TestBed.inject(AuthService).applyAuthenticationResponse({ accessToken: makeToken() });
    fixture = TestBed.createComponent(SavingsPassbooks);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loads the first page on init', () => {
    httpMock
      .expectOne((r) => r.url === `${environment.apiUrl}/savings-passbooks`)
      .flush(paged([row(1), row(2)]));

    expect(component.rows()).toHaveLength(2);
    expect(component.loading()).toBe(false);
  });

  it('deletes after confirmation and reloads', () => {
    httpMock
      .expectOne((r) => r.url === `${environment.apiUrl}/savings-passbooks`)
      .flush(paged([row(1)]));

    component.confirmDelete(row(1));
    TestBed.inject(ModalService).confirmation()?.onConfirm();

    httpMock
      .expectOne((r) => r.method === 'DELETE' && r.url === `${environment.apiUrl}/savings-passbooks/1`)
      .flush({ messag: 'Deleted' });
    httpMock
      .expectOne((r) => r.url === `${environment.apiUrl}/savings-passbooks`)
      .flush(paged([]));

    expect(component.rows()).toHaveLength(0);
  });
});

describe('AdditionalDepositForm', () => {
  let component: AdditionalDepositForm;
  let fixture: ComponentFixture<AdditionalDepositForm>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdditionalDepositForm],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    // Seed the in-memory session before the component reads it (tokens are never persisted).
    TestBed.inject(AuthService).applyAuthenticationResponse({ accessToken: makeToken() });
    fixture = TestBed.createComponent(AdditionalDepositForm);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('prefills the email from the session and blocks submit until complete', () => {
    expect(component.email()).toBe('saver@test.com');
    expect(component.canSubmit()).toBe(false); // no account/passbook/amount yet

    component.accountNumber.set('ACC-1');
    component.savingsPassbookNumber.set('PBN-1');
    component.amount.set(500_000);
    expect(component.canSubmit()).toBe(true); // email alone is enough contact
  });

  it('posts the exact deposit body and reports the returned passbook', () => {
    component.accountNumber.set('ACC-1');
    component.savingsPassbookNumber.set('PBN-abc');
    component.amount.set(500_000);
    component.submit();

    const req = httpMock.expectOne((r) => r.url === `${environment.apiUrl}/additional-deposits`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      email: 'saver@test.com',
      phone: '',
      accountNumber: 'ACC-1',
      savingsPassbookNumber: 'PBN-abc',
      amount: 500_000,
    });
    req.flush({ ...row(1), savingsPassbookNumber: 'PBN-abc', principalAmount: 10_500_000 });

    expect(component.successMessage()).toContain('PBN-abc');
    expect(component.successMessage()).toContain('10.500.000');
  });

  it('requires no contact field to be valid when both are empty', () => {
    component.email.set('');
    component.accountNumber.set('ACC-1');
    component.savingsPassbookNumber.set('PBN-1');
    component.amount.set(1);
    expect(component.hasContact()).toBe(false);
    expect(component.canSubmit()).toBe(false);

    component.phone.set('0123456789');
    expect(component.canSubmit()).toBe(true);
  });
});
