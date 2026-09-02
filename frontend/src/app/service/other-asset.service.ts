import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { MessageResponse } from 'model/common.model';
import { PagedResponse } from 'model/paged-response.model';
import type { CreateOtherAssetRequest, OtherAsset } from 'model/asset.model';

/** /other-assets endpoints — owner-scoped on the backend; list is sorted createdAt DESC. */
@Injectable({ providedIn: 'root' })
export class OtherAssetService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/other-assets`;

  getAll(page = 0, size = 10): Observable<PagedResponse<OtherAsset>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<PagedResponse<OtherAsset>>(this.baseUrl, { params });
  }

  getById(id: number): Observable<OtherAsset> {
    return this.http.get<OtherAsset>(`${this.baseUrl}/${id}`);
  }

  create(body: CreateOtherAssetRequest): Observable<OtherAsset> {
    return this.http.post<OtherAsset>(this.baseUrl, body);
  }

  update(id: number, body: Partial<CreateOtherAssetRequest>): Observable<OtherAsset> {
    return this.http.put<OtherAsset>(`${this.baseUrl}/${id}`, body);
  }

  delete(id: number): Observable<MessageResponse> {
    return this.http.delete<MessageResponse>(`${this.baseUrl}/${id}`);
  }
}
