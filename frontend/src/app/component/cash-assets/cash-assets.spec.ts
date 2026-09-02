import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { CashAssets } from './cash-assets';
import { CashAssetBalances } from './cash-asset-balances/cash-asset-balances';
import { ModalService } from 'service/modal.service';
import type { CashAsset, CashBalance } from 'model/asset.model';
import type { Currency } from 'model/currency.model';

const currencies: Currency[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$', decimalPlaces: 2 },
  { code: 'VND', name: 'Vietnamese Dong', symbol: '₫', decimalPlaces: 0 },
];

const walletRow = (id: number): CashAsset => ({
  id,
  userId: 1,
  assetType: 'CASH',
  createdAt: '2026-02-01T10:00:00',
});

const balance = (id: number, code: string, amount: number): CashBalance => ({
  id,
  cashAssetId: 7,
  currencyCode: code,
  amount,
});

const paged = (content: CashAsset[]) => ({
  content,
  page: 0,
  size: 10,
  totalElements: content.length,
  totalPages: 1,
  first: true,
  last: true,
});

describe('CashAssets (page)', () => {
  let component: CashAssets;
  let fixture: ComponentFixture<CashAssets>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CashAssets],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(CashAssets);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  afterEach(() => httpMock.verify());

  it('loads wallets and currencies on init', () => {
    httpMock
      .expectOne((r) => r.url === `${environment.apiUrl}/cash-assets`)
      .flush(paged([walletRow(7)]));
    httpMock
      .expectOne((r) => r.url === `${environment.apiUrl}/currencies`)
      .flush(currencies);

    expect(component.rows()).toHaveLength(1);
    expect(component.currencies()).toEqual(currencies);
  });

  it('survives a currency-list failure', () => {
    httpMock
      .expectOne((r) => r.url === `${environment.apiUrl}/cash-assets`)
      .flush(paged([walletRow(7)]));
    httpMock
      .expectOne((r) => r.url === `${environment.apiUrl}/currencies`)
      .flush({ status: 500, message: 'Boom', timeStamp: 0 }, { status: 500, statusText: 'Server Error' });

    expect(component.currencies()).toEqual([]);
    expect(component.errorMessage()).toBe(''); // non-fatal by design
  });

  it('fetches and caches balances when a wallet is expanded', () => {
    httpMock
      .expectOne((r) => r.url === `${environment.apiUrl}/cash-assets`)
      .flush(paged([walletRow(7)]));
    httpMock
      .expectOne((r) => r.url === `${environment.apiUrl}/currencies`)
      .flush(currencies);

    component.toggleBalances(walletRow(7));
    expect(component.expandedId()).toBe(7);

    httpMock
      .expectOne((r) => r.url === `${environment.apiUrl}/cash-assets/7`)
      .flush({ ...walletRow(7), balances: [balance(1, 'USD', 100)] });

    expect(component.detailFor(7)?.balances).toHaveLength(1);

    // Collapsing and re-expanding reuses the cache — no second getById
    component.toggleBalances(walletRow(7));
    component.toggleBalances(walletRow(7));
    expect(component.expandedId()).toBe(7);
  });

  it('deletes a wallet after confirmation', () => {
    httpMock
      .expectOne((r) => r.url === `${environment.apiUrl}/cash-assets`)
      .flush(paged([walletRow(7)]));
    httpMock
      .expectOne((r) => r.url === `${environment.apiUrl}/currencies`)
      .flush(currencies);

    component.confirmDelete(walletRow(7));
    TestBed.inject(ModalService).confirmation()?.onConfirm();

    httpMock
      .expectOne((r) => r.method === 'DELETE' && r.url === `${environment.apiUrl}/cash-assets/7`)
      .flush({ messag: 'Deleted' });
    httpMock
      .expectOne((r) => r.url === `${environment.apiUrl}/cash-assets`)
      .flush(paged([]));

    expect(component.rows()).toHaveLength(0);
  });
});

describe('CashAssetBalances (child)', () => {
  let component: CashAssetBalances;
  let fixture: ComponentFixture<CashAssetBalances>;
  let httpMock: HttpTestingController;

  const walletWithUsd: CashAsset = {
    ...walletRow(7),
    balances: [balance(1, 'USD', 100)],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CashAssetBalances],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(CashAssetBalances);
    fixture.componentRef.setInput('wallet', walletWithUsd);
    fixture.componentRef.setInput('currencies', currencies);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  afterEach(() => httpMock.verify());

  it('hides already-held currencies from the add dropdown', () => {
    expect(component.availableCurrencies().map((c) => c.code)).toEqual(['VND']);
  });

  it('labels held currencies with their symbol', () => {
    expect(component.currencyLabel('USD')).toBe('USD ($)');
    expect(component.currencyLabel('XXX')).toBe('XXX');
  });

  it('adds a balance with the wallet id and chosen currency', () => {
    component.openAdd();
    component.currencyCode.set('VND');
    component.amount.set(250_000);
    component.submit();

    const req = httpMock.expectOne((r) => r.url === `${environment.apiUrl}/cash-balances`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ cashAssetId: 7, currencyCode: 'VND', amount: 250_000 });
    req.flush(balance(2, 'VND', 250_000));
  });

  it('adjusts with a negative amount when subtracting', () => {
    component.openAdjust(balance(1, 'USD', 100));
    component.amount.set(30);
    component.direction.set('subtract');
    component.submit();

    const req = httpMock.expectOne(
      (r) => r.method === 'POST' && r.url === `${environment.apiUrl}/cash-balances/1`,
    );
    expect(req.request.body).toEqual({ currencyCode: 'USD', amount: -30 });
    req.flush(balance(1, 'USD', 70));
  });

  it('sets the absolute amount via PUT', () => {
    component.openSet(balance(1, 'USD', 100));
    component.amount.set(500);
    component.submit();

    const req = httpMock.expectOne(
      (r) => r.method === 'PUT' && r.url === `${environment.apiUrl}/cash-balances/1`,
    );
    expect(req.request.body).toEqual({ amount: 500 });
    req.flush(balance(1, 'USD', 500));
  });

  it('deletes a balance after confirmation', () => {
    component.confirmDelete(balance(1, 'USD', 100));
    TestBed.inject(ModalService).confirmation()?.onConfirm();

    httpMock
      .expectOne((r) => r.method === 'DELETE' && r.url === `${environment.apiUrl}/cash-balances/1`)
      .flush({ messag: 'Deleted' });
  });
});
