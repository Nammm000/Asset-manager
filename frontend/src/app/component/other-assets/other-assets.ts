import { Component, OnInit, signal } from '@angular/core';
import { take } from 'rxjs';
import { OtherAssetService } from 'service/other-asset.service';
import { ModalService } from 'service/modal.service';
import type { OtherAsset } from 'model/asset.model';
import { Pagination } from 'component/shared/pagination/pagination';
import { OtherAssetForm } from './other-asset-form/other-asset-form';
import { getApiErrorMessage } from 'util/api-util';
import { customFormattedDate, formatNumber } from 'util/time-util';
import { GlobalMessages } from 'component/shared/global-constants';

@Component({
  selector: 'app-other-assets',
  imports: [Pagination, OtherAssetForm],
  templateUrl: './other-assets.html',
  styleUrl: './other-assets.scss',
})
export class OtherAssets implements OnInit {
  readonly loading = signal(false);
  readonly errorMessage = signal('');
  readonly rows = signal<OtherAsset[]>([]);
  readonly page = signal(0);
  readonly totalPages = signal(1);
  readonly pageSize = signal(10);

  // Form modal state — editing null means "create"
  readonly showForm = signal(false);
  readonly editing = signal<OtherAsset | null>(null);

  constructor(
    private otherAssetService: OtherAssetService,
    private modalService: ModalService,
  ) {}

  // Formatting utils for the template
  protected readonly formatNumber = formatNumber;
  protected readonly customFormattedDate = customFormattedDate;

  ngOnInit(): void {
    this.load();
  }

  load(page: number = this.page(), size: number = this.pageSize()): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.otherAssetService
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

  openEdit(row: OtherAsset): void {
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

  confirmDelete(row: OtherAsset): void {
    this.modalService.openConfirmation({
      title: 'Delete asset',
      message: `Delete "${row.name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => this.deleteAsset(row.id),
    });
  }

  private deleteAsset(id: number): void {
    this.otherAssetService
      .delete(id)
      .pipe(take(1))
      .subscribe({
        next: () => this.load(),
        error: (error) => this.errorMessage.set(getApiErrorMessage(error, GlobalMessages.genericError)),
      });
  }
}
