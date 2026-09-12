import { Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { take } from 'rxjs';
import { AutoHideScrollbar } from 'directive/auto-hide-scrollbar';
import { CashBalanceService } from 'service/cash-balance.service';
import { ModalService } from 'service/modal.service';
import { LanguageService } from 'service/language.service';
import type { CashAsset, CashBalance } from 'model/asset.model';
import type { Currency } from 'model/currency.model';
import { getApiErrorMessage } from 'util/api-util';
import { formatNumber } from 'util/time-util';
import { GlobalMessages } from 'component/shared/global-constants';

type BalanceModalMode = 'add' | 'adjust' | 'set';

/**
 * Per-wallet balance management, rendered inside the expanded detail row of
 * the cash-assets table. Mutations go through CashBalanceService and emit
 * `changed` so the page refetches the wallet (balances only come back from
 * getById, not the paged list).
 *
 * Backend rules: a wallet holds at most one balance per currency (duplicates
 * are already filtered out of the add dropdown); "adjust" adds a signed
 * amount and must repeat the balance's currencyCode; "set" writes an absolute
 * amount >= 0.
 */
@Component({
  selector: 'app-cash-asset-balances',
  imports: [FormsModule, AutoHideScrollbar],
  templateUrl: './cash-asset-balances.html',
  styleUrl: './cash-asset-balances.scss',
})
export class CashAssetBalances {
  readonly wallet = input.required<CashAsset>();
  readonly currencies = input<Currency[]>([]);
  readonly changed = output<void>();

  readonly balances = computed(() => this.wallet().balances ?? []);

  /** Currencies not yet held — the (cashAsset, currency) pair is unique server-side. */
  readonly availableCurrencies = computed(() => {
    const held = new Set(this.balances().map((balance) => balance.currencyCode));
    return this.currencies().filter((currency) => !held.has(currency.code));
  });

  // Modal state — one small modal serves add/adjust/set
  readonly mode = signal<BalanceModalMode | null>(null);
  readonly target = signal<CashBalance | null>(null);
  currencyCode = signal('');
  amount = signal<number | null>(null);
  direction = signal<'add' | 'subtract'>('add');

  readonly isAmountValid = computed(() => {
    if (this.amount() === null) {
      return false;
    }
    return this.mode() === 'adjust' ? this.amount()! > 0 : this.amount()! >= 0;
  });

  readonly canSubmit = computed(() => {
    if (!this.isAmountValid()) {
      return false;
    }
    return this.mode() === 'add' ? this.currencyCode() !== '' : this.target() !== null;
  });

  readonly submitting = signal(false);
  readonly errorMessage = signal('');

  constructor(
    private cashBalanceService: CashBalanceService,
    private modalService: ModalService,
    protected langService: LanguageService,
  ) {}

  // Formatting utils for the template
  protected readonly formatNumber = formatNumber;

  currencyFor(code: string): Currency | undefined {
    return this.currencies().find((currency) => currency.code === code);
  }

  currencyLabel(code: string): string {
    const currency = this.currencyFor(code);
    return currency ? `${code} (${currency.symbol})` : code;
  }

  openAdd(): void {
    this.mode.set('add');
    this.target.set(null);
    this.currencyCode.set(this.availableCurrencies()[0]?.code ?? '');
    this.amount.set(null);
    this.direction.set('add');
    this.errorMessage.set('');
  }

  openAdjust(balance: CashBalance): void {
    this.mode.set('adjust');
    this.target.set(balance);
    this.amount.set(null);
    this.direction.set('add');
    this.errorMessage.set('');
  }

  openSet(balance: CashBalance): void {
    this.mode.set('set');
    this.target.set(balance);
    this.amount.set(null);
    this.errorMessage.set('');
  }

  closeModal(): void {
    this.mode.set(null);
    this.target.set(null);
    this.submitting.set(false);
    this.errorMessage.set('');
  }

  confirmDelete(balance: CashBalance): void {
    this.modalService.openConfirmation({
      title: 'Delete balance',
      message: `Delete the ${balance.currencyCode} balance from this wallet?`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => this.deleteBalance(balance.id),
    });
  }

  submit(): void {
    if (!this.canSubmit() || this.submitting()) {
      return;
    }
    this.submitting.set(true);
    this.errorMessage.set('');

    const walletId = this.wallet().id;
    const target = this.target();
    const amount = this.amount()!;

    const call =
      this.mode() === 'add'
        ? this.cashBalanceService.create({
            cashAssetId: walletId,
            currencyCode: this.currencyCode(),
            amount,
          })
        : this.mode() === 'adjust'
          ? this.cashBalanceService.adjust(target!.id, {
              currencyCode: target!.currencyCode,
              amount: this.direction() === 'subtract' ? -amount : amount,
            })
          : this.cashBalanceService.setAmount(target!.id, amount);

    call.pipe(take(1)).subscribe({
      next: () => {
        this.closeModal();
        this.changed.emit();
      },
      error: (error) => {
        this.submitting.set(false);
        this.errorMessage.set(getApiErrorMessage(error, GlobalMessages.genericError));
      },
    });
  }

  private deleteBalance(id: number): void {
    this.cashBalanceService
      .delete(id)
      .pipe(take(1))
      .subscribe({
        next: () => this.changed.emit(),
        error: (error) => this.errorMessage.set(getApiErrorMessage(error, GlobalMessages.genericError)),
      });
  }
}
