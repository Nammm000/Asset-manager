import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { validateEmail } from 'util/auth-util';
import { getApiErrorMessage } from 'util/api-util';
import { useModalStore } from 'store/modal-store';
import { useAuthStore } from 'store/auth-store';
import { useAutoHideScrollbar } from 'hooks/use-auto-hide-scrollbar';

// All modal chrome is global in src/scss/modal.scss.
import './login.scss';

/**
 * Ported from Angular's Login modal: permanently mounted, renders when
 * modal-store flips loginVisible (header → store → modal, never
 * component-to-component). Validation is value-derived (no touched/pristine):
 * the error class and message show only when a field is non-empty AND invalid.
 */
export function Login() {
  const isVisible = useModalStore((state) => state.loginVisible);
  const closeLogin = useModalStore((state) => state.closeLogin);
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [hide, setHide] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const isEmailValid = validateEmail(email);
  const canSubmit = !!email && !!password && isEmailValid;

  const containerRef = useAutoHideScrollbar<HTMLDivElement>();

  const close = (): void => {
    closeLogin();
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
    login({ email, password }).then(
      () => {
        // A guard denial may have left the router with no active route —
        // re-navigate so the dashboard actually renders after login.
        navigate('/');
        close();
      },
      (error: unknown) => {
        setSubmitting(false);
        setErrorMessage(getApiErrorMessage(error, 'Login failed. Please try again.'));
      },
    );
  };

  // Helper methods
  const resetForm = (): void => {
    setEmail('');
    setPassword('');
    // Re-mask the password so a reopened modal never shows it in plain text
    setHide(true);
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
          <h2 className="modal-title">Login</h2>
          <button className="close-button" onClick={close}>
            <span className="close-icon">&times;</span>
          </button>
        </div>

        <div className="modal-content form-content">
          {/* Body - Form */}
          <form className="modal-form" onSubmit={submit}>
            {/* Email */}
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                name="email"
                required
                className={isEmailValid || !email ? '' : 'error'}
                placeholder="Enter your email"
              />
              {!isEmailValid && email && <p className="error-message">Please enter a valid email address</p>}
            </div>

            {/* Password */}
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="password-field">
                <input
                  type={hide ? 'password' : 'text'}
                  id="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  name="password"
                  required
                  placeholder="Enter your password"
                />
                <button
                  className="password-toggle"
                  type="button"
                  onClick={() => setHide((value) => !value)}
                  aria-label={hide ? 'Show password' : 'Hide password'}
                >
                  {hide ? <i className="icon-18 eye"></i> : <i className="icon-18 eye-slash"></i>}
                </button>
              </div>
            </div>

            {/* API Error */}
            {errorMessage && <p className="error-message">{errorMessage}</p>}

            {/* Submit Button */}
            <button type="submit" className="submit-button" disabled={!canSubmit || submitting}>
              Login
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
