import { useModalStore } from 'store/modal-store';
import { useAutoHideScrollbar } from 'hooks/use-auto-hide-scrollbar';

// Only .confirmation-message is component-scoped; the rest is global modal chrome.
import './confirmation.scss';

/**
 * Shared confirmation dialog rendered straight off modal-store.confirmation —
 * the request itself doubles as the visibility state. Cancel and backdrop
 * close without invoking; Confirm runs the callback then closes.
 */
export function Confirmation() {
  const request = useModalStore((state) => state.confirmation);
  const closeConfirmation = useModalStore((state) => state.closeConfirmation);

  const containerRef = useAutoHideScrollbar<HTMLDivElement>();

  if (!request) {
    return null;
  }

  const confirm = (): void => {
    closeConfirmation();
    request.onConfirm();
  };

  const close = (): void => {
    closeConfirmation();
  };

  return (
    <>
      <div className="modal-backdrop" onClick={close}></div>

      <div
        className="modal-container modal-container--sm"
        ref={containerRef}
        role="alertdialog"
        aria-modal="true"
        aria-label={request.title}
      >
        <div className="modal-header form-header">
          <h2 className="modal-title">{request.title}</h2>
          <button className="close-button" type="button" onClick={close} aria-label="Close">
            <span className="close-icon">&times;</span>
          </button>
        </div>

        <div className="modal-content form-content">
          <p className="confirmation-message">{request.message}</p>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={close}>
              {request.cancelLabel}
            </button>
            <button
              type="button"
              className={`submit-button${request.danger ? ' submit-button--danger' : ''}`}
              onClick={confirm}
            >
              {request.confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
