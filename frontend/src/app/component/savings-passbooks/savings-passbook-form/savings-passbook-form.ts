import { Component, OnInit, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { take } from 'rxjs';
import { AutoHideScrollbar } from 'directive/auto-hide-scrollbar';
import { SavingsPassbookService } from 'service/savings-passbook.service';
import type { SavingsPassbook } from 'model/asset.model';
import { getApiErrorMessage } from 'util/api-util';
import { GlobalMessages } from 'component/shared/global-constants';

/**
 * Create/edit modal for savings passbooks. withdrawalDate is display-only —
 * it is not part of the create/update request types. Mounted fresh by the
 * page on each open; a null passbook input means "create".
 */
@Component({
  selector: 'app-savings-passbook-form',
  imports: [FormsModule, AutoHideScrollbar],
  templateUrl: './savings-passbook-form.html',
})
export class SavingsPassbookForm implements OnInit {
  readonly passbook = input<SavingsPassbook | null>(null);
  readonly saved = output<void>();
  readonly closed = output<void>();

  readonly isEdit = computed(() => this.passbook() !== null);

  principalAmount = signal<number | null>(null);
  depositTerm = signal<number | null>(null);
  interestRate = signal<number | null>(null);
  maturityDate = signal('');
  estimatedMaturityProceeds = signal<number | null>(null);

  readonly isPrincipalValid = computed(() => this.principalAmount() !== null && this.principalAmount()! > 0);
  readonly isInterestRateValid = computed(() => this.interestRate() !== null && this.interestRate()! >= 0);
  readonly isDepositTermValid = computed(() => this.depositTerm() !== null && this.depositTerm()! >= 30);

  readonly canSubmit = computed(() => this.isPrincipalValid() && this.isInterestRateValid() && this.isDepositTermValid() && this.maturityDate() !== '');
  readonly submitting = signal(false);
  readonly errorMessage = signal('');

  constructor(private passbookService: SavingsPassbookService) {}

  ngOnInit(): void {
    const passbook = this.passbook();
    this.principalAmount.set(passbook?.principalAmount ?? null);
    this.interestRate.set(passbook?.interestRate ?? null);
    this.maturityDate.set(passbook?.maturityDate?.slice(0, 10) ?? '');
    this.estimatedMaturityProceeds.set(passbook?.estimatedMaturityProceeds ?? null);
  }

  close(): void {
    this.closed.emit();
  }

  submit(): void {
    if (!this.canSubmit() || this.submitting()) {
      return;
    }
    this.submitting.set(true);
    this.errorMessage.set('');
    const body = {
      principalAmount: this.principalAmount()!,
      depositTerm: this.depositTerm()!,
      interestRate: this.interestRate()!,
      maturityDate: new Date(this.maturityDate()).toISOString(),
      // Optional field — omit rather than send null
      estimatedMaturityProceeds: this.estimatedMaturityProceeds() ?? undefined,
    };
    const passbook = this.passbook();
    const call = passbook
      ? this.passbookService.update(passbook.id, body)
      : this.passbookService.create(body);
    call.pipe(take(1)).subscribe({
      next: () => this.saved.emit(),
      error: (error) => {
        this.submitting.set(false);
        this.errorMessage.set(getApiErrorMessage(error, GlobalMessages.genericError));
      },
    });
  }
}
