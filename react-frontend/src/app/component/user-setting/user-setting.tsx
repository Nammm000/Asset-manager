import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { getCurrentUser } from 'service/user.service';
import { clearAvatar, deleteAvatar, refreshAvatar, uploadAvatar } from 'service/user-image';
import { selectEmail, useAuthStore } from 'store/auth-store';
import { useModalStore } from 'store/modal-store';
import { useT } from 'store/language-store';
import { ApiError } from 'core/http';
import { getApiErrorMessage } from 'util/api-util';
import { customFormattedDate } from 'util/time-util';
import { GlobalMessages } from 'component/shared/global-constants';
import type { UserWrapper } from 'model/user.model';
import { usePageTitle } from 'hooks/use-page-title';

// Settings page card. Shared page chrome (.page, banners, badges) is global
// in src/scss/page.scss and src/scss/table.scss.
import './user-setting.scss';

/** Mirrors the backend's avatar validation (UserImageService.MAX_SIZE_BYTES + allowed types). */
const ALLOWED_AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

/**
 * Ported from Angular's UserSetting: account page for the signed-in user
 * (name, contact, role, account level/number) with avatar management:
 * upload/replace via the edit overlay on the avatar, remove via the shared
 * confirmation modal. The avatar itself is fetched/published by
 * service/user-image (initAvatarSync in main.tsx) — this page only triggers
 * uploads/deletes and lets the avatarUrl state re-render the header + this card.
 */
