import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { MessageResponse } from 'model/common.model';
import type { Currency } from 'model/currency.model';

/** /currencies endpoints — writes are ADMIN-only on the backend. */
@Injectable({ providedIn: 'root' })
export class CurrencyService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/currencies`;

  getAll(): Observable<Currency[]> {
    return this.http.get<Currency[]>(this.baseUrl);
  }

  getByCode(code: string): Observable<Currency> {
    return this.http.get<Currency>(`${this.baseUrl}/${code}`);
  }

  create(currency: Currency): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(this.baseUrl, currency);
  }

  update(code: string, currency: Currency): Observable<MessageResponse> {
    return this.http.put<MessageResponse>(`${this.baseUrl}/${code}`, currency);
  }

  delete(code: string): Observable<MessageResponse> {
    return this.http.delete<MessageResponse>(`${this.baseUrl}/${code}`);
  }
}
