---
description: Stateless JWT authentication — filter chain, permitted endpoints, method-level authorization, and login flow
globs: ["src/main/java/**/*.java"]
alwaysApply: false
---

# Security & Authentication

Stateless JWT auth (jjwt 0.11.5, hardcoded secret in `util/JwtUtil`):

- `JwtRequestFilter` (OncePerRequestFilter) extracts/validates the Bearer token, loads the user via `UserDetailsServiceImpl`, and populates the SecurityContext before `UsernamePasswordAuthenticationFilter`.
- `WebSecurityConfiguration` permits `/auth/login`, `/auth/signup`, `/auth/forgot-password`, `/auth/hello`, plus several `/dashboard`, `/news`, `/plan` endpoints (some don't exist yet); everything else requires authentication.
- Method-level auth via `@EnableMethodSecurity` and `@PreAuthorize("hasRole('ADMIN')")` on admin endpoints (user management, currency writes).
- Per-resource authorization happens in services: `UserUtils.checkOwnership(asset)` throws `AccessDeniedException` (→ 403) when an asset belongs to another user.
- Login flow: `AuthenticationController.login` authenticates against Spring Security, then `JwtUtil.generateToken(username, role)` embeds the role as a claim.