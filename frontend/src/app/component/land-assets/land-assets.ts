import { Component, OnInit, computed, signal } from '@angular/core';
import { take } from 'rxjs';
import { LandAssetService } from 'service/land-asset.service';
import { ModalService } from 'service/modal.service';
import { LanguageService } from 'service/language.service';
import type { LandAsset } from 'model/asset.model';
import { Pagination } from 'component/shared/pagination/pagination';
import { LandAssetForm } from './land-asset-form/land-asset-form';
import { getApiErrorMessage } from 'util/api-util';
import { customFormattedDate, formatNumber } from 'util/time-util';
import { GlobalMessages } from 'component/shared/global-constants';

@Component({
  selector: 'app-land-assets',
  imports: [Pagination, LandAssetForm],
  templateUrl: './land-assets.html',
  styleUrl: './land-assets.scss',
})
export class LandAssets implements OnInit {
  readonly loading = signal(false);
  readonly errorMessage = signal('');
  readonly rows = signal<LandAsset[]>([]);
  readonly page = signal(0);
  readonly totalPages = signal(1);
  readonly pageSize = signal(10);

  // Row selection for bulk delete — page-scoped, cleared on every (re)load
  readonly selectedIds = signal<ReadonlySet<number>>(new Set());
  readonly selectedCount = computed(() => this.selectedIds().size);
  readonly allSelected = computed(
    () => this.rows().length > 0 && this.rows().every((row) => this.selectedIds().has(row.id)),
  );

  // Form modal state — editing null means "create"
  readonly showForm = signal(false);
  readonly editing = signal<LandAsset | null>(null);

  constructor(
    private landAssetService: LandAssetService,
    private modalService: ModalService,
    protected langService: LanguageService,
  ) {}

  // Formatting utils for the template
  protected readonly formatNumber = formatNumber;
  protected readonly customFormattedDate = customFormattedDate;

  ngOnInit(): void {
    this.load();
  }

  load(page: number = this.page(), size: number = this.pageSize()): void {
    this.selectedIds.set(new Set());
    this.loading.set(true);
    this.errorMessage.set('');
    this.landAssetService
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
    this.editing.set(null);
    this.showForm.set(true);
  }

  openEdit(row: LandAsset): void {
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

  confirmDelete(row: LandAsset): void {
    this.modalService.openConfirmation({
      title: 'Delete land asset',
      message: `Delete the land at "${row.location}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => this.deleteAsset(row.id),
    });
  }

  private deleteAsset(id: number): void {
    this.landAssetService
      .delete(id)
      .pipe(take(1))
      .subscribe({
        next: () => this.load(),
        error: (error) => this.errorMessage.set(getApiErrorMessage(error, GlobalMessages.genericError)),
      });
  }

  isSelected(id: number): boolean {
    return this.selectedIds().has(id);
  }

  toggleSelected(id: number): void {
    this.selectedIds.update((ids) => {
      const next = new Set(ids);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  toggleSelectAll(): void {
    const rowIds = this.rows().map((row) => row.id);
    this.selectedIds.update((ids) => {
      const next = new Set(ids);
      if (rowIds.every((id) => next.has(id))) {
        rowIds.forEach((id) => next.delete(id));
      } else {
        rowIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  confirmBulkDelete(): void {
    const count = this.selectedCount();
    if (count === 0) {
      return;
    }
    this.modalService.openConfirmation({
      title: 'Delete land assets',
      message: `Delete ${count} selected land asset${count === 1 ? '' : 's'}? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => this.deleteSelected(),
    });
  }

  private deleteSelected(): void {
    const ids = [...this.selectedIds()];
    this.landAssetService
      .deleteMany(ids)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.selectedIds.set(new Set());
          this.load();
        },
        error: (error) => this.errorMessage.set(getApiErrorMessage(error, GlobalMessages.genericError)),
      });
  }
}
