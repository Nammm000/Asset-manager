import { Component, OnInit, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { take } from 'rxjs';
import { AutoHideScrollbar } from 'directive/auto-hide-scrollbar';
import { OtherAssetService } from 'service/other-asset.service';
import type { OtherAsset } from 'model/asset.model';
import { getApiErrorMessage } from 'util/api-util';
import { GlobalMessages } from 'component/shared/global-constants';

/**
 * Create/edit modal for other assets. Mounted fresh by the page on each open
 * (`@if (showForm())`), so fields are seeded once in ngOnInit — a null asset
 * input means "create".
 */
@Component({
  selector: 'app-other-asset-form',
  imports: [FormsModule, AutoHideScrollbar],
  templateUrl: './other-asset-form.html',
})
export class OtherAssetForm implements OnInit {
  readonly asset = input<OtherAsset | null>(null);
  readonly saved = output<void>();
  readonly closed = output<void>();

  readonly isEdit = computed(() => this.asset() !== null);

  name = signal('');
  amount = signal<number | null>(null);
  pricePerUnit = signal<number | null>(null);

  readonly isNameValid = computed(() => this.name().trim() !== '');
  readonly isAmountValid = computed(() => this.amount() !== null && this.amount()! >= 0);
  readonly isPriceValid = computed(() => this.pricePerUnit() !== null && this.pricePerUnit()! > 0);

  readonly canSubmit = computed(
    () => this.isNameValid() && this.isAmountValid() && this.isPriceValid(),
  );
  readonly submitting = signal(false);
  readonly errorMessage = signal('');

  constructor(private otherAssetService: OtherAssetService) {}

  ngOnInit(): void {
    const asset = this.asset();
    this.name.set(asset?.name ?? '');
    this.amount.set(asset?.amount ?? null);
    this.pricePerUnit.set(asset?.pricePerUnit ?? null);
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
      name: this.name().trim(),
      amount: this.amount()!,
      pricePerUnit: this.pricePerUnit()!,
    };
    const asset = this.asset();
    const call = asset ? this.otherAssetService.update(asset.id, body) : this.otherAssetService.create(body);
    call.pipe(take(1)).subscribe({
      next: () => this.saved.emit(),
      error: (error) => {
        this.submitting.set(false);
        this.errorMessage.set(getApiErrorMessage(error, GlobalMessages.genericError));
      },
    });
  }
}
