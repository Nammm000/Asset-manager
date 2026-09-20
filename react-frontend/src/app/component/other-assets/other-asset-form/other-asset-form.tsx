import { useState, type ChangeEvent, type FormEvent } from 'react';
import { create, update } from 'service/other-asset.service';
import type { CreateOtherAssetRequest, OtherAsset } from 'model/asset.model';
import { useAutoHideScrollbar } from 'hooks/use-auto-hide-scrollbar';
import { getApiErrorMessage } from 'util/api-util';
import { GlobalMessages } from 'component/shared/global-constants';

// All modal chrome is global in src/scss/modal.scss.

export interface OtherAssetFormProps {
  /** Row being edited; null means "create". */
  asset: OtherAsset | null;
  onSaved: () => void;
  onClosed: () => void;
}

/**
 * Ported from Angular's OtherAssetForm: create/edit modal for other assets.
 * Mounted fresh by the page on each open (the `showForm` conditional), so
 * fields are seeded once via useState — a null asset prop means "create".
 */
export function OtherAssetForm({ asset, onSaved, onClosed }: OtherAssetFormProps) {
  const isEdit = asset !== null;

  // Seeded once — the page remounts this component on every open.
  const [name, setName] = useState(asset?.name ?? '');
  const [amount, setAmount] = useState<number | null>(asset?.amount ?? null);
  const [pricePerUnit, setPricePerUnit] = useState<number | null>(asset?.pricePerUnit ?? null);

  const isNameValid = name.trim() !== '';
  const isAmountValid = amount !== null && amount >= 0;
  const isPriceValid = pricePerUnit !== null && pricePerUnit > 0;

  const canSubmit = isNameValid && isAmountValid && isPriceValid;

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const containerRef = useAutoHideScrollbar<HTMLDivElement>();

  const close = (): void => {
    onClosed();
  };

  // Angular's ngModel yielded numbers (null when an input is cleared).
  const onAmountChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setAmount(event.target.value === '' ? null : Number(event.target.value));
  };

  const onPriceChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setPricePerUnit(event.target.value === '' ? null : Number(event.target.value));
  };

  const submit = (event: FormEvent): void => {
    // Angular's (ngSubmit) prevented the browser default; React will not.
    event.preventDefault();
    if (!canSubmit || submitting) {
      return;
    }
    setSubmitting(true);
    setErrorMessage('');
    const body: CreateOtherAssetRequest = {
      name: name.trim(),
      amount: amount!, // canSubmit guarantees non-null
      pricePerUnit: pricePerUnit!, // canSubmit guarantees non-null
    };
    const call = asset ? update(asset.id, body) : create(body);
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
        aria-label={isEdit ? 'Edit other asset' : 'Add other asset'}
      >
        <div className="modal-header form-header">
          <h2 className="modal-title">{isEdit ? 'Edit' : 'Add'} Other Asset</h2>
          <button className="close-button" type="button" onClick={close} aria-label="Close">
            <span className="close-icon">&times;</span>
          </button>
        </div>

        <div className="modal-content form-content">
          <form className="modal-form" onSubmit={submit}>
            <div className="form-group">
              <label htmlFor="other-asset-name">Name</label>
              <input
                type="text"
                id="other-asset-name"
                name="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                placeholder="e.g. Gold, Vehicle, Paintings"
                className={isNameValid || !name ? '' : 'error'}
              />
              {!isNameValid && name && <p className="error-message">Name is required</p>}
            </div>

            <div className="form-group">
              <label htmlFor="other-asset-amount">Amount</label>
              <input
                type="number"
                id="other-asset-amount"
                name="amount"
                value={amount ?? ''}
                onChange={onAmountChange}
                required
                min="0"
                placeholder="How many units you own"
                className={isAmountValid || amount === null ? '' : 'error'}
              />
              {!isAmountValid && amount !== null && <p className="error-message">Amount must be 0 or more</p>}
            </div>

            <div className="form-group">
              <label htmlFor="other-asset-price">Price per Unit</label>
              <input
                type="number"
                id="other-asset-price"
                name="pricePerUnit"
                value={pricePerUnit ?? ''}
                onChange={onPriceChange}
                required
                min="0"
                placeholder="Value of one unit"
                className={isPriceValid || pricePerUnit === null ? '' : 'error'}
              />
              {!isPriceValid && pricePerUnit !== null && (
                <p className="error-message">Price per unit must be greater than 0</p>
              )}
            </div>

            {errorMessage && <p className="error-message">{errorMessage}</p>}

            <button type="submit" className="submit-button" disabled={!canSubmit || submitting}>
              {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Asset'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
