import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { MessageResponse } from 'model/common.model';
import { PagedResponse } from 'model/paged-response.model';
import type {
  CreateSavingsPassbookRequest,
  SavingsPassbook,
  SavingsPassbookFilters,
  UpdateSavingsPassbookRequest,
} from 'model/asset.model';

/** /savings-passbooks endpoints — owner-scoped on the backend (403 for other users' data). */
@Injectable({ providedIn: 'root' })
export class SavingsPassbookService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/savings-passbooks`;

  getAll(page = 0, size = 10): Observable<PagedResponse<SavingsPassbook>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<PagedResponse<SavingsPassbook>>(this.baseUrl, { params });
  }

  /** GET /savings-passbooks/search — only non-empty filters are sent; page/size always. */
  search(
    filters: SavingsPassbookFilters,
    page = 0,
    size = 10,
  ): Observable<PagedResponse<SavingsPassbook>> {
    return this.http.get<PagedResponse<SavingsPassbook>>(
      `${this.baseUrl}/search`,
      { params: this.buildSearchParams(filters, page, size) },
    );
  }

  private buildSearchParams(
    filters: SavingsPassbookFilters,
    page: number,
    size: number,
  ): HttpParams {
    let params = new HttpParams().set('page', page).set('size', size);
    const name = filters.savingsPassbookName.trim();
    if (name !== '') {
      params = params.set('savingsPassbookName', name);
    }
    const criteria = [
      ['principalAmount', filters.principalAmount],
      ['depositTerm', filters.depositTerm],
      ['interestRate', filters.interestRate],
      ['maturityDate', filters.maturityDate],
      ['withdrawalDate', filters.withdrawalDate],
      ['estimatedMaturityProceeds', filters.estimatedMaturityProceeds],
    ] as const;
    for (const [field, criterion] of criteria) {
      const value = criterion.value.trim();
      // An operator with no value is skipped — the backend would 400 on a bare ">="
      if (value !== '') {
        params = params.set(
          field,
          criterion.op === '=' ? value : `${criterion.op}${value}`,
        );
      }
    }
    return params;
  }

  getById(id: number): Observable<SavingsPassbook> {
    return this.http.get<SavingsPassbook>(`${this.baseUrl}/${id}`);
  }

  create(body: CreateSavingsPassbookRequest): Observable<SavingsPassbook> {
    return this.http.post<SavingsPassbook>(this.baseUrl, body);
  }

  update(id: number, body: UpdateSavingsPassbookRequest): Observable<SavingsPassbook> {
    return this.http.put<SavingsPassbook>(`${this.baseUrl}/${id}`, body);
  }

  delete(id: number): Observable<MessageResponse> {
    return this.http.delete<MessageResponse>(`${this.baseUrl}/${id}`);
  }

  /** Bulk delete — all-or-nothing on the backend (404 if any id is missing). */
  deleteMany(ids: number[]): Observable<MessageResponse> {
    return this.http.delete<MessageResponse>(`${this.baseUrl}/bulk`, { body: { ids } });
  }
}
