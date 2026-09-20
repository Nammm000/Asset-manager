import { MessageResponse } from 'model/common.model';
import { PagedResponse } from 'model/paged-response.model';
import type {
  CreateSavingsPassbookRequest,
  SavingsPassbook,
  SavingsPassbookFilters,
  UpdateSavingsPassbookRequest,
} from 'model/asset.model';
import { apiRequest } from 'core/api-client';

/** /savings-passbooks endpoints — owner-scoped on the backend (403 for other users' data). */

export function getAll(page = 0, size = 10): Promise<PagedResponse<SavingsPassbook>> {
  return apiRequest<PagedResponse<SavingsPassbook>>('/savings-passbooks', {
    params: { page: String(page), size: String(size) },
  });
}

/** GET /savings-passbooks/search — only non-empty filters are sent; page/size always. */
export function search(
  filters: SavingsPassbookFilters,
  page = 0,
  size = 10,
): Promise<PagedResponse<SavingsPassbook>> {
  return apiRequest<PagedResponse<SavingsPassbook>>('/savings-passbooks/search', {
    params: buildSearchParams(filters, page, size),
  });
}

function buildSearchParams(filters: SavingsPassbookFilters, page: number, size: number): Record<string, string> {
  const params: Record<string, string> = { page: String(page), size: String(size) };
  const name = filters.savingsPassbookName.trim();
  if (name !== '') {
    params['savingsPassbookName'] = name;
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
      params[field] = criterion.op === '=' ? value : `${criterion.op}${value}`;
    }
  }
  return params;
}

export function getById(id: number): Promise<SavingsPassbook> {
  return apiRequest<SavingsPassbook>(`/savings-passbooks/${id}`);
}

export function create(body: CreateSavingsPassbookRequest): Promise<SavingsPassbook> {
  return apiRequest<SavingsPassbook>('/savings-passbooks', { method: 'POST', body });
}

export function update(id: number, body: UpdateSavingsPassbookRequest): Promise<SavingsPassbook> {
  return apiRequest<SavingsPassbook>(`/savings-passbooks/${id}`, { method: 'PUT', body });
}

export function remove(id: number): Promise<MessageResponse> {
  return apiRequest<MessageResponse>(`/savings-passbooks/${id}`, { method: 'DELETE' });
}

/** Bulk delete — all-or-nothing on the backend (404 if any id is missing). */
export function deleteMany(ids: number[]): Promise<MessageResponse> {
  return apiRequest<MessageResponse>('/savings-passbooks/bulk', { method: 'DELETE', body: { ids } });
}
