import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { MessageResponse } from 'model/common.model';
import { PagedResponse } from 'model/paged-response.model';
import type { CreateLandAssetRequest, LandAsset } from 'model/asset.model';

/** /land-assets endpoints — owner-scoped on the backend; list is sorted createdAt DESC. */
@Injectable({ providedIn: 'root' })
export class LandAssetService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/land-assets`;

  getAll(page = 0, size = 10): Observable<PagedResponse<LandAsset>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<PagedResponse<LandAsset>>(this.baseUrl, { params });
  }

  getById(id: number): Observable<LandAsset> {
    return this.http.get<LandAsset>(`${this.baseUrl}/${id}`);
  }

  create(body: CreateLandAssetRequest): Observable<LandAsset> {
    return this.http.post<LandAsset>(this.baseUrl, body);
  }

  update(id: number, body: Partial<CreateLandAssetRequest>): Observable<LandAsset> {
    return this.http.put<LandAsset>(`${this.baseUrl}/${id}`, body);
  }

  delete(id: number): Observable<MessageResponse> {
    return this.http.delete<MessageResponse>(`${this.baseUrl}/${id}`);
  }

  /** Bulk delete — all-or-nothing on the backend (404 if any id is missing). */
  deleteMany(ids: number[]): Observable<MessageResponse> {
    return this.http.delete<MessageResponse>(`${this.baseUrl}/bulk`, { body: { ids } });
  }
}
