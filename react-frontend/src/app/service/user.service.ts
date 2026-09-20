import { MessageResponse } from 'model/common.model';
import type { Role, UpdateUserRoleRequest, UserWrapper } from 'model/user.model';
import { apiRequest } from 'core/api-client';

/** /users endpoints — ADMIN-only on the backend, except `getCurrentUser` (any JWT). */

export function getAll(): Promise<UserWrapper[]> {
  return apiRequest<UserWrapper[]>('/users');
}

export function getCurrentUser(): Promise<UserWrapper> {
  return apiRequest<UserWrapper>('/users/current-user');
}

export function updateStatus(id: number, status: string): Promise<MessageResponse> {
  return apiRequest<MessageResponse>(`/users/${id}/status`, { method: 'PATCH', body: { status } });
}

export function updateRole(id: number, role: Role): Promise<MessageResponse> {
  const body: UpdateUserRoleRequest = { role };
  return apiRequest<MessageResponse>(`/users/${id}/role`, { method: 'PATCH', body });
}

export function remove(id: number): Promise<MessageResponse> {
  return apiRequest<MessageResponse>(`/users/${id}`, { method: 'DELETE' });
}
