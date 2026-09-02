import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { Currencies } from './currencies';
import { CurrencyForm } from './currency-form/currency-form';
import type { Currency } from 'model/currency.model';

const usd: Currency = { code: 'USD', name: 'US Dollar', symbol: '$', decimalPlaces: 2 };

describe('Currencies', () => {
  let component: Currencies;
  let fixture: ComponentFixture<Currencies>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Currencies],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(Currencies);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  afterEach(() => httpMock.verify());

  it('loads the plain (non-paged) list on init', () => {
    httpMock
      .expectOne((r) => r.url === `${environment.apiUrl}/currencies`)
      .flush([usd]);

    expect(component.rows()).toEqual([usd]);
    expect(component.loading()).toBe(false);
  });

  it('shows an error banner when the list fails', () => {
    httpMock
      .expectOne((r) => r.url === `${environment.apiUrl}/currencies`)
      .flush({ status: 500, message: 'Boom', timeStamp: 0 }, { status: 500, statusText: 'Server Error' });

    expect(component.errorMessage()).toBe('Boom');
  });
});

describe('CurrencyForm', () => {
  let component: CurrencyForm;
  let fixture: ComponentFixture<CurrencyForm>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CurrencyForm],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(CurrencyForm);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  afterEach(() => httpMock.verify());

  it('blocks submit while the form is invalid', () => {
    expect(component.canSubmit()).toBe(false); // everything empty

    component.name.set('US Dollar');
    component.symbol.set('$');
    component.decimalPlaces.set(2);
    expect(component.canSubmit()).toBe(false); // still no code

    component.onCodeInput('usd');
    expect(component.code()).toBe('USD'); // uppercased on input
    expect(component.canSubmit()).toBe(true);
  });

  it('seeds from the currency when editing and PUTs to the code path', () => {
    fixture.componentRef.setInput('currency', usd);
    fixture.detectChanges();
    component.ngOnInit();
    expect(component.isEdit()).toBe(true);
    expect(component.code()).toBe('USD');

    component.name.set('American Dollar');
    component.submit();

    const req = httpMock.expectOne(
      (r) => r.method === 'PUT' && r.url === `${environment.apiUrl}/currencies/USD`,
    );
    expect(req.request.body).toEqual({ code: 'USD', name: 'American Dollar', symbol: '$', decimalPlaces: 2 });
    req.flush({ messag: 'Updated' });
  });

  it('POSTs a new currency on create', () => {
    component.onCodeInput('vnd');
    component.name.set('Vietnamese Dong');
    component.symbol.set('₫');
    component.decimalPlaces.set(0);
    component.submit();

    const req = httpMock.expectOne(
      (r) => r.method === 'POST' && r.url === `${environment.apiUrl}/currencies`,
    );
    expect(req.request.body).toEqual({
      code: 'VND',
      name: 'Vietnamese Dong',
      symbol: '₫',
      decimalPlaces: 0,
    });
    req.flush({ messag: 'Created' });
  });
});
