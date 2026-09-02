import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from 'service/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token();
  // Attach only a live token: the backend JWT filter throws on an expired/malformed
  // token before authorization rules apply, which would 500 every endpoint,
  // public ones included. No URL allowlist needed — public paths ignore a valid header.
  if (token !== null && auth.isAuthenticated()) {
    return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
  }
  return next(req);
};
