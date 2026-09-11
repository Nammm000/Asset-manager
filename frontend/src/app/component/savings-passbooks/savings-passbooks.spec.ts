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
  savingsPassbookName: 'Main passbook',
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

const currentUser = {
  id: 1,
  name: 'Saver',
  email: 'saver@test.com',
  phone: '0123456789',
  status: 'true',
  role: 'ROLE_USER',
  accountNumber: 'ACC-7',
};

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

  it('reloads from the first page when the page size changes', () => {
    httpMock
      .expectOne((r) => r.url === `${environment.apiUrl}/savings-passbooks`)
      .flush({ ...paged([row(1)]), page: 2, totalPages: 3 });

    component.onPageSizeChange(20);

    const request = httpMock.expectOne(
      (r) => r.url === `${environment.apiUrl}/savings-passbooks`,
    );
    expect(request.request.params.get('page')).toBe('0');
    expect(request.request.params.get('size')).toBe('20');
    request.flush({ ...paged([]), size: 20, totalPages: 3 });

    expect(component.page()).toBe(0);
    expect(component.pageSize()).toBe(20); // echoes back from the response
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

  it('bulk-deletes the selection after confirmation and clears it', () => {
    httpMock
      .expectOne((r) => r.url === `${environment.apiUrl}/savings-passbooks`)
      .flush(paged([row(1), row(2), row(3)]));

    component.toggleSelected(1);
    component.toggleSelected(3);
    expect(component.selectedCount()).toBe(2);
    expect(component.allSelected()).toBe(false);

    component.confirmBulkDelete();
    TestBed.inject(ModalService).confirmation()?.onConfirm();

    const req = httpMock.expectOne(
      (r) => r.method === 'DELETE' && r.url === `${environment.apiUrl}/savings-passbooks/bulk`,
    );
    expect(req.request.body).toEqual({ ids: [1, 3] });
    req.flush({ messag: 'Deleted' });

    httpMock
      .expectOne((r) => r.url === `${environment.apiUrl}/savings-passbooks`)
      .flush(paged([row(2)]));

    expect(component.rows()).toHaveLength(1);
    expect(component.selectedCount()).toBe(0);
  });

  it('toggles the whole page via select-all', () => {
    httpMock
      .expectOne((r) => r.url === `${environment.apiUrl}/savings-passbooks`)
      .flush(paged([row(1), row(2)]));

    component.toggleSelectAll();
    expect(component.allSelected()).toBe(true);
    expect(component.selectedCount()).toBe(2);

    component.toggleSelectAll();
    expect(component.allSelected()).toBe(false);
    expect(component.selectedCount()).toBe(0);
  });

  it('opens the deposit modal from a row', () => {
    // Flush the list request ngOnInit fired.
    httpMock
      .expectOne((r) => r.url === `${environment.apiUrl}/savings-passbooks`)
      .flush(paged([row(1)]));

    component.openDepositForm(row(1));
    expect(component.depositing()?.id).toBe(1);
    expect(component.showDepositForm()).toBe(true);

    component.closeDepositForm();
    expect(component.showDepositForm()).toBe(false);
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

    // ngOnInit fetches the caller's profile to prefill the account number.
    httpMock
      .expectOne((r) => r.url === `${environment.apiUrl}/users/current-user`)
      .flush(currentUser);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('prefills email and account number, blocks submit until complete', () => {
    expect(component.email()).toBe('saver@test.com');
    expect(component.accountNumber()).toBe('ACC-7');
    expect(component.canSubmit()).toBe(false); // no passbook/amount yet

    component.savingsPassbookNumber.set('PBN-1');
    component.amount.set(500_000);
    expect(component.canSubmit()).toBe(true); // email alone is enough contact
  });

  it('prefills the passbook number from the row input', async () => {
    // The shared fixture is already initialized; seed the input on a fresh one
    // before its first change detection so ngOnInit picks it up.
    const rowFixture = TestBed.createComponent(AdditionalDepositForm);
    rowFixture.componentRef.setInput('passbookNumber', 'PBN-row');
    await rowFixture.whenStable();

    // Both fixtures' profile fetches are pending — flush them all.
    httpMock
      .match((r) => r.url === `${environment.apiUrl}/users/current-user`)
      .forEach((r) => r.flush(currentUser));

    expect(rowFixture.componentInstance.savingsPassbookNumber()).toBe('PBN-row');
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
