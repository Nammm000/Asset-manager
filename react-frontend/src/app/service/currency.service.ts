import { MessageResponse } from 'model/common.model';
import type { Currency } from 'model/currency.model';
import { apiRequest } from 'core/api-client';

/** /currencies endpoints — writes are ADMIN-only on the backend. */

export function getAll(): Promise<Currency[]> {
  return apiRequest<Currency[]>('/currencies');
}

export function getByCode(code: string): Promise<Currency> {
  return apiRequest<Currency>(`/currencies/${code}`);
}

export function create(currency: Currency): Promise<MessageResponse> {
  return apiRequest<MessageResponse>('/currencies', { method: 'POST', body: currency });
}

export function update(code: string, currency: Currency): Promise<MessageResponse> {
  return apiRequest<MessageResponse>(`/currencies/${code}`, { method: 'PUT', body: currency });
}

export function remove(code: string): Promise<MessageResponse> {
  return apiRequest<MessageResponse>(`/currencies/${code}`, { method: 'DELETE' });
}
