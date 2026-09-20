import { useState, type ChangeEvent, type FormEvent } from 'react';
import { create, update } from 'service/land-asset.service';
import type { CreateLandAssetRequest, LandAsset } from 'model/asset.model';
import { useAutoHideScrollbar } from 'hooks/use-auto-hide-scrollbar';
import { getApiErrorMessage } from 'util/api-util';
import { GlobalMessages } from 'component/shared/global-constants';

// All modal chrome is global in src/scss/modal.scss.

export interface LandAssetFormProps {
  /** Row being edited; null means "create". */
  asset: LandAsset | null;
  onSaved: () => void;
  onClosed: () => void;
}

/**
 * Ported from Angular's LandAssetForm: create/edit modal for land assets.
 * Mounted fresh by the page on each open (the `showForm` conditional), so
 * fields are seeded once via useState — a null asset prop means "create".
 * Dates use date inputs and convert to ISO datetime on submit (the wire
 * format is ISO datetime).
 */
export function LandAssetForm({ asset, onSaved, onClosed }: LandAssetFormProps) {
  const isEdit = asset !== null;

  // Seeded once — the page remounts this component on every open.
  const [location, setLocation] = useState(asset?.location ?? '');
  const [area, setArea] = useState<number | null>(asset?.area ?? null);
  // ISO datetime -> yyyy-MM-dd for the date input
  const [purchaseDate, setPurchaseDate] = useState(asset?.purchaseDate?.slice(0, 10) ?? '');
  const [saleDate, setSaleDate] = useState(asset?.saleDate?.slice(0, 10) ?? '');

  const isLocationValid = location.trim() !== '';
  const isAreaValid = area !== null && area > 0;
  const isPurchaseDateValid = purchaseDate !== '';

  const canSubmit = isLocationValid && isAreaValid && isPurchaseDateValid;

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const containerRef = useAutoHideScrollbar<HTMLDivElement>();

  const close = (): void => {
    onClosed();
  };

  const onAreaChange = (event: ChangeEvent<HTMLInputElement>): void => {
    // Angular's ngModel yielded a number (null when the input is cleared).
    setArea(event.target.value === '' ? null : Number(event.target.value));
  };

  const submit = (event: FormEvent): void => {
    // Angular's (ngSubmit) prevented the browser default; React will not.
    event.preventDefault();
    if (!canSubmit || submitting) {
      return;
    }
    setSubmitting(true);
    setErrorMessage('');
    const body: CreateLandAssetRequest = {
      location: location.trim(),
      area: area!, // canSubmit guarantees non-null
      purchaseDate: new Date(purchaseDate).toISOString(),
      saleDate: saleDate ? new Date(saleDate).toISOString() : undefined,
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
        aria-label={isEdit ? 'Edit land asset' : 'Add land asset'}
      >
        <div className="modal-header form-header">
          <h2 className="modal-title">{isEdit ? 'Edit' : 'Add'} Land Asset</h2>
          <button className="close-button" type="button" onClick={close} aria-label="Close">
            <span className="close-icon">&times;</span>
          </button>
        </div>

        <div className="modal-content form-content">
          <form className="modal-form" onSubmit={submit}>
            <div className="form-group">
              <label htmlFor="land-location">Location</label>
              <input
                type="text"
                id="land-location"
                name="location"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                required
                placeholder="e.g. 12 Nguyen Hue, District 1"
                className={isLocationValid || !location ? '' : 'error'}
              />
              {!isLocationValid && location && <p className="error-message">Location is required</p>}
            </div>

            <div className="form-group">
              <label htmlFor="land-area">Area (m²)</label>
              <input
                type="number"
                id="land-area"
                name="area"
                value={area ?? ''}
                onChange={onAreaChange}
                required
                min="0"
                placeholder="Size in square meters"
                className={isAreaValid || area === null ? '' : 'error'}
              />
              {!isAreaValid && area !== null && <p className="error-message">Area must be greater than 0</p>}
            </div>

            <div className="form-group">
              <label htmlFor="land-purchase-date">Purchase Date</label>
              <input
                type="date"
                id="land-purchase-date"
                name="purchaseDate"
                value={purchaseDate}
                onChange={(event) => setPurchaseDate(event.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="land-sale-date">Sale Date</label>
              <input
                type="date"
                id="land-sale-date"
                name="saleDate"
                value={saleDate}
                onChange={(event) => setSaleDate(event.target.value)}
              />
              <p className="form-hint">Leave empty while you still own the land.</p>
            </div>

            {errorMessage && <p className="error-message">{errorMessage}</p>}

            <button type="submit" className="submit-button" disabled={!canSubmit || submitting}>
              {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Land Asset'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
