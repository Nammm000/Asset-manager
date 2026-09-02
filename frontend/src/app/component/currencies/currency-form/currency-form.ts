import { Component, OnInit, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { take } from 'rxjs';
import { AutoHideScrollbar } from 'directive/auto-hide-scrollbar';
import { CurrencyService } from 'service/currency.service';
import type { Currency } from 'model/currency.model';
import { getApiErrorMessage } from 'util/api-util';
import { GlobalMessages } from 'component/shared/global-constants';

/**
 * Create/edit modal for currencies. The code is the path key, so it is
 * uppercased on input and locked while editing. Mounted fresh by the page on
 * each open; a null currency input means "create".
 */
@Component({
  selector: 'app-currency-form',
  imports: [FormsModule, AutoHideScrollbar],
  templateUrl: './currency-form.html',
})
export class CurrencyForm implements OnInit {
  readonly currency = input<Currency | null>(null);
  readonly saved = output<void>();
  readonly closed = output<void>();

  readonly isEdit = computed(() => this.currency() !== null);

  code = signal('');
  name = signal('');
  symbol = signal('');
  decimalPlaces = signal<number | null>(null);

  readonly isCodeValid = computed(() => /^[a-zA-Z]{1,3}$/.test(this.code()));
  readonly isNameValid = computed(() => this.name().trim() !== '');
  readonly isSymbolValid = computed(() => this.symbol().trim() !== '');
  readonly isDecimalPlacesValid = computed(
    () => this.decimalPlaces() !== null && this.decimalPlaces()! >= 0 && this.decimalPlaces()! <= 8,
  );

  readonly canSubmit = computed(
    () =>
      this.isCodeValid() && this.isNameValid() && this.isSymbolValid() && this.isDecimalPlacesValid(),
  );
  readonly submitting = signal(false);
  readonly errorMessage = signal('');

  constructor(private currencyService: CurrencyService) {}

  ngOnInit(): void {
    const currency = this.currency();
    this.code.set(currency?.code ?? '');
    this.name.set(currency?.name ?? '');
    this.symbol.set(currency?.symbol ?? '');
    this.decimalPlaces.set(currency?.decimalPlaces ?? null);
  }

  onCodeInput(value: string): void {
    this.code.set(value.toUpperCase());
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
      code: this.code().toUpperCase(),
      name: this.name().trim(),
      symbol: this.symbol().trim(),
      decimalPlaces: this.decimalPlaces()!,
    };
    const currency = this.currency();
    const call = currency
      ? this.currencyService.update(currency.code, body)
      : this.currencyService.create(body);
    call.pipe(take(1)).subscribe({
      next: () => this.saved.emit(),
      error: (error) => {
        this.submitting.set(false);
        this.errorMessage.set(getApiErrorMessage(error, GlobalMessages.genericError));
      },
    });
  }
}
