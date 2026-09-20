import { useState, type FormEvent } from 'react';
import { create } from 'service/cash-asset.service';
import { getApiErrorMessage } from 'util/api-util';
import { GlobalMessages } from 'component/shared/global-constants';
import { useAutoHideScrollbar } from 'hooks/use-auto-hide-scrollbar';

/**
 * Create modal for cash wallets — there is no update on the backend (ported
 * from Angular's CashAssetForm; Angular declares no component scss, so none
 * here). Note the backend never returns name/description, so the list shows
 * "Cash Wallet #id".
 */
export interface CashAssetFormProps {
  onSaved: () => void;
  onClosed: () => void;
}

export function CashAssetForm({ onSaved, onClosed }: CashAssetFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const isNameValid = name.trim() !== '';
  const canSubmit = isNameValid;

  const containerRef = useAutoHideScrollbar<HTMLDivElement>();

  const close = (): void => {
    onClosed();
  };

  const submit = (event: FormEvent): void => {
    // Angular's ngSubmit prevented the browser default natively; React does not.
    event.preventDefault();
    if (!canSubmit || submitting) {
      return;
    }
    setSubmitting(true);
    setErrorMessage('');
    const body = {
      name: name.trim(),
      description: description.trim() || undefined,
    };
    create(body).then(
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
      <div className="modal-container" ref={containerRef} role="dialog" aria-modal="true" aria-label="Add cash wallet">
        <div className="modal-header form-header">
          <h2 className="modal-title">Add Cash Wallet</h2>
          <button className="close-button" type="button" onClick={close} aria-label="Close">
            <span className="close-icon">&times;</span>
          </button>
        </div>

        <div className="modal-content form-content">
          <form className="modal-form" onSubmit={submit}>
            <div className="form-group">
              <label htmlFor="cash-wallet-name">Name</label>
              <input
                type="text"
                id="cash-wallet-name"
                name="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                placeholder="e.g. Home Safe, Bank Card"
                className={isNameValid || !name ? '' : 'error'}
              />
              {!isNameValid && name && <p className="error-message">Name is required</p>}
              <p className="form-hint">Shown only at creation — lists display "Cash Wallet #id".</p>
            </div>

            <div className="form-group">
              <label htmlFor="cash-wallet-description">Description</label>
              <input
                type="text"
                id="cash-wallet-description"
                name="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Optional"
              />
            </div>

            {errorMessage && <p className="error-message">{errorMessage}</p>}

            <button type="submit" className="submit-button" disabled={!canSubmit || submitting}>
              {submitting ? 'Saving…' : 'Add Cash Wallet'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
