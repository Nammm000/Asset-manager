import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { LandAssets } from './land-assets';
import { LandAssetForm } from './land-asset-form/land-asset-form';
import { ModalService } from 'service/modal.service';
import type { LandAsset } from 'model/asset.model';

const row = (id: number): LandAsset => ({
  id,
  userId: 1,
  location: `Plot ${id}`,
  area: 120,
  purchaseDate: '2025-06-01T00:00:00.000Z',
  assetType: 'LAND',
  createdAt: '2025-06-01T10:00:00',
});

const paged = (content: LandAsset[]) => ({
  content,
  page: 0,
  size: 10,
  totalElements: content.length,
  totalPages: 1,
  first: true,
  last: true,
});

describe('LandAssets', () => {
  let component: LandAssets;
  let fixture: ComponentFixture<LandAssets>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LandAssets],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(LandAssets);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  afterEach(() => httpMock.verify());

  it('loads the first page on init', () => {
    httpMock
      .expectOne((r) => r.url === `${environment.apiUrl}/land-assets`)
      .flush(paged([row(1)]));

    expect(component.rows()).toHaveLength(1);
    expect(component.loading()).toBe(false);
  });

  it('seeds the edit form from the row and converts dates to ISO on submit', () => {
    httpMock
      .expectOne((r) => r.url === `${environment.apiUrl}/land-assets`)
      .flush(paged([row(1)]));

    component.openEdit(row(1));
    expect(component.editing()?.id).toBe(1);

    const formFixture = TestBed.createComponent(LandAssetForm);
    formFixture.componentRef.setInput('asset', row(1));
    const form = formFixture.componentInstance;
    formFixture.detectChanges();
    expect(form.purchaseDate()).toBe('2025-06-01');

    form.location.set('Updated Plot');
    form.area.set(200);
    form.purchaseDate.set('2026-01-31');
    form.submit();

    const req = httpMock.expectOne(
      (r) => r.method === 'PUT' && r.url === `${environment.apiUrl}/land-assets/1`,
    );
    expect(req.request.body.location).toBe('Updated Plot');
    expect(req.request.body.area).toBe(200);
    // date input value -> ISO datetime string on the wire
    expect(String(req.request.body.purchaseDate)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(req.request.body.saleDate).toBeUndefined();
    req.flush(row(1));
  });

  it('bulk-deletes the selection after confirmation and clears it', () => {
    httpMock
      .expectOne((r) => r.url === `${environment.apiUrl}/land-assets`)
      .flush(paged([row(1), row(2), row(3)]));

    component.toggleSelected(1);
    component.toggleSelected(3);
    expect(component.selectedCount()).toBe(2);

    component.confirmBulkDelete();
    TestBed.inject(ModalService).confirmation()?.onConfirm();

    const req = httpMock.expectOne(
      (r) => r.method === 'DELETE' && r.url === `${environment.apiUrl}/land-assets/bulk`,
    );
    expect(req.request.body).toEqual({ ids: [1, 3] });
    req.flush({ messag: 'Deleted' });

    httpMock
      .expectOne((r) => r.url === `${environment.apiUrl}/land-assets`)
      .flush(paged([row(2)]));

    expect(component.rows()).toHaveLength(1);
    expect(component.selectedCount()).toBe(0);
  });

  it('toggles the whole page via select-all', () => {
    httpMock
      .expectOne((r) => r.url === `${environment.apiUrl}/land-assets`)
      .flush(paged([row(1), row(2)]));

    component.toggleSelectAll();
    expect(component.allSelected()).toBe(true);
    expect(component.selectedCount()).toBe(2);

    component.toggleSelectAll();
    expect(component.allSelected()).toBe(false);
    expect(component.selectedCount()).toBe(0);
  });
});
