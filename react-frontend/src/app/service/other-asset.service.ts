import { MessageResponse } from 'model/common.model';
import { PagedResponse } from 'model/paged-response.model';
import type { CreateOtherAssetRequest, OtherAsset } from 'model/asset.model';
import { apiRequest } from 'core/api-client';

/** /other-assets endpoints — owner-scoped on the backend; list is sorted createdAt DESC. */

export function getAll(page = 0, size = 10): Promise<PagedResponse<OtherAsset>> {
  return apiRequest<PagedResponse<OtherAsset>>('/other-assets', {
    params: { page: String(page), size: String(size) },
  });
}

export function getById(id: number): Promise<OtherAsset> {
  return apiRequest<OtherAsset>(`/other-assets/${id}`);
}

export function create(body: CreateOtherAssetRequest): Promise<OtherAsset> {
  return apiRequest<OtherAsset>('/other-assets', { method: 'POST', body });
}

export function update(id: number, body: Partial<CreateOtherAssetRequest>): Promise<OtherAsset> {
  return apiRequest<OtherAsset>(`/other-assets/${id}`, { method: 'PUT', body });
}

export function remove(id: number): Promise<MessageResponse> {
  return apiRequest<MessageResponse>(`/other-assets/${id}`, { method: 'DELETE' });
}

/** Bulk delete — all-or-nothing on the backend (404 if any id is missing). */
export function deleteMany(ids: number[]): Promise<MessageResponse> {
  return apiRequest<MessageResponse>('/other-assets/bulk', { method: 'DELETE', body: { ids } });
}
