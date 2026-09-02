import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { MessageResponse } from 'model/common.model';
import { PagedResponse } from 'model/paged-response.model';
import type { CashAsset, CreateCashAssetRequest } from 'model/asset.model';

/** /cash-assets endpoints — owner-scoped. No update(): the backend has no PUT here. */
@Injectable({ providedIn: 'root' })
export class CashAssetService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/cash-assets`;

  getAll(page = 0, size = 10): Observable<PagedResponse<CashAsset>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<PagedResponse<CashAsset>>(this.baseUrl, { params });
  }

  /** Includes the nested balances list. */
  getById(id: number): Observable<CashAsset> {
    return this.http.get<CashAsset>(`${this.baseUrl}/${id}`);
  }

  create(body: CreateCashAssetRequest): Observable<CashAsset> {
    return this.http.post<CashAsset>(this.baseUrl, body);
  }

  delete(id: number): Observable<MessageResponse> {
    return this.http.delete<MessageResponse>(`${this.baseUrl}/${id}`);
  }
}
