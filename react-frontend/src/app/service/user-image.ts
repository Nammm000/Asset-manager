import { MessageResponse } from 'model/common.model';
import { UserImage } from 'model/user-image.model';
import { useAuthStore } from 'store/auth-store';
import { ApiError } from 'core/http';
import { apiRequest } from 'core/api-client';

/**
 * Owns the signed-in user's avatar on /images/avatar (MinIO-backed, JWT
 * protected, current-user scoped). GET needs the Authorization header, so the
 * bytes can never be a plain <img src> — they are fetched as a Blob and
 * published through the auth store as a blob: object URL. The header +
 * settings page render whatever avatarUrl holds, so both refresh automatically
 * on upload/delete.
 *
 * Session hydration (NotificationService pattern): initAvatarSync() subscribes
 * to sessionActive and refetches the avatar on every false→true transition —
 * app start, login/signup and re-login as a different user all end in a GET.
 * The avatar is cosmetic, so every background failure is silent: 404 means the
 * server says none exists (clear — also retires legacy seeded https: URLs),
 * anything else is a transient blip and leaves the current URL alone. Never
 * cleared on session end: re-hydration on the next session start replaces it.
 */

/** The object URL this module created last; revoked when replaced. */
let managedAvatarUrl: string | null = null;

let initialized = false;

/** Called once from main.tsx, after restoreSession() settles and before first render. */
export function initAvatarSync(): void {
  if (initialized) {
    return;
  }
  initialized = true;

  let wasActive = useAuthStore.getState().sessionActive;
  useAuthStore.subscribe((state) => {
    if (state.sessionActive === wasActive) {
      return;
    }
    wasActive = state.sessionActive;
    if (state.sessionActive) {
      void hydrateAvatar();
    }
  });
  if (wasActive) {
    void hydrateAvatar();
  }
}

/** Uploads/replaces the avatar (multipart field `file`). Never set a Content-Type header — rawRequest lets fetch derive it plus the boundary. */
export function uploadAvatar(file: File): Promise<UserImage> {
  const body = new FormData();
  body.append('file', file);
  return apiRequest<UserImage>('/images/avatar', { method: 'POST', body });
}

/** Fetches the avatar bytes; 404 when none is uploaded. */
export function getAvatar(): Promise<Blob> {
  return apiRequest<Blob>('/images/avatar', { responseType: 'blob' });
}

/** Deletes the avatar; 404 when none is uploaded. */
export function deleteAvatar(): Promise<MessageResponse> {
  return apiRequest<MessageResponse>('/images/avatar', { method: 'DELETE' });
}

/** Re-fetches and applies the avatar after an upload (POST returns metadata only). Silent on failure. */
export function refreshAvatar(): void {
  void getAvatar().then(
    (blob) => applyAvatarBlob(blob),
    () => undefined, // cosmetic feature — never surface hydration noise
  );
}

/** Drops the local avatar after a successful delete: revoke the object URL, clear the store. */
export function clearAvatar(): void {
  revokeManagedAvatarUrl();
  useAuthStore.getState().setAvatarUrl(null);
}

export function hydrateAvatar(): Promise<void> {
  return getAvatar().then(
    (blob) => applyAvatarBlob(blob),
    (error: unknown) => {
      // 404 is the server's definitive "no avatar": clear (this also retires
      // a legacy manually-seeded https: URL). Any other failure is transient —
      // keep whatever is displaying rather than flash initials.
      if (error instanceof ApiError && error.status === 404) {
        clearAvatar();
      }
    },
  );
}

function applyAvatarBlob(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const previous = managedAvatarUrl;
  managedAvatarUrl = url;
  useAuthStore.getState().setAvatarUrl(url); // publish before revoking the old URL — the <img> must never point at a revoked URL
  if (previous !== null && previous !== url) {
    URL.revokeObjectURL(previous);
  }
}

function revokeManagedAvatarUrl(): void {
  if (managedAvatarUrl !== null) {
    URL.revokeObjectURL(managedAvatarUrl);
    managedAvatarUrl = null;
  }
}
