import { Component, OnInit, signal } from '@angular/core';
import { take } from 'rxjs';
import { CashAssetService } from 'service/cash-asset.service';
import { CurrencyService } from 'service/currency.service';
import { ModalService } from 'service/modal.service';
import type { CashAsset } from 'model/asset.model';
import type { Currency } from 'model/currency.model';
import { Pagination } from 'component/shared/pagination/pagination';
import { CashAssetForm } from './cash-asset-form/cash-asset-form';
import { CashAssetBalances } from './cash-asset-balances/cash-asset-balances';
import { getApiErrorMessage } from 'util/api-util';
import { customFormattedDate } from 'util/time-util';
import { GlobalMessages } from 'component/shared/global-constants';

/**
 * Cash wallets. There is no update on the backend, so the page offers only
 * create (name/description are required on create but never returned — rows
 * fall back to "Cash Wallet #id") and delete. Balances live in an expandable
 * detail row, fetched per wallet via getById (the paged list omits them) and
 * cached in balancesById.
 */
@Component({
  selector: 'app-cash-assets',
  imports: [Pagination, CashAssetForm, CashAssetBalances],
  templateUrl: './cash-assets.html',
  styleUrl: './cash-assets.scss',
})
export class CashAssets implements OnInit {
  readonly loading = signal(false);
  readonly errorMessage = signal('');
  readonly rows = signal<CashAsset[]>([]);
  readonly page = signal(0);
  readonly totalPages = signal(1);
  readonly pageSize = signal(10);

  // Form modal state — editing null means "create" (there is no edit)
  readonly showForm = signal(false);

  // Expanded wallet detail rows
  readonly expandedId = signal<number | null>(null);
  readonly balancesById = signal<Record<number, CashAsset>>({});

  // Currency metadata for symbol display — read is any JWT user, failures are non-fatal
  readonly currencies = signal<Currency[]>([]);

  constructor(
    private cashAssetService: CashAssetService,
    private currencyService: CurrencyService,
    private modalService: ModalService,
  ) {}

  // Formatting utils for the template
  protected readonly customFormattedDate = customFormattedDate;

  ngOnInit(): void {
    this.load();
    this.currencyService
      .getAll()
      .pipe(take(1))
      .subscribe({
        next: (currencies) => this.currencies.set(currencies),
        error: () => this.currencies.set([]), // balances still render by code
      });
  }

  load(page: number = this.page(), size: number = this.pageSize()): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.cashAssetService
      .getAll(page, size)
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          this.rows.set(response.content);
          this.page.set(response.page);
          this.pageSize.set(response.size);
          this.totalPages.set(response.totalPages);
          this.loading.set(false);
        },
        error: (error) => {
          this.errorMessage.set(getApiErrorMessage(error, GlobalMessages.genericError));
          this.loading.set(false);
        },
      });
  }

  // Page indexes are size-dependent — a new size always restarts at page 0
  onPageSizeChange(size: number): void {
    this.load(0, size);
  }

  openCreate(): void {
    this.showForm.set(true);
  }

  onSaved(): void {
    this.showForm.set(false);
    this.load();
  }

  closeForm(): void {
    this.showForm.set(false);
  }

  toggleBalances(wallet: CashAsset): void {
    const id = wallet.id;
    if (this.expandedId() === id) {
      this.expandedId.set(null);
      return;
    }
    this.expandedId.set(id);
    if (!this.balancesById()[id]) {
      this.fetchBalances(id);
    }
  }

  onBalancesChanged(id: number): void {
    this.fetchBalances(id);
  }

  detailFor(id: number): CashAsset | null {
    return this.balancesById()[id] ?? null;
  }

  private fetchBalances(id: number): void {
    this.cashAssetService
      .getById(id)
      .pipe(take(1))
      .subscribe({
        next: (wallet) => this.balancesById.update((map) => ({ ...map, [id]: wallet })),
        error: (error) => this.errorMessage.set(getApiErrorMessage(error, GlobalMessages.genericError)),
      });
  }

  confirmDelete(wallet: CashAsset): void {
    this.modalService.openConfirmation({
      title: 'Delete cash wallet',
      message: `Delete this wallet and all its balances? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => this.deleteWallet(wallet.id),
    });
  }

  private deleteWallet(id: number): void {
    this.cashAssetService
      .delete(id)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.expandedId.set(this.expandedId() === id ? null : this.expandedId());
          this.load();
        },
        error: (error) => this.errorMessage.set(getApiErrorMessage(error, GlobalMessages.genericError)),
      });
  }
}
