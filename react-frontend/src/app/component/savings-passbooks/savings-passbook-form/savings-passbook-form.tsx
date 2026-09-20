import { useState, type ChangeEvent, type FormEvent } from 'react';
import { create, update } from 'service/savings-passbook.service';
import type { CreateSavingsPassbookRequest, SavingsPassbook } from 'model/asset.model';
import { useAutoHideScrollbar } from 'hooks/use-auto-hide-scrollbar';
import { getApiErrorMessage } from 'util/api-util';
import { addDays, formatNumber, timeToDays, daysToTimeString } from 'util/time-util';
import { GlobalMessages, GlobalRegexes } from 'component/shared/global-constants';

// All modal chrome is global in src/scss/modal.scss.

export interface SavingsPassbookFormProps {
  /** Row being edited; null means "create". */
  passbook: SavingsPassbook | null;
  onSaved: () => void;
  onClosed: () => void;
}

/**
 * Ported from Angular's SavingsPassbookForm: create/edit modal for savings
 * passbooks. withdrawalDate is display-only — it is not part of the
 * create/update request types. Mounted fresh by the page on each open; a null
 * passbook prop means "create".
 *
 * The user types principal, deposit time ("1 year 2 months 3 days") and rate.
 * depositTerm (days, via timeToDays) and maturityDate are readonly and only
 * (re)computed by the OK button next to the deposit time input — counting from
 * createdAt when one is set, else from today's date. Any change to principal,
 * createdAt, interest rate or deposit time resets the computed fields
 * (resetComputedFields) until OK is clicked again.
 */
