import { useCallback, useRef, useState, type FormEvent } from 'react';
import { deleteMany, getAll, remove, search } from 'service/savings-passbook.service';
import { useModalStore } from 'store/modal-store';
import { useT } from 'store/language-store';
import { usePageTitle } from 'hooks/use-page-title';
import { useMountOnce } from 'hooks/use-mount-once';
import type {
  FilterCriterion,
  FilterOperator,
  SavingsPassbook,
  SavingsPassbookFilters,
} from 'model/asset.model';
import { Pagination } from 'component/shared/pagination/pagination';
import { SavingsPassbookForm } from './savings-passbook-form/savings-passbook-form';
import { AdditionalDepositForm } from './additional-deposit-form/additional-deposit-form';
import { getApiErrorMessage } from 'util/api-util';
import { customFormattedDate, formatNumber } from 'util/time-util';
import { GlobalMessages } from 'component/shared/global-constants';

// All page styles are global in src/scss/page.scss and src/scss/table.scss.
import './savings-passbooks.scss';

/** Filterable fields that carry an operator alongside their value. */
type CriterionField =
  | 'principalAmount'
  | 'depositTerm'
  | 'interestRate'
  | 'maturityDate'
  | 'withdrawalDate'
  | 'estimatedMaturityProceeds';

const FILTER_OPERATORS: FilterOperator[] = ['=', '>', '>=', '<', '<='];

function isFilterOperator(value: string): value is FilterOperator {
  return (FILTER_OPERATORS as string[]).includes(value);
}

