import { MessageResponse } from 'model/common.model';
import { PagedResponse } from 'model/paged-response.model';
import type {
  AdjustCashBalanceRequest,
  CashBalance,
  CreateCashBalanceRequest,
} from 'model/asset.model';
import { apiRequest } from 'core/api-client';

/** /cash-balances endpoints — owner-scoped; list filters by cashAssetId when given. */

export function getAll(cashAssetId: number | undefined, page = 0, size = 10): Promise<PagedResponse<CashBalance>> {
  const params: Record<string, string> = { page: String(page), size: String(size) };
  if (cashAssetId !== undefined) {
    params['cashAssetId'] = String(cashAssetId);
  }
  return apiRequest<PagedResponse<CashBalance>>('/cash-balances', { params });
}

export function getById(id: number): Promise<CashBalance> {
  return apiRequest<CashBalance>(`/cash-balances/${id}`);
}

export function create(body: CreateCashBalanceRequest): Promise<CashBalance> {
  return apiRequest<CashBalance>('/cash-balances', { method: 'POST', body });
}

/** POST /{id} — signed amount, negative subtracts; currencyCode must match the balance. */
export function adjust(id: number, body: AdjustCashBalanceRequest): Promise<CashBalance> {
  return apiRequest<CashBalance>(`/cash-balances/${id}`, { method: 'POST', body });
}

/** PUT /{id} — sets the absolute amount (>= 0). */
export function setAmount(id: number, amount: number): Promise<CashBalance> {
  return apiRequest<CashBalance>(`/cash-balances/${id}`, { method: 'PUT', body: { amount } });
}

export function remove(id: number): Promise<MessageResponse> {
  return apiRequest<MessageResponse>(`/cash-balances/${id}`, { method: 'DELETE' });
}
