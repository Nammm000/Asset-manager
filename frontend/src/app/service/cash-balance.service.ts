import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { MessageResponse } from 'model/common.model';
import { PagedResponse } from 'model/paged-response.model';
import type {
  AdjustCashBalanceRequest,
  CashBalance,
  CreateCashBalanceRequest,
} from 'model/asset.model';

/** /cash-balances endpoints — owner-scoped; list filters by cashAssetId when given. */
@Injectable({ providedIn: 'root' })
export class CashBalanceService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/cash-balances`;

  getAll(cashAssetId: number | undefined, page = 0, size = 10): Observable<PagedResponse<CashBalance>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (cashAssetId !== undefined) {
      params = params.set('cashAssetId', cashAssetId);
    }
    return this.http.get<PagedResponse<CashBalance>>(this.baseUrl, { params });
  }

  getById(id: number): Observable<CashBalance> {
    return this.http.get<CashBalance>(`${this.baseUrl}/${id}`);
  }

  create(body: CreateCashBalanceRequest): Observable<CashBalance> {
    return this.http.post<CashBalance>(this.baseUrl, body);
  }

  /** POST /{id} — signed amount, negative subtracts; currencyCode must match the balance. */
  adjust(id: number, body: AdjustCashBalanceRequest): Observable<CashBalance> {
    return this.http.post<CashBalance>(`${this.baseUrl}/${id}`, body);
  }

  /** PUT /{id} — sets the absolute amount (>= 0). */
  setAmount(id: number, amount: number): Observable<CashBalance> {
    return this.http.put<CashBalance>(`${this.baseUrl}/${id}`, { amount });
  }

  delete(id: number): Observable<MessageResponse> {
    return this.http.delete<MessageResponse>(`${this.baseUrl}/${id}`);
  }
}
