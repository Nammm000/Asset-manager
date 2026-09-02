import { Component, OnInit, signal } from '@angular/core';
import { take } from 'rxjs';
import { CurrencyService } from 'service/currency.service';
import { ModalService } from 'service/modal.service';
import type { Currency } from 'model/currency.model';
import { CurrencyForm } from './currency-form/currency-form';
import { getApiErrorMessage } from 'util/api-util';
import { GlobalMessages } from 'component/shared/global-constants';

/** Admin page — currency writes are ADMIN-only on the backend; list is a plain array. */
@Component({
  selector: 'app-currencies',
  imports: [CurrencyForm],
  templateUrl: './currencies.html',
  styleUrl: './currencies.scss',
})
export class Currencies implements OnInit {
  readonly loading = signal(false);
  readonly errorMessage = signal('');
  readonly rows = signal<Currency[]>([]);

  // Form modal state — editing null means "create"
  readonly showForm = signal(false);
  readonly editing = signal<Currency | null>(null);

  constructor(
    private currencyService: CurrencyService,
    private modalService: ModalService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.currencyService
      .getAll()
      .pipe(take(1))
      .subscribe({
        next: (currencies) => {
          this.rows.set(currencies);
          this.loading.set(false);
        },
        error: (error) => {
          this.errorMessage.set(getApiErrorMessage(error, GlobalMessages.genericError));
          this.loading.set(false);
        },
      });
  }

  openCreate(): void {
    this.editing.set(null);
    this.showForm.set(true);
  }

  openEdit(row: Currency): void {
    this.editing.set(row);
    this.showForm.set(true);
  }

  onSaved(): void {
    this.showForm.set(false);
    this.load();
  }

  closeForm(): void {
    this.showForm.set(false);
  }

  confirmDelete(row: Currency): void {
    this.modalService.openConfirmation({
      title: 'Delete currency',
      message: `Delete ${row.code}? Balances using it will keep their raw codes.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => this.deleteCurrency(row.code),
    });
  }

  private deleteCurrency(code: string): void {
    this.currencyService
      .delete(code)
      .pipe(take(1))
      .subscribe({
        next: () => this.load(),
        // A currency referenced by cash balances is rejected server-side.
        error: (error) => this.errorMessage.set(getApiErrorMessage(error, GlobalMessages.genericError)),
      });
  }
}
