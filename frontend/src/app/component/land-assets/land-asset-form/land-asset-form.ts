import { Component, OnInit, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { take } from 'rxjs';
import { AutoHideScrollbar } from 'directive/auto-hide-scrollbar';
import { LandAssetService } from 'service/land-asset.service';
import type { LandAsset } from 'model/asset.model';
import { getApiErrorMessage } from 'util/api-util';
import { GlobalMessages } from 'component/shared/global-constants';

/**
 * Create/edit modal for land assets. Mounted fresh by the page on each open
 * (`@if (showForm())`), so fields are seeded once in ngOnInit — a null asset
 * input means "create". Dates use date inputs and convert to ISO datetime on
 * submit (the wire format is ISO datetime).
 */
@Component({
  selector: 'app-land-asset-form',
  imports: [FormsModule, AutoHideScrollbar],
  templateUrl: './land-asset-form.html',
})
export class LandAssetForm implements OnInit {
  readonly asset = input<LandAsset | null>(null);
  readonly saved = output<void>();
  readonly closed = output<void>();

  readonly isEdit = computed(() => this.asset() !== null);

  location = signal('');
  area = signal<number | null>(null);
  purchaseDate = signal('');
  saleDate = signal('');

  readonly isLocationValid = computed(() => this.location().trim() !== '');
  readonly isAreaValid = computed(() => this.area() !== null && this.area()! > 0);
  readonly isPurchaseDateValid = computed(() => this.purchaseDate() !== '');

  readonly canSubmit = computed(
    () => this.isLocationValid() && this.isAreaValid() && this.isPurchaseDateValid(),
  );
  readonly submitting = signal(false);
  readonly errorMessage = signal('');

  constructor(private landAssetService: LandAssetService) {}

  ngOnInit(): void {
    const asset = this.asset();
    this.location.set(asset?.location ?? '');
    this.area.set(asset?.area ?? null);
    // ISO datetime -> yyyy-MM-dd for the date input
    this.purchaseDate.set(asset?.purchaseDate?.slice(0, 10) ?? '');
    this.saleDate.set(asset?.saleDate?.slice(0, 10) ?? '');
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
      location: this.location().trim(),
      area: this.area()!,
      purchaseDate: new Date(this.purchaseDate()).toISOString(),
      saleDate: this.saleDate() ? new Date(this.saleDate()).toISOString() : undefined,
    };
    const asset = this.asset();
    const call = asset ? this.landAssetService.update(asset.id, body) : this.landAssetService.create(body);
    call.pipe(take(1)).subscribe({
      next: () => this.saved.emit(),
      error: (error) => {
        this.submitting.set(false);
        this.errorMessage.set(getApiErrorMessage(error, GlobalMessages.genericError));
      },
    });
  }
}
