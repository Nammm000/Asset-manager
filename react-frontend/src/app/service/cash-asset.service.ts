import { MessageResponse } from 'model/common.model';
import { PagedResponse } from 'model/paged-response.model';
import type { CashAsset, CreateCashAssetRequest } from 'model/asset.model';
import { apiRequest } from 'core/api-client';

/** /cash-assets endpoints — owner-scoped. No update(): the backend has no PUT here. */

export function getAll(page = 0, size = 10): Promise<PagedResponse<CashAsset>> {
  return apiRequest<PagedResponse<CashAsset>>('/cash-assets', {
    params: { page: String(page), size: String(size) },
  });
}

/** Includes the nested balances list. */
export function getById(id: number): Promise<CashAsset> {
  return apiRequest<CashAsset>(`/cash-assets/${id}`);
}

export function create(body: CreateCashAssetRequest): Promise<CashAsset> {
  return apiRequest<CashAsset>('/cash-assets', { method: 'POST', body });
}

export function remove(id: number): Promise<MessageResponse> {
  return apiRequest<MessageResponse>(`/cash-assets/${id}`, { method: 'DELETE' });
}

/** Bulk delete — all-or-nothing on the backend (404 if any id is missing). */
export function deleteMany(ids: number[]): Promise<MessageResponse> {
  return apiRequest<MessageResponse>('/cash-assets/bulk', { method: 'DELETE', body: { ids } });
}