export function SavingsPassbookForm({ passbook, onSaved, onClosed }: SavingsPassbookFormProps) {
  const isEdit = passbook !== null;

  // Seeded once — the page remounts this component on every open.
  const [principalAmount, setPrincipalAmount] = useState<number | null>(passbook?.principalAmount ?? null);
  /** Formatted display value of principalAmount (formatNumber dot grouping) for the text input. */
  const [principalAmountText, setPrincipalAmountText] = useState(
    passbook?.principalAmount != null ? formatNumber(passbook.principalAmount) : '',
  );
  const [savingsPassbookName, setSavingsPassbookName] = useState('');
  const [depositTime, setDepositTime] = useState<string | null>(
    passbook?.depositTerm != null ? daysToTimeString(passbook.depositTerm) : null,
  );
  const [depositTerm, setDepositTerm] = useState<number | null>(passbook?.depositTerm ?? null);
  const [interestRate, setInterestRate] = useState<number | null>(passbook?.interestRate ?? null);
  const [maturityDate, setMaturityDate] = useState(passbook?.maturityDate?.slice(0, 10) ?? '');
  // const [createdAt, setCreatedAt] = useState(passbook?.createdAt?.slice(0, 10) ?? '');
  const [createdAt, setCreatedAt] = useState('');
  const [estimatedMaturityProceeds, setEstimatedMaturityProceeds] = useState<number | null>(
    passbook?.estimatedMaturityProceeds ?? null,
  );
  const [estimatedMaturityProceedsText, setEstimatedMaturityProceedsText] = useState(
    passbook?.estimatedMaturityProceeds != null ? formatNumber(passbook.estimatedMaturityProceeds) : '',
  );
  const [estimatedProfit, setEstimatedProfit] = useState<number | null>(
    passbook?.estimatedMaturityProceeds != null
      ? passbook.estimatedMaturityProceeds - passbook.principalAmount
      : null,
  );
  const [estimatedProfitText, setEstimatedProfitText] = useState(
    passbook?.estimatedMaturityProceeds != null
      ? formatNumber(passbook.estimatedMaturityProceeds - passbook.principalAmount)
      : '',
  );

  const isPrincipalValid = principalAmount !== null && principalAmount > 0;
  const isInterestRateValid = interestRate !== null && interestRate >= 0;
  const isDepositTermValid = depositTerm !== null && depositTerm >= 30;
  // Fresh copy without the `g` flag — the shared regex carries lastIndex state
  // that timeToDays' exec loop also mutates
  const isDepositTimeValid =
    depositTime !== null && new RegExp(GlobalRegexes.timeStringRegex.source, 'i').test(depositTime);

  const canSubmit =
    isPrincipalValid && isInterestRateValid && isDepositTermValid && maturityDate !== '';

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const containerRef = useAutoHideScrollbar<HTMLDivElement>();

  const close = (): void => {
    onClosed();
  };

  /**
   * Any change to the inputs the OK computation depends on (principal,
   * createdAt, interest rate, deposit time) makes the computed fields stale.
   */
  const resetComputedFields = (): void => {
    setDepositTerm(null);
    setEstimatedMaturityProceeds(null);
    setEstimatedMaturityProceedsText('');
    setMaturityDate('');
  };

  const onPrincipalAmountChange = (value: string): void => {
    resetComputedFields();
    const digits = value.replace(/\D/g, '');
    if (digits === '') {
      setPrincipalAmountText('');
      setPrincipalAmount(null);
      return;
    }
    const amount = Number(digits);
    setPrincipalAmount(amount);
    setPrincipalAmountText(formatNumber(amount));
  };

  const onDepositTimeChange = (value: string): void => {
    setDepositTime(value);
    resetComputedFields();
  };

  const onCreatedAtChange = (value: string): void => {
    setCreatedAt(value);
    resetComputedFields();
  };

  const onInterestRateChange = (event: ChangeEvent<HTMLInputElement>): void => {
    // Angular's ngModel yielded a number (null when the input is cleared);
    // verbatim from Angular: a falsy value (0 included) clears to null.
    const value = event.target.value === '' ? null : Number(event.target.value);
    setInterestRate(value ? Number(value) : null);
    resetComputedFields();
  };

  /** principal × daily rate × term, added back to the principal. */
  const calculateMaturityAmount = (principal: number, termDays: number, rate: number): number => {
    const interest = principal * (rate / 36500) * termDays;
    return principal + interest;
  };

  const onCalculateClick = (): void => {
    if (!isDepositTimeValid || !principalAmount || !interestRate) {
      return;
    }
    const days = timeToDays(depositTime!);
    setDepositTerm(days);
    const proceeds = calculateMaturityAmount(principalAmount, days, interestRate);
    setEstimatedMaturityProceeds(proceeds);
    setEstimatedMaturityProceedsText(formatNumber(proceeds));
    const profit = proceeds - principalAmount;
    setEstimatedProfit(profit);
    setEstimatedProfitText(formatNumber(profit));
    // createdAt (yyyy-MM-dd from the date input) is the base when set, else today;
    // appending 'T00:00:00' pins the parsed date to local midnight in any timezone
    const base = createdAt ? new Date(`${createdAt}T00:00:00`) : new Date();
    setMaturityDate(days > 0 ? addDays(base, days) : '');
  };

  const submit = (event: FormEvent): void => {
    // Angular's (ngSubmit) prevented the browser default; React will not.
    event.preventDefault();
    if (!canSubmit || submitting) {
      return;
    }
    setSubmitting(true);
    setErrorMessage('');
    const body: CreateSavingsPassbookRequest = {
      savingsPassbookName: savingsPassbookName || undefined,
      principalAmount: principalAmount!, // canSubmit guarantees non-null
      depositTerm: depositTerm!, // canSubmit guarantees non-null
      interestRate: interestRate!, // canSubmit guarantees non-null
      // Optional field — omit rather than send null
      createdAt: createdAt ? new Date(createdAt).toISOString() : undefined,
      maturityDate: new Date(maturityDate).toISOString(),
      // Optional field — omit rather than send null
      estimatedMaturityProceeds: estimatedMaturityProceeds ?? undefined,
    };
    const call = passbook ? update(passbook.id, body) : create(body);
    call.then(
      () => onSaved(),
      (error: unknown) => {
        setSubmitting(false);
        setErrorMessage(getApiErrorMessage(error, GlobalMessages.genericError));
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
        aria-label={isEdit ? 'Edit savings passbook' : 'Add savings passbook'}
      >
        <div className="modal-header form-header">
          <h2 className="modal-title">{isEdit ? 'Edit' : 'Add'} Savings Passbook</h2>
          <button className="close-button" type="button" onClick={close} aria-label="Close">
            <span className="close-icon">&times;</span>
          </button>
        </div>

        <div className="modal-content form-content">
          <form className="modal-form" onSubmit={submit}>
            <div className="form-group">
              <label htmlFor="name">Name</label>
              <input
                type="text"
                id="name"
                name="savingsPassbookName"
                value={savingsPassbookName}
                onChange={(event) => setSavingsPassbookName(event.target.value)}
                placeholder="Passbook name"
              />
            </div>

            <div className="form-group">
              <label htmlFor="passbook-principal">Principal Amount</label>
              <input
                type="text"
                inputMode="numeric"
                id="passbook-principal"
                name="principalAmount"
                value={principalAmountText}
                onChange={(event) => onPrincipalAmountChange(event.target.value)}
                required
                placeholder="Initial deposit"
                className={isPrincipalValid || principalAmount === null ? '' : 'error'}
              />
              {!isPrincipalValid && principalAmount !== null && (
                <p className="error-message">Principal amount must be greater than 0</p>
              )}
            </div>

            {!isEdit && (
              <div className="form-group">
                <label htmlFor="passbook-created-at">Created At</label>
                <input
                  type="date"
                  id="passbook-created-at"
                  name="createdAt"
                  value={createdAt}
                  onChange={(event) => onCreatedAtChange(event.target.value)}
                />
                <p className="form-hint">Optional — maturity date counts from this date instead of today</p>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="passbook-rate">Interest Rate (%)</label>
              <input
                type="number"
                id="passbook-rate"
                name="interestRate"
                value={interestRate ?? ''}
                onChange={onInterestRateChange}
                required
                min="0"
                step="0.01"
                placeholder="Annual rate, e.g. 5.5"
                className={isInterestRateValid || interestRate === null ? '' : 'error'}
              />
              {!isInterestRateValid && interestRate !== null && (
                <p className="error-message">Interest rate must be 0 or more</p>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="passbook-deposit-time">Deposit Time (years, months, days)</label>
              <div className="input-action-row">
                <input
                  type="text"
                  id="passbook-deposit-time"
                  name="depositTime"
                  value={depositTime ?? ''}
                  onChange={(event) => onDepositTimeChange(event.target.value)}
                  required
                  placeholder="e.g., 1 year 2 months 3 days"
                  className={isDepositTimeValid || depositTime === null ? '' : 'error'}
                />
                <button
                  type="button"
                  className="ok-button"
                  onClick={onCalculateClick}
                  disabled={!isDepositTimeValid}
                >
                  OK
                </button>
              </div>
              <p className="remind-message">* Deposit Term and Maturity Date are calculated only after you click OK.</p>
              <p className="remind-message">* Check the Deposit Time and Deposit Term before save.</p>
              {!isDepositTimeValid && depositTime !== null && (
                <p className="error-message">Enter a valid time, e.g., 1 year 2 months 3 days</p>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="passbook-deposit-term">Deposit Term (days)</label>
              <input
                type="number"
                id="passbook-deposit-term"
                name="depositTerm"
                value={depositTerm ?? ''}
                onChange={(event) => setDepositTerm(event.target.value === '' ? null : Number(event.target.value))}
                required
                readOnly
                min="30"
                placeholder="Deposit term in days"
                className={isDepositTermValid || depositTerm === null ? '' : 'error'}
              />
              {!isDepositTermValid && depositTerm !== null && (
                <p className="error-message">Deposit term must be at least 30 days</p>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="passbook-maturity">Maturity Date</label>
              <input
                type="date"
                id="passbook-maturity"
                name="maturityDate"
                value={maturityDate}
                onChange={(event) => setMaturityDate(event.target.value)}
                required
                readOnly
              />
            </div>

            <div className="form-group">
              <label htmlFor="passbook-profit">Estimated Profit</label>
              <input
                type="text"
                inputMode="numeric"
                id="passbook-profit"
                name="estimatedProfit"
                value={estimatedProfitText}
                onChange={(event) => setEstimatedProfitText(event.target.value)}
                required
                readOnly
                min="0"
                placeholder="Estimated Profit"
              />
            </div>

            <div className="form-group">
              <label htmlFor="passbook-proceeds">Estimated Maturity Proceeds</label>
              <input
                type="text"
                inputMode="numeric"
                id="passbook-proceeds"
                name="estimatedMaturityProceeds"
                value={estimatedMaturityProceedsText}
                onChange={(event) => setEstimatedMaturityProceedsText(event.target.value)}
                required
                readOnly
                min="0"
                placeholder="Estimated Maturity Proceeds"
              />
            </div>

            {errorMessage && <p className="error-message">{errorMessage}</p>}

            <button type="submit" className="submit-button" disabled={!canSubmit || submitting}>
              {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Passbook'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
