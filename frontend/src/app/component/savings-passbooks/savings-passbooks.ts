import { Component, OnInit, computed, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { take } from "rxjs";
import { SavingsPassbookService } from "service/savings-passbook.service";
import { ModalService } from "service/modal.service";
import { LanguageService } from "service/language.service";
import type {
  FilterCriterion,
  FilterOperator,
  SavingsPassbook,
  SavingsPassbookFilters,
} from "model/asset.model";
import { Pagination } from "component/shared/pagination/pagination";
import { SavingsPassbookForm } from "./savings-passbook-form/savings-passbook-form";
import { AdditionalDepositForm } from "./additional-deposit-form/additional-deposit-form";
import { getApiErrorMessage } from "util/api-util";
import { customFormattedDate, formatNumber } from "util/time-util";
import { GlobalMessages } from "component/shared/global-constants";

/** Filterable fields that carry an operator alongside their value. */
type CriterionField =
  | "principalAmount"
  | "depositTerm"
  | "interestRate"
  | "maturityDate"
  | "withdrawalDate"
  | "estimatedMaturityProceeds";

const FILTER_OPERATORS: FilterOperator[] = ["=", ">", ">=", "<", "<="];

function isFilterOperator(value: string): value is FilterOperator {
  return (FILTER_OPERATORS as string[]).includes(value);
}

/** Empty filter set — exported so specs can build a baseline. */
export function emptySavingsPassbookFilters(): SavingsPassbookFilters {
  return {
    savingsPassbookName: "",
    principalAmount: { op: "=", value: "" },
    depositTerm: { op: "=", value: "" },
    interestRate: { op: "=", value: "" },
    maturityDate: { op: "=", value: "" },
    withdrawalDate: { op: "=", value: "" },
    estimatedMaturityProceeds: { op: "=", value: "" },
  };
}

function criterionValues(filters: SavingsPassbookFilters): string[] {
  return [
    filters.savingsPassbookName,
    filters.principalAmount.value,
    filters.depositTerm.value,
    filters.interestRate.value,
    filters.maturityDate.value,
    filters.withdrawalDate.value,
    filters.estimatedMaturityProceeds.value,
  ];
}

function hasAnyValue(filters: SavingsPassbookFilters): boolean {
  return criterionValues(filters).some((value) => value.trim() !== "");
}

@Component({
  selector: "app-savings-passbooks",
  imports: [FormsModule, Pagination, SavingsPassbookForm, AdditionalDepositForm],
  templateUrl: "./savings-passbooks.html",
  styleUrl: "./savings-passbooks.scss",
})
export class SavingsPassbooks implements OnInit {
  readonly loading = signal(false);
  readonly errorMessage = signal("");
  readonly rows = signal<SavingsPassbook[]>([]);
  readonly page = signal(0);
  readonly totalPages = signal(1);
  readonly pageSize = signal(10);

  // Row selection for bulk delete — page-scoped, cleared on every (re)load
  readonly selectedIds = signal<ReadonlySet<number>>(new Set());
  readonly selectedCount = computed(() => this.selectedIds().size);
  readonly allSelected = computed(
    () =>
      this.rows().length > 0 &&
      this.rows().every((row) => this.selectedIds().has(row.id)),
  );

  // Form modal state — editing null means "create"
  readonly showForm = signal(false);
  readonly editing = signal<SavingsPassbook | null>(null);

  // Deposit modal state — depositing null means "no row context" (toolbar open)
  readonly showDepositForm = signal(false);
  readonly depositing = signal<SavingsPassbook | null>(null);

  // Server-side search — the panel edits the draft; only appliedFilters drives load()
  readonly showFilters = signal(false);
  readonly filterDraft = signal<SavingsPassbookFilters>(
    emptySavingsPassbookFilters(),
  );
  readonly appliedFilters = signal<SavingsPassbookFilters>(
    emptySavingsPassbookFilters(),
  );
  readonly hasActiveFilters = computed(() =>
    hasAnyValue(this.appliedFilters()),
  );
  readonly activeFilterCount = computed(
    () =>
      criterionValues(this.appliedFilters()).filter(
        (value) => value.trim() !== "",
      ).length,
  );

  protected readonly operatorOptions = FILTER_OPERATORS;

  constructor(
    private passbookService: SavingsPassbookService,
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
    this.errorMessage.set("");
    // Filters drive the endpoint choice — everything else (pagination, page size,
    // delete/bulk-delete, form-saved reloads) funnels through here, so it all
    // preserves the applied filters.
    const filters = this.appliedFilters();
    const request$ = hasAnyValue(filters)
      ? this.passbookService.search(filters, page, size)
      : this.passbookService.getAll(page, size);
    request$.pipe(take(1)).subscribe({
      next: (response) => {
        this.rows.set(response.content);
        this.page.set(response.page);
        this.pageSize.set(response.size);
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

  // Page indexes are size-dependent — a new size always restarts at page 0
  onPageSizeChange(size: number): void {
    this.load(0, size);
  }

  toggleFilters(): void {
    this.showFilters.update((open) => !open);
  }

  onNameFilterChange(value: string): void {
    this.filterDraft.update((draft) => ({
      ...draft,
      savingsPassbookName: value,
    }));
  }

  onCriterionChange(
    field: CriterionField,
    key: "op" | "value",
    raw: string,
  ): void {
    this.filterDraft.update((draft) => {
      const current = draft[field];
      const next: FilterCriterion =
        key === "op"
          ? { op: isFilterOperator(raw) ? raw : "=", value: current.value }
          : { op: current.op, value: raw };
      return { ...draft, [field]: next };
    });
  }

  // A new filter set always restarts at the first page, keeping the current size
  applyFilters(): void {
    this.appliedFilters.set(this.filterDraft());
    this.load(0);
  }

  clearFilters(): void {
    this.filterDraft.set(emptySavingsPassbookFilters());
    this.appliedFilters.set(emptySavingsPassbookFilters());
    this.load(0);
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
      title: "Delete passbooks",
      message: `Delete ${count} selected savings passbook${count === 1 ? "" : "s"}? This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
      onConfirm: () => this.deleteSelected(),
    });
  }

  private deleteSelected(): void {
    const ids = [...this.selectedIds()];
    this.passbookService
      .deleteMany(ids)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.selectedIds.set(new Set());
          this.load();
        },
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
