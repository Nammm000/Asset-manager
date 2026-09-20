import type { AdditionalDepositRequest, SavingsPassbook } from 'model/asset.model';
import { apiRequest } from 'core/api-client';

/**
 * POST /additional-deposits — adds a deposit to a savings passbook.
 * The account email or phone must match the account's records on the backend;
 * returns the updated passbook (with its savingsPassbookNumber populated).
 */
export function deposit(body: AdditionalDepositRequest): Promise<SavingsPassbook> {
  return apiRequest<SavingsPassbook>('/additional-deposits', { method: 'POST', body });
}
