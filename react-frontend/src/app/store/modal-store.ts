import { create } from 'zustand';

/** A pending confirmation dialog. The request doubles as visibility state. */
export interface ConfirmationRequest {
  title: string;
  message: string;
  confirmLabel?: string; // default 'Confirm'
  cancelLabel?: string; // default 'Cancel'
  danger?: boolean; // true → red confirm button (deletes)
  onConfirm: () => void;
}

interface ModalState {
  loginVisible: boolean;
  signupVisible: boolean;
  changePasswordVisible: boolean;
  confirmation: ConfirmationRequest | null;

  openLogin(): void;
  openSignup(): void;
  openChangePassword(): void;
  closeLogin(): void;
  closeSignup(): void;
  closeChangePassword(): void;
  openConfirmation(request: ConfirmationRequest): void;
  closeConfirmation(): void;
}

/**
 * Ported from Angular's ModalService: visibility state for the four
 * permanently-mounted modals. Flow is header → store → modal component, never
 * component-to-component. Imported by auth-store (sessionExpired opens the
 * login modal) — this store imports nothing.
 */
export const useModalStore = create<ModalState>()((set) => ({
  loginVisible: false,
  signupVisible: false,
  changePasswordVisible: false,
  confirmation: null,

  openLogin: () => set({ loginVisible: true }),
  openSignup: () => set({ signupVisible: true }),
  openChangePassword: () => set({ changePasswordVisible: true }),
  closeLogin: () => set({ loginVisible: false }),
  closeSignup: () => set({ signupVisible: false }),
  closeChangePassword: () => set({ changePasswordVisible: false }),

  // Shared confirmation dialog (delete flows on the asset pages)
  openConfirmation: (request) => set({ confirmation: { confirmLabel: 'Confirm', cancelLabel: 'Cancel', ...request } }),
  closeConfirmation: () => set({ confirmation: null }),
}));
