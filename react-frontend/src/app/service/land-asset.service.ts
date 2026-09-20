import { MessageResponse } from 'model/common.model';
import { PagedResponse } from 'model/paged-response.model';
import type { CreateLandAssetRequest, LandAsset } from 'model/asset.model';
import { apiRequest } from 'core/api-client';

/** /land-assets endpoints — owner-scoped on the backend; list is sorted createdAt DESC. */

export function getAll(page = 0, size = 10): Promise<PagedResponse<LandAsset>> {
  return apiRequest<PagedResponse<LandAsset>>('/land-assets', {
    params: { page: String(page), size: String(size) },
  });
}

export function getById(id: number): Promise<LandAsset> {
  return apiRequest<LandAsset>(`/land-assets/${id}`);
}

export function create(body: CreateLandAssetRequest): Promise<LandAsset> {
  return apiRequest<LandAsset>('/land-assets', { method: 'POST', body });
}

export function update(id: number, body: Partial<CreateLandAssetRequest>): Promise<LandAsset> {
  return apiRequest<LandAsset>(`/land-assets/${id}`, { method: 'PUT', body });
}

export function remove(id: number): Promise<MessageResponse> {
  return apiRequest<MessageResponse>(`/land-assets/${id}`, { method: 'DELETE' });
}

/** Bulk delete — all-or-nothing on the backend (404 if any id is missing). */
export function deleteMany(ids: number[]): Promise<MessageResponse> {
  return apiRequest<MessageResponse>('/land-assets/bulk', { method: 'DELETE', body: { ids } });
}
