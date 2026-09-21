import { useState, type ChangeEvent, type FormEvent } from 'react';
import { deposit } from 'service/additional-deposit.service';
import { getCurrentUser } from 'service/user.service';
import { selectEmail, useAuthStore } from 'store/auth-store';
import { validateEmail, validatePhone } from 'util/auth-util';
import { getApiErrorMessage } from 'util/api-util';
import { formatNumber } from 'util/time-util';
import { useAutoHideScrollbar } from 'hooks/use-auto-hide-scrollbar';
import { useMountOnce } from 'hooks/use-mount-once';

// All modal chrome is global in src/scss/modal.scss.

export interface AdditionalDepositFormProps {
  /** Passbook number of the row the modal was opened from; null = toolbar open. */
  passbookNumber: string | null;
  onDeposited: () => void;
  onClosed: () => void;
}

/**
 * Ported from Angular's AdditionalDepositForm: additional-deposit modal. The
 * backend identifies the depositor by the account's own records — email OR
 * phone must match the account. Email and account number are prefilled from
 * the current session; the passbook number is prefilled from the row when
 * opened via a table button (null prop means the toolbar open, where it must
 * be typed from the physical passbook). On success the response carries the
 * passbook number and updated principal.
 */
export function AdditionalDepositForm({ passbookNumber, onDeposited, onClosed }: AdditionalDepositFormProps) {
  // Prefilled once from the current session (Angular's ngOnInit seeding).
  const sessionEmail = useAuthStore(selectEmail) ?? '';

  const [email, setEmail] = useState(sessionEmail);
  const [phone, setPhone] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [savingsPassbookNumber, setSavingsPassbookNumber] = useState(passbookNumber ?? '');
  const [amount, setAmount] = useState<number | null>(null);

  const isEmailValid = email === '' || validateEmail(email);
  const isPhoneValid = phone === '' || validatePhone(phone);
  const isAmountValid = amount !== null && amount > 0;
  const hasContact = email !== '' || phone !== '';

  const canSubmit =
    hasContact &&
    isEmailValid &&
    isPhoneValid &&
    accountNumber.trim() !== '' &&
    savingsPassbookNumber.trim() !== '' &&
    isAmountValid;

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Set after a successful deposit — the panel replaces the form
  const [successMessage, setSuccessMessage] = useState('');

  const containerRef = useAutoHideScrollbar<HTMLDivElement>();

  useMountOnce(() => {
    getCurrentUser().then(
      (user) => setAccountNumber(user.accountNumber ?? ''),
      // Prefill only — on failure leave the field blank and editable.
      () => {},
    );
  });

  const close = (): void => {
    if (successMessage) {
      onDeposited(); // the passbook list needs a reload
    }
    onClosed();
  };

  const onAmountChange = (event: ChangeEvent<HTMLInputElement>): void => {
    // Angular's ngModel yielded a number (null when the input is cleared).
    setAmount(event.target.value === '' ? null : Number(event.target.value));
  };

  const submit = (event: FormEvent): void => {
    // Angular's (ngSubmit) prevented the browser default; React will not.
    event.preventDefault();
    if (!canSubmit || submitting) {
      return;
    }
    setSubmitting(true);
    setErrorMessage('');
    deposit({
      email: email.trim(),
      phone: phone.trim(),
      accountNumber: accountNumber.trim(),
      savingsPassbookNumber: savingsPassbookNumber.trim(),
      amount: amount!, // canSubmit guarantees non-null
    }).then(
      (passbook) => {
        setSubmitting(false);
        setSuccessMessage(
          `Deposited successfully. Passbook ${passbook.savingsPassbookNumber ?? ''} now holds ` +
            `${formatNumber(passbook.principalAmount)}.`,
        );
      },
      (error: unknown) => {
        setSubmitting(false);
        setErrorMessage(getApiErrorMessage(error, 'Deposit failed. Please check the details and try again.'));
      },
    );
  };

  return (
    <>
      {/* Backdrop */}
      <div className="modal-backdrop" onClick={close}></div>

      {/* Modal Content */}
      <div
        className="modal-container"
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Additional deposit"
      >
        <div className="modal-header form-header">
          <h2 className="modal-title">Additional Deposit</h2>
          <button className="close-button" type="button" onClick={close} aria-label="Close">
            <span className="close-icon">&times;</span>
          </button>
        </div>

        <div className="modal-content form-content">
          {successMessage ? (
            <div className="modal-form">
              <p className="success-message">{successMessage}</p>
              <button type="button" className="submit-button" onClick={close}>
                Done
              </button>
            </div>
          ) : (
            <form className="modal-form" onSubmit={submit}>
              <p className="form-hint">
                Your email or phone must match the account's records, and both numbers come from your bank documents —
                they are not shown in this app.
              </p>

              <div className="form-group">
                <label htmlFor="deposit-email">Email</label>
                <input
                  type="email"
                  id="deposit-email"
                  name="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Account holder email"
                  className={isEmailValid || !email ? '' : 'error'}
                />
                {!isEmailValid && email && <p className="error-message">Please enter a valid email address</p>}
              </div>

              {/* <div className="form-group">
                <label htmlFor="deposit-phone">Phone</label>
                <input
                  type="tel"
                  id="deposit-phone"
                  name="phone"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="10-digit account holder phone"
                  className={isPhoneValid || !phone ? '' : 'error'}
                />
                {!isPhoneValid && phone && <p className="error-message">Phone must be exactly 10 digits</p>}
                {!hasContact && <p className="form-hint">Fill in email or phone (at least one).</p>}
              </div> */}

              <div className="form-group">
                <label htmlFor="deposit-account-number">Account Number</label>
                <input
                  type="text"
                  id="deposit-account-number"
                  name="accountNumber"
                  value={accountNumber}
                  onChange={(event) => setAccountNumber(event.target.value)}
                  required
                  placeholder="Your bank account number"
                />
              </div>

              <div className="form-group">
                <label htmlFor="deposit-passbook-number">Savings Passbook Number</label>
                <input
                  type="text"
                  id="deposit-passbook-number"
                  name="savingsPassbookNumber"
                  value={savingsPassbookNumber}
                  onChange={(event) => setSavingsPassbookNumber(event.target.value)}
                  required
                  placeholder="Printed on your passbook"
                />
              </div>

              <div className="form-group">
                <label htmlFor="deposit-amount">Amount</label>
                <input
                  type="number"
                  id="deposit-amount"
                  name="amount"
                  value={amount ?? ''}
                  onChange={onAmountChange}
                  required
                  min="0"
                  placeholder="Amount to add"
                  className={isAmountValid || amount === null ? '' : 'error'}
                />
                {!isAmountValid && amount !== null && <p className="error-message">Amount must be greater than 0</p>}
              </div>

              {errorMessage && <p className="error-message">{errorMessage}</p>}

              <button type="submit" className="submit-button" disabled={!canSubmit || submitting}>
                {submitting ? 'Depositing…' : 'Deposit'}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
