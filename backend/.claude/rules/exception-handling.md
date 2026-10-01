---
description: Global exception handling — AllExceptionHandler status mapping, ErrorResponseDTO shape, and the services-throw/controllers-don't-catch convention
globs:
  - "src/main/java/**/exception/**"
  - "src/main/java/**/dto/ErrorResponseDTO.java"
alwaysApply: false
---

# Exception Handling

`exception/AllExceptionHandler` (@ControllerAdvice) is the single error renderer. Controllers never try/catch — services throw:

| Exception | Status |
|---|---|
| `NotFoundException` | 404 |
| `UserNotFoundException` | 404 |
| `AccessDeniedException` (Spring Security) | 403 |
| `ConflictException` | 409 |
| `MaxUploadSizeExceededException` | 400 |
| `Exception` (catch-all) | 400 |

Error body is `dto/ErrorResponseDTO` with `statusCode`, `message`, `timestamp` (epoch millis).

`MaxUploadSizeExceededException` (a request exceeded `spring.servlet.multipart.max-file-size` / `max-request-size`) renders a dynamic message naming the tripped limit in MB (`exc.getMaxUploadSize()`, `-1` → generic wording with no number).

Input validation in services throws `IllegalArgumentException(AssetConstants.INVALID_DATA)` — it lands in the catch-all and returns 400. Note there is no dedicated handler for `MethodArgumentNotValidException`/bean-validation; DTO constraints, if added, would also fall through to the 400 catch-all.
