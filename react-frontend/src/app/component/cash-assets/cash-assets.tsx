import { Fragment, useCallback, useState } from 'react';
import {
  deleteMany,
  getAll as getAllCashAssets,
  getById as getCashAssetById,
  remove as removeCashAsset,
} from 'service/cash-asset.service';
import { getAll as getAllCurrencies } from 'service/currency.service';
import { useModalStore } from 'store/modal-store';
import { useT } from 'store/language-store';
import type { CashAsset } from 'model/asset.model';
import type { Currency } from 'model/currency.model';
import { Pagination } from 'component/shared/pagination/pagination';
import { CashAssetForm } from './cash-asset-form/cash-asset-form';
import { CashAssetBalances } from './cash-asset-balances/cash-asset-balances';
import { getApiErrorMessage } from 'util/api-util';
import { customFormattedDate } from 'util/time-util';
import { GlobalMessages } from 'component/shared/global-constants';
import { usePageTitle } from 'hooks/use-page-title';
import { useMountOnce } from 'hooks/use-mount-once';

// All page styles are global in src/scss/page.scss and src/scss/table.scss.
import './cash-assets.scss';

/**
 * Cash wallets (ported from Angular's CashAssets). There is no update on the
 * backend, so the page offers only create (name/description are required on
 * create but never returned — rows fall back to "Cash Wallet #id") and delete.
 * Balances live in an expandable detail row, fetched per wallet via getById
 * (the paged list omits them) and cached in balancesById.
 */
export function CashAssets() {
  usePageTitle('Cash Assets | Asset Manager');

  const t = useT();

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [rows, setRows] = useState<CashAsset[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Row selection for bulk delete — page-scoped, cleared on every (re)load
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<number>>(new Set());
  const selectedCount = selectedIds.size;
  const allSelected = rows.length > 0 && rows.every((row) => selectedIds.has(row.id));

  // Form modal state — editing null means "create" (there is no edit)
  const [showForm, setShowForm] = useState(false);

  // Expanded wallet detail rows
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [balancesById, setBalancesById] = useState<Record<number, CashAsset>>({});

  // Currency metadata for symbol display — read is any JWT user, failures are non-fatal
  const [currencies, setCurrencies] = useState<Currency[]>([]);

  const load = useCallback(
    (nextPage: number = page, nextSize: number = pageSize): void => {
      setSelectedIds(new Set());
      setLoading(true);
      setErrorMessage('');
      getAllCashAssets(nextPage, nextSize).then(
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
    [page, pageSize],
  );

  // ngOnInit: initial page load + currency metadata (failures are non-fatal —
  // balances still render by code).
  useMountOnce(() => {
    load();
    getAllCurrencies().then(
      (list) => setCurrencies(list),
      () => setCurrencies([]),
    );
  });

  // Page indexes are size-dependent — a new size always restarts at page 0
  const onPageSizeChange = (size: number): void => {
    load(0, size);
  };

  const openCreate = (): void => {
    setShowForm(true);
  };

  const onSaved = (): void => {
    setShowForm(false);
    load();
  };

  const closeForm = (): void => {
    setShowForm(false);
  };

  const fetchBalances = useCallback((id: number): void => {
    getCashAssetById(id).then(
      (wallet) => setBalancesById((map) => ({ ...map, [id]: wallet })),
      (error: unknown) => setErrorMessage(getApiErrorMessage(error, GlobalMessages.genericError)),
    );
  }, []);

  const toggleBalances = (wallet: CashAsset): void => {
    const id = wallet.id;
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!balancesById[id]) {
      fetchBalances(id);
    }
  };

  const onBalancesChanged = (id: number): void => {
    fetchBalances(id);
  };

  const confirmDelete = (wallet: CashAsset): void => {
    useModalStore.getState().openConfirmation({
      title: 'Delete cash wallet',
      message: `Delete this wallet and all its balances? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => deleteWallet(wallet.id),
    });
  };

  const deleteWallet = (id: number): void => {
    removeCashAsset(id).then(
      () => {
        setExpandedId((current) => (current === id ? null : current));
        load();
      },
      (error: unknown) => setErrorMessage(getApiErrorMessage(error, GlobalMessages.genericError)),
    );
  };

  const isSelected = (id: number): boolean => selectedIds.has(id);

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

  const confirmBulkDelete = (): void => {
    const count = selectedIds.size;
    if (count === 0) {
      return;
    }
    useModalStore.getState().openConfirmation({
      title: 'Delete cash wallets',
      message: `Delete ${count} selected wallet${count === 1 ? '' : 's'} and all their balances? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: deleteSelected,
    });
  };

  const deleteSelected = (): void => {
    const ids = [...selectedIds];
    deleteMany(ids).then(
      () => {
        setExpandedId((expanded) => (expanded !== null && ids.includes(expanded) ? null : expanded));
        setBalancesById((map) => {
          const next = { ...map };
          ids.forEach((id) => delete next[id]);
          return next;
        });
        setSelectedIds(new Set());
        load();
      },
      (error: unknown) => setErrorMessage(getApiErrorMessage(error, GlobalMessages.genericError)),
    );
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">{t('menu.cashAssets')}</h1>
        <p className="page-subtitle">Cash wallets and their per-currency balances.</p>
      </div>

      <div className="page-toolbar">
        {selectedCount > 0 && (
          <button type="button" className="table-button table-button--danger bulk-delete-button" onClick={confirmBulkDelete}>
            Delete selected ({selectedCount})
          </button>
        )}
        <button type="button" className="submit-button" onClick={openCreate}>
          Add Cash Wallet
        </button>
      </div>

      {loading ? (
        <p className="loading-text">Loading…</p>
      ) : errorMessage ? (
        <p className="error-banner">{errorMessage}</p>
      ) : !rows.length ? (
        <p className="empty-state">No cash wallets yet. Click "Add Cash Wallet" to create one.</p>
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
                  <th>Wallet</th>
                  <th>Description</th>
                  <th>{t('common.created')}</th>
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const detail = balancesById[row.id] ?? null;
                  return (
                    <Fragment key={row.id}>
                      <tr>
                        <td className="table-select-cell">
                          <input
                            type="checkbox"
                            className="table-select"
                            checked={isSelected(row.id)}
                            onChange={() => toggleSelected(row.id)}
                            aria-label={`Select row ${row.id}`}
                          />
                        </td>
                        <td>Wallet: {row.name}</td>
                        <td>{row.description}</td>
                        <td>{customFormattedDate(row.createdAt)}</td>
                        <td>
                          <div className="table-actions">
                            <button type="button" className="table-button" onClick={() => toggleBalances(row)}>
                              {expandedId === row.id ? 'Hide Balances' : 'Balances'}
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
                      {expandedId === row.id && (
                        <tr className="table-detail-row">
                          <td colSpan={5}>
                            {detail ? (
                              <CashAssetBalances
                                wallet={detail}
                                currencies={currencies}
                                onChanged={() => onBalancesChanged(row.id)}
                              />
                            ) : (
                              <p className="loading-text">Loading balances…</p>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
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

      {showForm && <CashAssetForm onSaved={onSaved} onClosed={closeForm} />}
    </div>
  );
}

export default CashAssets;
