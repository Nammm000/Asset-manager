import { Component, OnInit, signal } from '@angular/core';
import { take } from 'rxjs';
import { LandAssetService } from 'service/land-asset.service';
import { ModalService } from 'service/modal.service';
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
  readonly pageSize = 10;

  // Form modal state — editing null means "create"
  readonly showForm = signal(false);
  readonly editing = signal<LandAsset | null>(null);

  constructor(
    private landAssetService: LandAssetService,
    private modalService: ModalService,
  ) {}

  // Formatting utils for the template
  protected readonly formatNumber = formatNumber;
  protected readonly customFormattedDate = customFormattedDate;

  ngOnInit(): void {
    this.load();
  }

  load(page: number = this.page()): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.landAssetService
      .getAll(page, this.pageSize)
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          this.rows.set(response.content);
          this.page.set(response.page);
          this.totalPages.set(response.totalPages);
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
}
