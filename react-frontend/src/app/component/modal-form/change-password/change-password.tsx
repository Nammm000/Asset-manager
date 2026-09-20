import { useState, type FormEvent } from 'react';
import { checkPasswordRequirements } from 'util/auth-util';
import { getApiErrorMessage } from 'util/api-util';
import { useModalStore } from 'store/modal-store';
import { useAuthStore } from 'store/auth-store';
import { useAutoHideScrollbar } from 'hooks/use-auto-hide-scrollbar';

// All modal chrome is global in src/scss/modal.scss.
import './change-password.scss';

/**
 * Ported from Angular's ChangePassword modal: three password fields with
 * toggles (note: unlike login/signup, resetForm does NOT re-mask them), the
 * policy checklist on the new password, and confirm never sent to the backend.
 */
export function ChangePassword() {
  const isVisible = useModalStore((state) => state.changePasswordVisible);
  const closeChangePassword = useModalStore((state) => state.closeChangePassword);
  const changePassword = useAuthStore((state) => state.changePassword);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [hideOldPassword, setHideOldPassword] = useState(true);
  const [hideNewPassword, setHideNewPassword] = useState(true);
  const [hideConfirmPassword, setHideConfirmPassword] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const passwordRequirements = checkPasswordRequirements(newPassword);
  const isPasswordValid = passwordRequirements.allValid;
  const passwordsMatch = newPassword === confirmPassword;

  const canSubmit = !!oldPassword && !!newPassword && !!confirmPassword && isPasswordValid && passwordsMatch;

  const containerRef = useAutoHideScrollbar<HTMLDivElement>();

  const close = (): void => {
    closeChangePassword();
    resetForm();
  };

  const submit = (event: FormEvent): void => {
    // Angular's ngSubmit prevented the browser default natively; React does not.
    event.preventDefault();
    if (!canSubmit || submitting) {
      return;
    }
    setSubmitting(true);
    setErrorMessage('');
    // confirmPassword is a client-side check only — never sent to the backend.
    changePassword({ oldPassword, newPassword }).then(
      () => close(),
      (error: unknown) => {
        setSubmitting(false);
        setErrorMessage(getApiErrorMessage(error, 'Password change failed. Please try again.'));
      },
    );
  };

  const resetForm = (): void => {
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setSubmitting(false);
    setErrorMessage('');
  };

  if (!isVisible) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <div className="modal-backdrop" onClick={close}></div>

      {/* Modal Content */}
      <div className="modal-container" ref={containerRef}>
        {/* Header */}
        <div className="modal-header form-header">
          <h2 className="modal-title">Change Password</h2>
          <button className="close-button" onClick={close}>
            <span className="close-icon">&times;</span>
          </button>
        </div>

        <div className="modal-content form-content">
          {/* Body - Form */}
          <form className="modal-form" onSubmit={submit}>
            {/* Old Password */}
            <div className="form-group">
              <label htmlFor="oldPassword">Old Password</label>
              <div className="password-field">
                <input
                  type={hideOldPassword ? 'password' : 'text'}
                  id="oldPassword"
                  value={oldPassword}
                  onChange={(event) => setOldPassword(event.target.value)}
                  name="oldPassword"
                  required
                  placeholder="Enter your current password"
                />
                <button
                  className="password-toggle"
                  type="button"
                  onClick={() => setHideOldPassword((value) => !value)}
                  aria-label={hideOldPassword ? 'Show password' : 'Hide password'}
                >
                  {hideOldPassword ? <i className="icon-18 eye"></i> : <i className="icon-18 eye-slash"></i>}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="form-group">
              <label htmlFor="newPassword">New Password</label>
              <div className="password-field">
                <input
                  type={hideNewPassword ? 'password' : 'text'}
                  id="newPassword"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  name="newPassword"
                  required
                  className={isPasswordValid || !newPassword ? '' : 'error'}
                  placeholder="Enter your new password"
                />
                <button
                  className="password-toggle"
                  type="button"
                  onClick={() => setHideNewPassword((value) => !value)}
                  aria-label={hideNewPassword ? 'Show password' : 'Hide password'}
                >
                  {hideNewPassword ? <i className="icon-18 eye"></i> : <i className="icon-18 eye-slash"></i>}
                </button>
              </div>
              {isPasswordValid && newPassword ? (
                <p className="success-message">Password meets all requirements</p>
              ) : newPassword ? (
                <div className="password-requirements">
                  <p className={passwordRequirements.minLength ? '' : 'invalid'}>* At least 8 characters</p>
                  <p className={passwordRequirements.hasUpperCase ? '' : 'invalid'}>* At least 1 uppercase letter</p>
                  <p className={passwordRequirements.hasLowerCase ? '' : 'invalid'}>* At least 1 lowercase letter</p>
                  <p className={passwordRequirements.hasNumber ? '' : 'invalid'}>* At least 1 number</p>
                  <p className={passwordRequirements.hasSpecialChar ? '' : 'invalid'}>* At least 1 special character</p>
                </div>
              ) : null}
            </div>

            {/* Confirm New Password */}
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm New Password</label>
              <div className="password-field">
                <input
                  type={hideConfirmPassword ? 'password' : 'text'}
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  name="confirmPassword"
                  required
                  className={passwordsMatch || !confirmPassword ? '' : 'error'}
                  placeholder="Confirm your new password"
                />
                <button
                  className="password-toggle"
                  type="button"
                  onClick={() => setHideConfirmPassword((value) => !value)}
                  aria-label={hideConfirmPassword ? 'Show password' : 'Hide password'}
                >
                  {hideConfirmPassword ? <i className="icon-18 eye"></i> : <i className="icon-18 eye-slash"></i>}
                </button>
              </div>

              {!passwordsMatch && confirmPassword && <p className="error-message">Password must match the input password</p>}
            </div>

            {/* API Error */}
            {errorMessage && <p className="error-message">{errorMessage}</p>}

            {/* Submit Button */}
            <button type="submit" className="submit-button" disabled={!canSubmit || submitting}>
              Change Password
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
