import { Component, OnInit, computed, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { take } from 'rxjs';
import { AutoHideScrollbar } from 'directive/auto-hide-scrollbar';
import { AdditionalDepositService } from 'service/additional-deposit.service';
import { AuthService } from 'service/auth.service';
import { validateEmail, validatePhone } from 'util/auth-util';
import { getApiErrorMessage } from 'util/api-util';
import { formatNumber } from 'util/time-util';
import { GlobalMessages } from 'component/shared/global-constants';

/**
 * Additional-deposit modal. The backend identifies the depositor by the
 * account's own records — email OR phone must match the account, and the
 * passbook number is never shown in this app (list responses don't include
 * it), so it must be typed from the physical passbook. On success the
 * response carries the passbook number and updated principal.
 */
@Component({
  selector: 'app-additional-deposit-form',
  imports: [FormsModule, AutoHideScrollbar],
  templateUrl: './additional-deposit-form.html',
})
export class AdditionalDepositForm implements OnInit {
  readonly deposited = output<void>();
  readonly closed = output<void>();

  email = signal('');
  phone = signal('');
  accountNumber = signal('');
  savingsPassbookNumber = signal('');
  amount = signal<number | null>(null);

  readonly isEmailValid = computed(() => this.email() === '' || validateEmail(this.email()));
  readonly isPhoneValid = computed(() => this.phone() === '' || validatePhone(this.phone()));
  readonly isAmountValid = computed(() => this.amount() !== null && this.amount()! > 0);
  readonly hasContact = computed(() => this.email() !== '' || this.phone() !== '');

  readonly canSubmit = computed(
    () =>
      this.hasContact() &&
      this.isEmailValid() &&
      this.isPhoneValid() &&
      this.accountNumber().trim() !== '' &&
      this.savingsPassbookNumber().trim() !== '' &&
      this.isAmountValid(),
  );
  readonly submitting = signal(false);
  readonly errorMessage = signal('');

  // Set after a successful deposit — the panel replaces the form
  readonly successMessage = signal('');

  constructor(
    private depositService: AdditionalDepositService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.email.set(this.authService.email() ?? '');
  }

  close(): void {
    if (this.successMessage()) {
      this.deposited.emit(); // the passbook list needs a reload
    }
    this.closed.emit();
  }

  submit(): void {
    if (!this.canSubmit() || this.submitting()) {
      return;
    }
    this.submitting.set(true);
    this.errorMessage.set('');
    this.depositService
      .deposit({
        email: this.email().trim(),
        phone: this.phone().trim(),
        accountNumber: this.accountNumber().trim(),
        savingsPassbookNumber: this.savingsPassbookNumber().trim(),
        amount: this.amount()!,
      })
      .pipe(take(1))
      .subscribe({
        next: (passbook) => {
          this.submitting.set(false);
          this.successMessage.set(
            `Deposited successfully. Passbook ${passbook.savingsPassbookNumber ?? ''} now holds ` +
              `${formatNumber(passbook.principalAmount)}.`,
          );
        },
        error: (error) => {
          this.submitting.set(false);
          this.errorMessage.set(getApiErrorMessage(error, 'Deposit failed. Please check the details and try again.'));
        },
      });
  }
}
