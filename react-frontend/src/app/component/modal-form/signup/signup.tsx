import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { validateEmail, checkPasswordRequirements, validatePhone, validateName } from 'util/auth-util';
import { getApiErrorMessage } from 'util/api-util';
import { useModalStore } from 'store/modal-store';
import { useAuthStore } from 'store/auth-store';
import { useAutoHideScrollbar } from 'hooks/use-auto-hide-scrollbar';

// All modal chrome is global in src/scss/modal.scss.
import './signup.scss';

/**
 * Ported from Angular's Signup modal: five fields with value-derived
 * validation, the password policy checklist (unmet rows turn red), two
 * independent password toggles, and auto-login on success (the backend
 * returns a token pair).
 */
export function Signup() {
  const isVisible = useModalStore((state) => state.signupVisible);
  const closeSignup = useModalStore((state) => state.closeSignup);
  const signup = useAuthStore((state) => state.signup);
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [hidePassword, setHidePassword] = useState(true);
  const [hideConfirmPassword, setHideConfirmPassword] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const isEmailValid = validateEmail(email);
  const isNameValid = validateName(name);
  const isPhoneValid = validatePhone(phone);
  const passwordRequirements = checkPasswordRequirements(password);
  const isPasswordValid = passwordRequirements.allValid;
  const passwordsMatch = password === confirmPassword;

  const canSubmit =
    !!email &&
    !!name &&
    !!phone &&
    !!password &&
    !!confirmPassword &&
    isEmailValid &&
    isNameValid &&
    isPhoneValid &&
    isPasswordValid &&
    passwordsMatch;

  const containerRef = useAutoHideScrollbar<HTMLDivElement>();

  const close = (): void => {
    closeSignup();
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
    signup({ name, email, phone, password }).then(
      () => {
        // Signup auto-logs-in (the backend returns a token pair), so success is
        // equivalent to login success — same re-navigation for a possibly denied
        // initial route.
        navigate('/');
        close();
      },
      (error: unknown) => {
        setSubmitting(false);
        setErrorMessage(getApiErrorMessage(error, 'Sign up failed. Please try again.'));
      },
    );
  };

  const resetForm = (): void => {
    setEmail('');
    setName('');
    setPhone('');
    setPassword('');
    setConfirmPassword('');
    // Re-mask passwords so a reopened modal never shows them in plain text
    setHidePassword(true);
    setHideConfirmPassword(true);
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
          <h2 className="modal-title">Sign Up</h2>
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

            {/* Name */}
            <div className="form-group">
              <label htmlFor="name">Name</label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                name="name"
                required
                className={isNameValid || !name ? '' : 'error'}
                placeholder="Enter your name"
              />
              {!isNameValid && name && <p className="error-message">Please enter a valid name</p>}
            </div>

            {/* Phone */}
            <div className="form-group">
              <label htmlFor="phone">Phone</label>
              <input
                type="tel"
                id="phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                name="phone"
                required
                className={isPhoneValid || !phone ? '' : 'error'}
                placeholder="Enter your phone number"
              />
              {!isPhoneValid && phone && <p className="error-message">Please enter a valid phone number</p>}
            </div>

            {/* Password */}
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="password-field">
                <input
                  type={hidePassword ? 'password' : 'text'}
                  id="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  name="password"
                  required
                  className={isPasswordValid || !password ? '' : 'error'}
                  placeholder="Enter your password"
                />
                <button
                  className="password-toggle"
                  type="button"
                  onClick={() => setHidePassword((value) => !value)}
                  aria-label={hidePassword ? 'Show password' : 'Hide password'}
                >
                  {hidePassword ? <i className="icon-18 eye"></i> : <i className="icon-18 eye-slash"></i>}
                </button>
              </div>

              {isPasswordValid && password ? (
                <p className="success-message">Password meets all requirements</p>
              ) : password ? (
                <div className="password-requirements">
                  <p className={passwordRequirements.minLength ? '' : 'invalid'}>* At least 8 characters</p>
                  <p className={passwordRequirements.hasUpperCase ? '' : 'invalid'}>* At least 1 uppercase letter</p>
                  <p className={passwordRequirements.hasLowerCase ? '' : 'invalid'}>* At least 1 lowercase letter</p>
                  <p className={passwordRequirements.hasNumber ? '' : 'invalid'}>* At least 1 number</p>
                  <p className={passwordRequirements.hasSpecialChar ? '' : 'invalid'}>* At least 1 special character</p>
                </div>
              ) : null}
            </div>

            {/* Confirm Password */}
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <div className="password-field">
                <input
                  type={hideConfirmPassword ? 'password' : 'text'}
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  name="confirmPassword"
                  required
                  className={passwordsMatch || !confirmPassword ? '' : 'error'}
                  placeholder="Confirm your password"
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
              Sign Up
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
