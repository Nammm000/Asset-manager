/** POST /auth/login body. */
export interface LoginRequest {
  email: string;
  password: string;
}

/** POST /auth/login response. */
export interface LoginResponse {
  jwtToken: string;
}

/** POST /auth/signup body (SignupDTO). */
export interface SignupRequest {
  name: string;
  email: string;
  phone: string;
  password: string;
}

/** POST /auth/signup response (UserDTO). */
export interface UserDto {
  id: number;
  name: string;
  phone: string;
  email: string;
  accountNumber: string;
}

/** POST /auth/logout and POST /auth/forgot-password body. */
export interface EmailRequest {
  email: string;
}

/** POST /auth/logout response (LogoutResponse record). */
export interface LogoutResponse {
  message: string;
}

/** POST /auth/change-password body. */
export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}
