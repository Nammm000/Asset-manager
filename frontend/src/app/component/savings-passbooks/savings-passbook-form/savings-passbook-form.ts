import {
  Component,
  OnInit,
  computed,
  input,
  output,
  signal,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { take } from "rxjs";
import { AutoHideScrollbar } from "directive/auto-hide-scrollbar";
import { SavingsPassbookService } from "service/savings-passbook.service";
import type { SavingsPassbook } from "model/asset.model";
import { getApiErrorMessage } from "util/api-util";
import { addDays, formatNumber, timeToDays } from "util/time-util";
import {
  GlobalMessages,
  GlobalRegexes,
} from "component/shared/global-constants";

/**
 * Create/edit modal for savings passbooks. withdrawalDate is display-only —
 * it is not part of the create/update request types. Mounted fresh by the
 * page on each open; a null passbook input means "create".
 *
 * The user types principal, deposit time ("1 year 2 months 3 days") and rate.
 * depositTerm (days, via timeToDays) and maturityDate are readonly and only
 * (re)computed by the OK button next to the deposit time input — counting
 * from createdAt when one is set, else from today's date.
 */
@Component({
  selector: "app-savings-passbook-form",
  imports: [FormsModule, AutoHideScrollbar],
  templateUrl: "./savings-passbook-form.html",
})
export class SavingsPassbookForm implements OnInit {
  readonly passbook = input<SavingsPassbook | null>(null);
  readonly saved = output<void>();
  readonly closed = output<void>();

  readonly isEdit = computed(() => this.passbook() !== null);

  principalAmount = signal<number | null>(null);
  /** Formatted display value of principalAmount (formatNumber dot grouping) for the text input. */
  principalAmountText = signal("");
  estimatedMaturityProceedsText = signal("");
  depositTime = signal<string | null>(null);
  depositTerm = signal<number | null>(null);
  interestRate = signal<number | null>(null);
  maturityDate = signal("");
  createdAt = signal("");
  estimatedMaturityProceeds = signal<number | null>(null);

  readonly isPrincipalValid = computed(
    () => this.principalAmount() !== null && this.principalAmount()! > 0,
  );
  readonly isInterestRateValid = computed(
    () => this.interestRate() !== null && this.interestRate()! >= 0,
  );
  readonly isDepositTermValid = computed(
    () => this.depositTerm() !== null && this.depositTerm()! >= 30,
  );
  // Fresh copy without the `g` flag — the shared regex carries lastIndex state that timeToDays' exec loop also mutates
  readonly isDepositTimeValid = computed(() => {
    const value = this.depositTime();
    return (
      value !== null &&
      new RegExp(GlobalRegexes.timeStringRegex.source, "i").test(value)
    );
  });

  readonly canSubmit = computed(
    () =>
      this.isPrincipalValid() &&
      this.isInterestRateValid() &&
      this.isDepositTermValid() &&
      this.maturityDate() !== "",
  );
  readonly submitting = signal(false);
  readonly errorMessage = signal("");

  constructor(private passbookService: SavingsPassbookService) {}

  ngOnInit(): void {
    const passbook = this.passbook();
    this.principalAmount.set(passbook?.principalAmount ?? null);
    this.principalAmountText.set(
      passbook?.principalAmount != null
        ? formatNumber(passbook.principalAmount)
        : "",
    );
    this.interestRate.set(passbook?.interestRate ?? null);
    this.maturityDate.set(passbook?.maturityDate?.slice(0, 10) ?? "");
    this.createdAt.set(passbook?.createdAt?.slice(0, 10) ?? "");
    this.estimatedMaturityProceeds.set(
      passbook?.estimatedMaturityProceeds ?? null,
    );
  }

  close(): void {
    this.closed.emit();
  }

  protected onPrincipalAmountChange(value: string): void {
    const digits = value.replace(/\D/g, "");
    if (digits === "") {
      this.principalAmountText.set("");
      this.principalAmount.set(null);
      return;
    }
    const amount = Number(digits);
    this.principalAmount.set(amount);
    this.principalAmountText.set(formatNumber(amount));
  }

  // protected onEstimatedMaturityProceedsChange(value: string): void {
  //   const digits = value.replace(/\D/g, "");
  //   if (digits === "") {
  //     this.estimatedMaturityProceedsText.set("");
  //     this.estimatedMaturityProceeds.set(null);
  //     return;
  //   }
  //   const amount = Number(digits);
  //   this.estimatedMaturityProceeds.set(amount);
  //   this.estimatedMaturityProceedsText.set(formatNumber(amount));
  // }

  protected onDepositTimeChange(value: string): void {
    this.depositTime.set(value);
    this.depositTerm.set(null);
    this.estimatedMaturityProceeds.set(null);
    this.estimatedMaturityProceedsText.set("");
    this.maturityDate.set("");
  }

  protected onCalculateClick(): void {
    if (
      !this.isDepositTimeValid() ||
      !this.principalAmount() ||
      !this.interestRate()
    ) {
      return;
    }
    const days = timeToDays(this.depositTime()!);
    this.depositTerm.set(days);
    this.estimatedMaturityProceeds.set(
      this.calculateMaturityAmount(
        this.principalAmount()!,
        days,
        this.interestRate()!,
      ),
    );
    this.estimatedMaturityProceedsText.set(
      formatNumber(this.estimatedMaturityProceeds()!),
    );
    // createdAt (yyyy-MM-dd from the date input) is the base when set, else today;
    // appending 'T00:00:00' pins the parsed date to local midnight in any timezone
    const base = this.createdAt()
      ? new Date(`${this.createdAt()}T00:00:00`)
      : new Date();
    this.maturityDate.set(days > 0 ? addDays(base, days) : "");
  }

  protected calculateMaturityAmount(
    principal: number,
    termDays: number,
    interestRate: number,
  ): number {
    const interest = principal * (interestRate / 36500) * termDays;
    return principal + interest;
  }

  submit(): void {
    if (!this.canSubmit() || this.submitting()) {
      return;
    }
    this.submitting.set(true);
    this.errorMessage.set("");
    const body = {
      principalAmount: this.principalAmount()!,
      depositTerm: this.depositTerm()!,
      interestRate: this.interestRate()!,
      // Optional field — omit rather than send null
      createdAt: this.createdAt()
        ? new Date(this.createdAt()).toISOString()
        : undefined,
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
        this.errorMessage.set(
          getApiErrorMessage(error, GlobalMessages.genericError),
        );
      },
    });
  }
}