export function UserSetting() {
  usePageTitle('Settings | Asset Manager');

  const email = useAuthStore(selectEmail);
  const avatarUrl = useAuthStore((state) => state.avatarUrl);
  const openChangePasswordModal = useModalStore((state) => state.openChangePassword);
  const t = useT();

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [profile, setProfile] = useState<UserWrapper | null>(null);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);

  // Avatar management: one busy flag gates upload AND remove (no double-submit).
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const [avatarSuccess, setAvatarSuccess] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // A changed avatar URL (e.g. re-login as someone else) must retry the <img>.
  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [avatarUrl]);

  useEffect(() => {
    // Mount-only (Angular ngOnInit) — load() closes over just the setters and
    // the module-level service, so there is nothing stale to capture.
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Null-safe: profile can be null while loading, and email while logged out.
  const initials = (profile?.name ?? email ?? '?').charAt(0).toUpperCase();

  // Null when no URL is stored or the <img> errored -> initials fallback.
  const avatarSrc = avatarLoadFailed ? null : avatarUrl;

  // Server truth (avatarUrl), not avatarSrc — a mere <img> load error must
  // not hide the Remove button.
  const hasAvatar = avatarUrl !== null;

  const load = (): void => {
    setLoading(true);
    setErrorMessage('');
    getCurrentUser().then(
      (user) => {
        setProfile(user);
        setLoading(false);
      },
      (error: unknown) => {
        setErrorMessage(getApiErrorMessage(error, GlobalMessages.genericError));
        setLoading(false);
      },
    );
  };

  const onChangePasswordClick = (): void => {
    openChangePasswordModal();
  };

  const onAvatarError = (): void => {
    setAvatarLoadFailed(true);
  };

  const onAvatarFileSelected = (event: ChangeEvent<HTMLInputElement>): void => {
    const input = event.target;
    const file = input.files?.[0] ?? null;
    // Reset before anything else so picking the same file twice re-fires change.
    input.value = '';
    if (file === null) {
      return; // picker cancelled
    }
    setAvatarSuccess('');
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      setAvatarError(t('userSetting.avatarInvalidType'));
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError(t('userSetting.avatarTooLarge'));
      return;
    }
    setAvatarError('');
    setAvatarBusy(true);
    uploadAvatar(file).then(
      () => {
        setAvatarBusy(false);
        setAvatarSuccess(t('userSetting.avatarUpdated'));
        // POST returns metadata only — re-fetch the bytes to refresh the header + card.
        refreshAvatar();
      },
      (error: unknown) => {
        setAvatarBusy(false);
        setAvatarError(getApiErrorMessage(error, GlobalMessages.genericError));
      },
    );
  };

  const confirmRemoveAvatar = (): void => {
    useModalStore.getState().openConfirmation({
      title: t('userSetting.removeAvatar'),
      message: t('userSetting.avatarRemoveMessage'),
      confirmLabel: t('userSetting.removeAvatar'),
      danger: true,
      onConfirm: () => removeAvatar(),
    });
  };

  const removeAvatar = (): void => {
    setAvatarSuccess('');
    setAvatarBusy(true);
    deleteAvatar().then(
      () => onAvatarRemoved(),
      (error: unknown) => {
        // 404 = already gone (deleted in another tab): clearing is the
        // correct end state. Anything else keeps the avatar.
        if (error instanceof ApiError && error.status === 404) {
          onAvatarRemoved();
          return;
        }
        setAvatarBusy(false);
        setAvatarError(getApiErrorMessage(error, GlobalMessages.genericError));
      },
    );
  };

  const onAvatarRemoved = (): void => {
    setAvatarBusy(false);
    setAvatarError('');
    setAvatarSuccess(t('userSetting.avatarRemoved'));
    clearAvatar();
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">{t('common.settings')}</h1>
        <p className="page-subtitle">{t('userSetting.subtitle')}</p>
      </div>

      {loading ? (
        <p className="loading-text">Loading…</p>
      ) : errorMessage ? (
        <>
          <p className="error-banner">{errorMessage}</p>
          <div className="page-toolbar">
            <button type="button" className="settings-button" onClick={load}>
              Retry
            </button>
          </div>
        </>
      ) : profile ? (
        <section className="settings-card">
          <div className="settings-card__identity">
            <div className="settings-avatar-wrap">
              {avatarSrc ? (
                <img className="settings-avatar" src={avatarSrc} alt="Profile avatar" onError={onAvatarError} />
              ) : (
                <span className="settings-avatar settings-avatar--initials">{initials}</span>
              )}
              <button
                type="button"
                className="settings-avatar-edit"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarBusy}
                aria-label={t('userSetting.changeAvatar')}
                title={t('userSetting.changeAvatar')}
              >
                <i className="icon-18 edit" aria-hidden="true"></i>
              </button>
              <input
                ref={fileInputRef}
                className="settings-file-input"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={onAvatarFileSelected}
              />
            </div>
            <div className="settings-card__titles">
              <h2 className="settings-name">{profile.name}</h2>
              <p className="settings-email">{profile.email}</p>
            </div>
            <span
              className={`badge${profile.status === 'true' ? ' badge--active' : ' badge--inactive'}`}
            >
              {profile.status === 'true' ? t('common.active') : t('common.inactive')}
            </span>
          </div>

          {avatarError && <p className="error-banner">{avatarError}</p>}
          {avatarSuccess && <p className="success-banner">{avatarSuccess}</p>}

          <dl className="settings-fields">
            <div className="settings-field">
              <dt>{t('userSetting.phone')}</dt>
              <dd>{profile.phone || '—'}</dd>
            </div>
            <div className="settings-field">
              <dt>{t('userSetting.role')}</dt>
              <dd>{profile.role}</dd>
            </div>
            <div className="settings-field">
              <dt>{t('userSetting.accountNumber')}</dt>
              <dd>{profile.accountNumber || '—'}</dd>
            </div>
            <div className="settings-field">
              <dt>{t('userSetting.accountLevel')}</dt>
              <dd>{profile.accountLevel?.name || profile.accountLevel?.code || '—'}</dd>
            </div>
            <div className="settings-field">
              <dt>{t('userSetting.joined')}</dt>
              <dd>{customFormattedDate(profile.createdTime)}</dd>
            </div>
          </dl>

          <div className="settings-actions">
            {hasAvatar && (
              <button
                type="button"
                className="settings-button settings-button--danger"
                onClick={confirmRemoveAvatar}
                disabled={avatarBusy}
              >
                {t('userSetting.removeAvatar')}
              </button>
            )}
            <button type="button" className="settings-button" onClick={onChangePasswordClick} disabled={avatarBusy}>
              {t('common.changePassword')}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default UserSetting;