/** Empty filter set — exported so specs can build a baseline. */
export function emptySavingsPassbookFilters(): SavingsPassbookFilters {
  return {
    savingsPassbookName: '',
    principalAmount: { op: '=', value: '' },
    depositTerm: { op: '=', value: '' },
    interestRate: { op: '=', value: '' },
    maturityDate: { op: '=', value: '' },
    withdrawalDate: { op: '=', value: '' },
    estimatedMaturityProceeds: { op: '=', value: '' },
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
  return criterionValues(filters).some((value) => value.trim() !== '');
}

/**
 * Ported from Angular's SavingsPassbooks: paged table with page-scoped
 * bulk-select delete (selection cleared on every (re)load), create/edit and
 * additional-deposit modals mounted fresh per open, and a server-side filter
 * panel — the panel edits the draft; only appliedFilters drives load().
 */
export function SavingsPassbooks() {
  usePageTitle('Savings Passbooks | Asset Manager');
  const t = useT();

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [rows, setRows] = useState<SavingsPassbook[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Row selection for bulk delete — page-scoped, cleared on every (re)load
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<number>>(new Set());
  const selectedCount = selectedIds.size;
  const allSelected = rows.length > 0 && rows.every((row) => selectedIds.has(row.id));

  // Form modal state — editing null means "create"
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SavingsPassbook | null>(null);

  // Deposit modal state — depositing null means "no row context" (toolbar open)
  const [showDepositForm, setShowDepositForm] = useState(false);
  const [depositing, setDepositing] = useState<SavingsPassbook | null>(null);

  // Server-side search — the panel edits the draft; only appliedFilters drives load()
  const [showFilters, setShowFilters] = useState(false);
  const [filterDraft, setFilterDraft] = useState<SavingsPassbookFilters>(emptySavingsPassbookFilters);
  const [appliedFilters, setAppliedFilters] = useState<SavingsPassbookFilters>(emptySavingsPassbookFilters);
  const hasActiveFilters = hasAnyValue(appliedFilters);
  const activeFilterCount = criterionValues(appliedFilters).filter((value) => value.trim() !== '').length;

  const operatorOptions = FILTER_OPERATORS;

  // Angular's signals were always-current; refs let the stable load() read the
  // live page/size/applied filters at call time (pagination jumps and filter
  // applications arrive via callbacks, where stale closures would linger).
  const pageRef = useRef(page);
  const sizeRef = useRef(pageSize);
  const appliedFiltersRef = useRef(appliedFilters);
  pageRef.current = page;
  sizeRef.current = pageSize;
  appliedFiltersRef.current = appliedFilters;

  const load = useCallback(
    (targetPage?: number, targetSize?: number, filters?: SavingsPassbookFilters): void => {
      const nextPage = targetPage ?? pageRef.current;
      const nextSize = targetSize ?? sizeRef.current;
      const nextFilters = filters ?? appliedFiltersRef.current;
      setSelectedIds(new Set());
      setLoading(true);
      setErrorMessage('');
      // Filters drive the endpoint choice — everything else (pagination, page
      // size, delete/bulk-delete, form-saved reloads) funnels through here, so
      // it all preserves the applied filters.
      const request = hasAnyValue(nextFilters)
        ? search(nextFilters, nextPage, nextSize)
        : getAll(nextPage, nextSize);
      request.then(
        (response) => {
          setRows(response.content);
          setPage(response.page);
          setPageSize(response.size);
          setTotalPages(response.totalPages);
          setLoading(false);
        },
        (error: unknown) => {
          setErrorMessage(getApiErrorMessage(error, GlobalMessages.genericError));
          setLoading(false);
        },
      );
    },
    [],
  );

  useMountOnce(() => {
    load();
  });

  // Page indexes are size-dependent — a new size always restarts at page 0
  const onPageSizeChange = (size: number): void => {
    load(0, size);
  };

  const toggleFilters = (): void => {
    setShowFilters((open) => !open);
  };

  const onNameFilterChange = (value: string): void => {
    setFilterDraft((draft) => ({
      ...draft,
      savingsPassbookName: value,
    }));
  };

  const onCriterionChange = (field: CriterionField, key: 'op' | 'value', raw: string): void => {
    setFilterDraft((draft) => {
      const current = draft[field];
      const next: FilterCriterion =
        key === 'op'
          ? { op: isFilterOperator(raw) ? raw : '=', value: current.value }
          : { op: current.op, value: raw };
      return { ...draft, [field]: next };
    });
  };

  // A new filter set always restarts at the first page, keeping the current size
  const applyFilters = (event: FormEvent): void => {
    // Angular's (ngSubmit) prevented the browser default; React will not.
    event.preventDefault();
    setAppliedFilters(filterDraft);
    load(0, undefined, filterDraft);
  };

  const clearFilters = (): void => {
    const empty = emptySavingsPassbookFilters();
    setFilterDraft(empty);
    setAppliedFilters(empty);
    load(0, undefined, empty);
  };

  const openCreate = (): void => {
    setEditing(null);
    setShowForm(true);
  };

  const openDepositForm = (row: SavingsPassbook): void => {
    setDepositing(row);
    setShowDepositForm(true);
  };

  const openEdit = (row: SavingsPassbook): void => {
    setEditing(row);
    setShowForm(true);
  };

  const onSaved = (): void => {
    setShowForm(false);
    load();
  };

  const closeForm = (): void => {
    setShowForm(false);
  };

  // const openDeposit = (): void => {
  //   setDepositing(null);
  //   setShowDepositForm(true);
  // };

  const onDeposited = (): void => {
    setShowDepositForm(false);
    load();
  };

  const closeDepositForm = (): void => {
    setShowDepositForm(false);
  };

  const deletePassbook = (id: number): void => {
    remove(id).then(
      () => load(),
      (error: unknown) => setErrorMessage(getApiErrorMessage(error, GlobalMessages.genericError)),
    );
  };

  const confirmDelete = (row: SavingsPassbook): void => {
    useModalStore.getState().openConfirmation({
      title: 'Delete passbook',
      message: 'Delete this savings passbook? This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => deletePassbook(row.id),
    });
  };

  const toggleSelected = (id: number): void => {
    setSelectedIds((ids) => {
      const next = new Set(ids);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = (): void => {
    const rowIds = rows.map((row) => row.id);
    setSelectedIds((ids) => {
      const next = new Set(ids);
      if (rowIds.every((id) => next.has(id))) {
        rowIds.forEach((id) => next.delete(id));
      } else {
        rowIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const deleteSelected = (): void => {
    const ids = [...selectedIds];
    deleteMany(ids).then(
      () => {
        setSelectedIds(new Set());
        load();
      },
      (error: unknown) => setErrorMessage(getApiErrorMessage(error, GlobalMessages.genericError)),
    );
  };

  const confirmBulkDelete = (): void => {
    const count = selectedIds.size;
    if (count === 0) {
      return;
    }
    useModalStore.getState().openConfirmation({
      title: 'Delete passbooks',
      message: `Delete ${count} selected savings passbook${count === 1 ? '' : 's'}? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: deleteSelected,
    });
  };

  const estimatedProfitText = (
    estimatedMaturityProceeds: number | undefined | null,
    principalAmount: number,
  ): string => {
    if (estimatedMaturityProceeds === null || estimatedMaturityProceeds === undefined) {
      return '—';
    }
    const profit = estimatedMaturityProceeds - principalAmount;
    return formatNumber(profit);
  };

  return (
    <>
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">{t('menu.savingsPassbooks')}</h1>
          <p className="page-subtitle">Track bank passbooks, interest rates and deposits.</p>
        </div>

        <div className="page-toolbar">
          <button
            type="button"
            className="secondary-button filter-toggle"
            onClick={toggleFilters}
            aria-expanded={showFilters}
            aria-controls="passbook-filters"
          >
            Filters {activeFilterCount > 0 && <span className="filter-badge">{activeFilterCount}</span>}
          </button>
          {selectedCount > 0 && (
            <button
              type="button"
              className="table-button table-button--danger bulk-delete-button"
              onClick={confirmBulkDelete}
            >
              Delete selected ({selectedCount})
            </button>
          )}
          {/* <button type="button" className="secondary-button" onClick={openDeposit}>
            Additional Deposit
          </button> */}
          <button type="button" className="submit-button" onClick={openCreate}>
            Add Passbook
          </button>
        </div>

        {showFilters && (
          <form id="passbook-filters" className="filter-panel" onSubmit={applyFilters}>
            <div className="filter-panel__grid">
              <div className="form-group">
                <label htmlFor="filter-name">Name</label>
                <input
                  type="text"
                  id="filter-name"
                  name="filterName"
                  autoComplete="off"
                  placeholder="Part of passbook name"
                  value={filterDraft.savingsPassbookName}
                  onChange={(event) => onNameFilterChange(event.target.value)}
                />
                <p className="form-hint">Matches part of the name.</p>
              </div>

              <div className="form-group">
                <label htmlFor="filter-principal">Principal Amount</label>
                <div className="filter-controls">
                  <select
                    className="filter-operator"
                    id="filter-principal-op"
                    name="filterPrincipalOp"
                    aria-label="Principal amount operator"
                    value={filterDraft.principalAmount.op}
                    onChange={(event) => onCriterionChange('principalAmount', 'op', event.target.value)}
                  >
                    {operatorOptions.map((op) => (
                      <option key={op} value={op}>
                        {op}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    inputMode="decimal"
                    id="filter-principal"
                    name="filterPrincipal"
                    className="filter-controls__input"
                    placeholder="e.g. 1000000"
                    value={filterDraft.principalAmount.value}
                    onChange={(event) => onCriterionChange('principalAmount', 'value', event.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="filter-term">Deposit Term</label>
                <div className="filter-controls">
                  <select
                    className="filter-operator"
                    id="filter-term-op"
                    name="filterTermOp"
                    aria-label="Deposit term operator"
                    value={filterDraft.depositTerm.op}
                    onChange={(event) => onCriterionChange('depositTerm', 'op', event.target.value)}
                  >
                    {operatorOptions.map((op) => (
                      <option key={op} value={op}>
                        {op}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    inputMode="numeric"
                    id="filter-term"
                    name="filterTerm"
                    className="filter-controls__input"
                    placeholder="days"
                    value={filterDraft.depositTerm.value}
                    onChange={(event) => onCriterionChange('depositTerm', 'value', event.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="filter-rate">Interest Rate</label>
                <div className="filter-controls">
                  <select
                    className="filter-operator"
                    id="filter-rate-op"
                    name="filterRateOp"
                    aria-label="Interest rate operator"
                    value={filterDraft.interestRate.op}
                    onChange={(event) => onCriterionChange('interestRate', 'op', event.target.value)}
                  >
                    {operatorOptions.map((op) => (
                      <option key={op} value={op}>
                        {op}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    inputMode="decimal"
                    id="filter-rate"
                    name="filterRate"
                    className="filter-controls__input"
                    placeholder="e.g. 5.5"
                    value={filterDraft.interestRate.value}
                    onChange={(event) => onCriterionChange('interestRate', 'value', event.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="filter-maturity">Maturity Date</label>
                <div className="filter-controls">
                  <select
                    className="filter-operator"
                    id="filter-maturity-op"
                    name="filterMaturityOp"
                    aria-label="Maturity date operator"
                    value={filterDraft.maturityDate.op}
                    onChange={(event) => onCriterionChange('maturityDate', 'op', event.target.value)}
                  >
                    {operatorOptions.map((op) => (
                      <option key={op} value={op}>
                        {op}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    id="filter-maturity"
                    name="filterMaturity"
                    className="filter-controls__input"
                    value={filterDraft.maturityDate.value}
                    onChange={(event) => onCriterionChange('maturityDate', 'value', event.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="filter-withdrawal">Withdrawal Date</label>
                <div className="filter-controls">
                  <select
                    className="filter-operator"
                    id="filter-withdrawal-op"
                    name="filterWithdrawalOp"
                    aria-label="Withdrawal date operator"
                    value={filterDraft.withdrawalDate.op}
                    onChange={(event) => onCriterionChange('withdrawalDate', 'op', event.target.value)}
                  >
                    {operatorOptions.map((op) => (
                      <option key={op} value={op}>
                        {op}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    id="filter-withdrawal"
                    name="filterWithdrawal"
                    className="filter-controls__input"
                    value={filterDraft.withdrawalDate.value}
                    onChange={(event) => onCriterionChange('withdrawalDate', 'value', event.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="filter-proceeds">Est. Maturity Proceeds</label>
                <div className="filter-controls">
                  <select
                    className="filter-operator"
                    id="filter-proceeds-op"
                    name="filterProceedsOp"
                    aria-label="Estimated maturity proceeds operator"
                    value={filterDraft.estimatedMaturityProceeds.op}
                    onChange={(event) => onCriterionChange('estimatedMaturityProceeds', 'op', event.target.value)}
                  >
                    {operatorOptions.map((op) => (
                      <option key={op} value={op}>
                        {op}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    inputMode="decimal"
                    id="filter-proceeds"
                    name="filterProceeds"
                    className="filter-controls__input"
                    placeholder="e.g. 1150000"
                    value={filterDraft.estimatedMaturityProceeds.value}
                    onChange={(event) =>
                      onCriterionChange('estimatedMaturityProceeds', 'value', event.target.value)
                    }
                  />
                </div>
              </div>
            </div>
            <div className="filter-panel__actions">
              <button type="button" className="secondary-button" onClick={clearFilters}>
                Clear
              </button>
              <button type="submit" className="submit-button" disabled={loading}>
                Apply
              </button>
            </div>
          </form>
        )}
        {loading ? (
          <p className="loading-text">Loading…</p>
        ) : errorMessage ? (
          <p className="error-banner">{errorMessage}</p>
        ) : rows.length === 0 ? (
          hasActiveFilters ? (
            <div className="empty-state">
              <p>No savings passbooks match the current filters.</p>
              <button type="button" className="secondary-button" onClick={clearFilters}>
                Clear filters
              </button>
            </div>
          ) : (
            <p className="empty-state">No savings passbooks yet. Click "Add Passbook" to create one.</p>
          )
        ) : (
          <>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="table-select-head">
                      <input
                        type="checkbox"
                        className="table-select"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        aria-label="Select all rows on this page"
                      />
                    </th>
                    <th></th>
                    <th>Name</th>
                    <th>Principal Amount</th>
                    <th>Deposit Term</th>
                    <th>Interest Rate</th>
                    <th>Maturity Date</th>
                    <th>Withdrawal Date</th>
                    <th>Estimated Profit</th>
                    <th>Est. Maturity Proceeds</th>
                    <th>{t('common.created')}</th>
                    <th>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={row.id}>
                      <td className="table-select-cell">
                        <input
                          type="checkbox"
                          className="table-select"
                          checked={selectedIds.has(row.id)}
                          onChange={() => toggleSelected(row.id)}
                          aria-label={`Select row ${row.id}`}
                        />
                      </td>
                      <td>{index + 1}</td>
                      <td>{row.savingsPassbookName ? row.savingsPassbookName : '—'}</td>
                      <td>{formatNumber(row.principalAmount)}</td>
                      <td>{row.depositTerm}</td>
                      <td>{formatNumber(row.interestRate)}%</td>
                      <td>{customFormattedDate(row.maturityDate)}</td>
                      <td>{row.withdrawalDate ? customFormattedDate(row.withdrawalDate) : '—'}</td>
                      <td>{estimatedProfitText(row.estimatedMaturityProceeds, row.principalAmount)}</td>
                      <td>
                        {row.estimatedMaturityProceeds != null
                          ? formatNumber(row.estimatedMaturityProceeds)
                          : '—'}
                      </td>
                      <td>{customFormattedDate(row.createdAt)}</td>
                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            title="Additional Deposit"
                            className="table-button"
                            onClick={() => openDepositForm(row)}
                          >
                            <i className="icon-18 plus"></i>
                          </button>
                          <button type="button" title="Edit" className="table-button" onClick={() => openEdit(row)}>
                            <i className="icon-18 edit"></i>
                          </button>
                          <button
                            type="button"
                            title="Delete"
                            className="table-button table-button--danger"
                            onClick={() => confirmDelete(row)}
                          >
                            <i className="icon-18 trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={page}
              totalPages={totalPages}
              pageSize={pageSize}
              onPageChange={(nextPage) => load(nextPage)}
              onPageSizeChange={onPageSizeChange}
            />
          </>
        )}
      </div>

      {showForm && <SavingsPassbookForm passbook={editing} onSaved={onSaved} onClosed={closeForm} />}
      {showDepositForm && (
        <AdditionalDepositForm
          passbookNumber={depositing?.savingsPassbookNumber ?? null}
          onDeposited={onDeposited}
          onClosed={closeDepositForm}
        />
      )}
    </>
  );
}

export default SavingsPassbooks;
