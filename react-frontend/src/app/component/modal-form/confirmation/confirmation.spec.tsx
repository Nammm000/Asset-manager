import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import type { Confirmation } from 'component/modal-form/confirmation/confirmation';
import type { useModalStore as ModalStore } from 'store/modal-store';

let ConfirmationModal: typeof Confirmation;
let modalStore: typeof ModalStore;

beforeEach(async () => {
  localStorage.clear();
  vi.resetModules();
  ({ Confirmation: ConfirmationModal } = await import('component/modal-form/confirmation/confirmation'));
  ({ useModalStore: modalStore } = await import('store/modal-store'));
});

afterEach(() => {
  localStorage.clear();
});

function renderModal(): void {
  render(<ConfirmationModal />);
}

describe('Confirmation modal', () => {
  it('renders nothing without a pending request', () => {
    renderModal();
    expect(document.querySelector('.modal-container')).toBeNull();
  });

  it('renders the request (which doubles as visibility) with default labels', () => {
    modalStore.getState().openConfirmation({ title: 'Delete item?', message: 'This cannot be undone.', onConfirm: vi.fn() });
    renderModal();

    expect(screen.getByRole('alertdialog', { name: 'Delete item?' })).toBeInTheDocument();
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('cancel, backdrop and × close without invoking the callback', async () => {
    const onConfirm = vi.fn();
    modalStore.getState().openConfirmation({ title: 'T', message: 'M', onConfirm });
    renderModal();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(modalStore.getState().confirmation).toBeNull();
  });

  it('confirm runs the callback then clears the request', async () => {
    const onConfirm = vi.fn();
    modalStore.getState().openConfirmation({ title: 'T', message: 'M', confirmLabel: 'Delete', danger: true, onConfirm });
    renderModal();

    const confirmButton = screen.getByRole('button', { name: 'Delete' });
    expect(confirmButton.className).toContain('submit-button--danger');
    await userEvent.click(confirmButton);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(modalStore.getState().confirmation).toBeNull();
  });
});
