import { useState, type ChangeEvent, type FormEvent } from 'react';
import { create, update } from 'service/currency.service';
import { getApiErrorMessage } from 'util/api-util';
import { GlobalMessages } from 'component/shared/global-constants';
import { useAutoHideScrollbar } from 'hooks/use-auto-hide-scrollbar';
import type { Currency } from 'model/currency.model';

// All modal chrome is global in src/scss/modal.scss.

export interface CurrencyFormProps {
  /** null means "create". */
  currency: Currency | null;
  onSaved: () => void;
  onClosed: () => void;
}

/**
 * Ported from Angular's CurrencyForm: create/edit modal for currencies. The
 * code is the path key, so it is uppercased on input and locked while editing.
 * Mounted fresh by the page on each open (state seeds from the prop once, the
 * Angular ngOnInit), so no re-seed effect is needed.
 */
export function CurrencyForm({ currency, onSaved, onClosed }: CurrencyFormProps) {
  const isEdit = currency !== null;

  const [code, setCode] = useState(currency?.code ?? '');
  const [name, setName] = useState(currency?.name ?? '');
  const [symbol, setSymbol] = useState(currency?.symbol ?? '');
  const [decimalPlaces, setDecimalPlaces] = useState<number | null>(currency?.decimalPlaces ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const isCodeValid = /^[a-zA-Z]{1,3}$/.test(code);
  const isNameValid = name.trim() !== '';
  const isSymbolValid = symbol.trim() !== '';
  const isDecimalPlacesValid = decimalPlaces !== null && decimalPlaces >= 0 && decimalPlaces <= 8;

  const canSubmit = isCodeValid && isNameValid && isSymbolValid && isDecimalPlacesValid;

  const containerRef = useAutoHideScrollbar<HTMLDivElement>();

  const close = (): void => {
    onClosed();
  };

  const onCodeChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setCode(event.target.value.toUpperCase());
  };

  const onDecimalPlacesChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const value = event.target.value;
    // ngModel on a number input yields number | null (null when empty).
    setDecimalPlaces(value === '' ? null : Number(value));
  };

  const submit = (event: FormEvent): void => {
    // Angular's ngSubmit implies preventDefault; without it the browser would
    // submit the form to the current URL and reload the SPA.
    event.preventDefault();
    if (!canSubmit || submitting || decimalPlaces === null) {
      return;
    }
    setSubmitting(true);
    setErrorMessage('');
    const body: Currency = {
      code: code.toUpperCase(),
      name: name.trim(),
      symbol: symbol.trim(),
      decimalPlaces,
    };
    const call = currency ? update(currency.code, body) : create(body);
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

      <div
        className="modal-container"
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? 'Edit currency' : 'Add currency'}
      >
        <div className="modal-header form-header">
          <h2 className="modal-title">{isEdit ? 'Edit' : 'Add'} Currency</h2>
          <button className="close-button" type="button" onClick={close} aria-label="Close">
            <span className="close-icon">&times;</span>
          </button>
        </div>

        <div className="modal-content form-content">
          <form className="modal-form" onSubmit={submit}>
            <div className="form-group">
              <label htmlFor="currency-code">Code</label>
              <input
                type="text"
                id="currency-code"
                name="code"
                value={code}
                onChange={onCodeChange}
                maxLength={3}
                required
                placeholder="e.g. USD, VND"
                disabled={isEdit}
                className={isCodeValid || !code ? '' : 'error'}
              />
              {!isCodeValid && code && <p className="error-message">Code must be 1–3 letters</p>}
              {isEdit && <p className="form-hint">The code identifies the currency and cannot change.</p>}
            </div>

            <div className="form-group">
              <label htmlFor="currency-name">Name</label>
              <input
                type="text"
                id="currency-name"
                name="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                placeholder="e.g. US Dollar"
                className={isNameValid || !name ? '' : 'error'}
              />
              {!isNameValid && name && <p className="error-message">Name is required</p>}
            </div>

            <div className="form-group">
              <label htmlFor="currency-symbol">Symbol</label>
              <input
                type="text"
                id="currency-symbol"
                name="symbol"
                value={symbol}
                onChange={(event) => setSymbol(event.target.value)}
                required
                placeholder="e.g. $, ₫"
                className={isSymbolValid || !symbol ? '' : 'error'}
              />
              {!isSymbolValid && symbol && <p className="error-message">Symbol is required</p>}
            </div>

            <div className="form-group">
              <label htmlFor="currency-decimals">Decimal Places</label>
              <input
                type="number"
                id="currency-decimals"
                name="decimalPlaces"
                value={decimalPlaces ?? ''}
                onChange={onDecimalPlacesChange}
                required
                min={0}
                max={8}
                placeholder="0–8"
                className={isDecimalPlacesValid || decimalPlaces === null ? '' : 'error'}
              />
              {!isDecimalPlacesValid && decimalPlaces !== null && (
                <p className="error-message">Decimal places must be between 0 and 8</p>
              )}
            </div>

            {errorMessage && <p className="error-message">{errorMessage}</p>}

            <button type="submit" className="submit-button" disabled={!canSubmit || submitting}>
              {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Currency'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
