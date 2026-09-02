/** User.Role enum on the backend; also the JWT `role` claim value. */
export type Role = 'ROLE_USER' | 'ROLE_ADMIN' | 'ROLE_CUSTOMER';

/** GET /users item (UserWrapper). `status` is a stringly-typed "true"/"false" on the backend. */
export interface UserWrapper {
  id: number;
  name: string;
  email: string;
  phone: string;
  status: string;
  createdTime: string;
  role: Role;
}

/** PATCH /users/{id}/role body. */
export interface UpdateUserRoleRequest {
  role: Role;
}
