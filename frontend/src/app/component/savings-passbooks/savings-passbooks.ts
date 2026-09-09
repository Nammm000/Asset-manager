import { Component, OnInit, signal } from "@angular/core";
import { take } from "rxjs";
import { SavingsPassbookService } from "service/savings-passbook.service";
import { ModalService } from "service/modal.service";
import type { SavingsPassbook } from "model/asset.model";
import { Pagination } from "component/shared/pagination/pagination";
import { SavingsPassbookForm } from "./savings-passbook-form/savings-passbook-form";
import { AdditionalDepositForm } from "./additional-deposit-form/additional-deposit-form";
import { getApiErrorMessage } from "util/api-util";
import { customFormattedDate, formatNumber } from "util/time-util";
import { GlobalMessages } from "component/shared/global-constants";

@Component({
  selector: "app-savings-passbooks",
  imports: [Pagination, SavingsPassbookForm, AdditionalDepositForm],
  templateUrl: "./savings-passbooks.html",
  styleUrl: "./savings-passbooks.scss",
})
export class SavingsPassbooks implements OnInit {
  readonly loading = signal(false);
  readonly errorMessage = signal("");
  readonly rows = signal<SavingsPassbook[]>([]);
  readonly page = signal(0);
  readonly totalPages = signal(1);
  readonly pageSize = 10;

  // Form modal state — editing null means "create"
  readonly showForm = signal(false);
  readonly editing = signal<SavingsPassbook | null>(null);

  // Deposit modal state — depositing null means "no row context" (toolbar open)
  readonly showDepositForm = signal(false);
  readonly depositing = signal<SavingsPassbook | null>(null);

  constructor(
    private passbookService: SavingsPassbookService,
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
    this.errorMessage.set("");
    this.passbookService
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
          this.errorMessage.set(
            getApiErrorMessage(error, GlobalMessages.genericError),
          );
          this.loading.set(false);
        },
      });
  }

  openCreate(): void {
    this.editing.set(null);
    this.showForm.set(true);
  }

  openDepositForm(row: SavingsPassbook): void {
    this.depositing.set(row);
    this.showDepositForm.set(true);
  }

  openEdit(row: SavingsPassbook): void {
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

  // openDeposit(): void {
  //   this.depositing.set(null);
  //   this.showDepositForm.set(true);
  // }

  onDeposited(): void {
    this.showDepositForm.set(false);
    this.load();
  }

  closeDepositForm(): void {
    this.showDepositForm.set(false);
  }

  confirmDelete(row: SavingsPassbook): void {
    this.modalService.openConfirmation({
      title: "Delete passbook",
      message: "Delete this savings passbook? This cannot be undone.",
      confirmLabel: "Delete",
      danger: true,
      onConfirm: () => this.deletePassbook(row.id),
    });
  }

  private deletePassbook(id: number): void {
    this.passbookService
      .delete(id)
      .pipe(take(1))
      .subscribe({
        next: () => this.load(),
        error: (error) =>
          this.errorMessage.set(
            getApiErrorMessage(error, GlobalMessages.genericError),
          ),
      });
  }

  estimatedProfitText(
    estimatedMaturityProceeds: number | undefined | null,
    principalAmount: number,
  ): string {
    if (
      estimatedMaturityProceeds === null ||
      estimatedMaturityProceeds === undefined
    ) {
      return "—";
    }
    const profit = estimatedMaturityProceeds - principalAmount;
    return this.formatNumber(profit);
  }
}
