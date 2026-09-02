import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import type { AdditionalDepositRequest, SavingsPassbook } from 'model/asset.model';

/**
 * POST /additional-deposits — adds a deposit to a savings passbook.
 * The account email or phone must match the account's records on the backend;
 * returns the updated passbook (with its savingsPassbookNumber populated).
 */
@Injectable({ providedIn: 'root' })
export class AdditionalDepositService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/additional-deposits`;

  deposit(body: AdditionalDepositRequest): Observable<SavingsPassbook> {
    return this.http.post<SavingsPassbook>(this.baseUrl, body);
  }
}
