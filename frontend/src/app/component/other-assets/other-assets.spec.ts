import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { OtherAssets } from './other-assets';
import { ModalService } from 'service/modal.service';
import type { OtherAsset } from 'model/asset.model';

const row = (id: number): OtherAsset => ({
  id,
  userId: 1,
  name: `Asset ${id}`,
  amount: 3,
  pricePerUnit: 1500,
  assetType: 'OTHER',
  createdAt: '2026-01-15T10:00:00',
});

describe('OtherAssets', () => {
  let component: OtherAssets;
  let fixture: ComponentFixture<OtherAssets>;
  let httpMock: HttpTestingController;

  const paged = (content: OtherAsset[]) => ({
    content,
    page: 0,
    size: 10,
    totalElements: content.length,
    totalPages: 1,
    first: true,
    last: true,
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OtherAssets],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(OtherAssets);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  afterEach(() => httpMock.verify());

  it('loads the first page on init', () => {
    const req = httpMock.expectOne(
      (r) => r.url === `${environment.apiUrl}/other-assets`,
    );
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('size')).toBe('10');
    req.flush(paged([row(1), row(2)]));

    expect(component.rows()).toHaveLength(2);
    expect(component.loading()).toBe(false);
    expect(component.errorMessage()).toBe('');
  });

  it('loads the requested page', () => {
    httpMock
      .expectOne((r) => r.url === `${environment.apiUrl}/other-assets`)
      .flush(paged([])); // consume the ngOnInit load

    component.load(1);
    const req = httpMock.expectOne(
      (r) => r.url === `${environment.apiUrl}/other-assets` && r.params.get('page') === '1',
    );
    req.flush({ ...paged([]), page: 1, first: false, last: true });

    expect(component.page()).toBe(1);
  });

  it('shows an error banner when loading fails', () => {
    httpMock
      .expectOne((r) => r.url === `${environment.apiUrl}/other-assets`)
      .flush({ status: 500, message: 'Boom', timeStamp: 0 }, { status: 500, statusText: 'Server Error' });

    expect(component.errorMessage()).toBe('Boom');
    expect(component.loading()).toBe(false);
  });

  it('surfaces delete errors on the page banner', () => {
    httpMock
      .expectOne((r) => r.url === `${environment.apiUrl}/other-assets`)
      .flush(paged([row(1)]));

    component.confirmDelete(row(1));
    TestBed.inject(ModalService).confirmation()?.onConfirm();

    httpMock
      .expectOne((r) => r.method === 'DELETE' && r.url === `${environment.apiUrl}/other-assets/1`)
      .flush({ status: 500, message: 'Nope', timeStamp: 0 }, { status: 500, statusText: 'Server Error' });

    expect(component.errorMessage()).toBe('Nope');
  });

  it('deletes after confirmation and reloads', () => {
    httpMock
      .expectOne((r) => r.url === `${environment.apiUrl}/other-assets`)
      .flush(paged([row(1)]));

    component.confirmDelete(row(1));
    TestBed.inject(ModalService).confirmation()?.onConfirm();

    httpMock
      .expectOne((r) => r.method === 'DELETE' && r.url === `${environment.apiUrl}/other-assets/1`)
      .flush({ messag: 'Deleted' });
    httpMock
      .expectOne((r) => r.url === `${environment.apiUrl}/other-assets`)
      .flush(paged([]));

    expect(component.rows()).toHaveLength(0);
  });
});
