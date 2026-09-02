import { Component, computed, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { take } from 'rxjs';
import { AutoHideScrollbar } from 'directive/auto-hide-scrollbar';
import { CashAssetService } from 'service/cash-asset.service';
import { getApiErrorMessage } from 'util/api-util';
import { GlobalMessages } from 'component/shared/global-constants';

/**
 * Create modal for cash wallets — there is no update on the backend. Note the
 * backend never returns name/description, so the list shows "Cash Wallet #id".
 */
@Component({
  selector: 'app-cash-asset-form',
  imports: [FormsModule, AutoHideScrollbar],
  templateUrl: './cash-asset-form.html',
})
export class CashAssetForm {
  readonly saved = output<void>();
  readonly closed = output<void>();

  name = signal('');
  description = signal('');

  readonly isNameValid = computed(() => this.name().trim() !== '');
  readonly canSubmit = computed(() => this.isNameValid());
  readonly submitting = signal(false);
  readonly errorMessage = signal('');

  constructor(private cashAssetService: CashAssetService) {}

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
      description: this.description().trim() || undefined,
    };
    this.cashAssetService
      .create(body)
      .pipe(take(1))
      .subscribe({
        next: () => this.saved.emit(),
        error: (error) => {
          this.submitting.set(false);
          this.errorMessage.set(getApiErrorMessage(error, GlobalMessages.genericError));
        },
      });
  }
}
