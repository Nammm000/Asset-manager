import { useCallback, useRef, useState } from 'react';
import { deleteMany, getAll, remove } from 'service/land-asset.service';
import { useModalStore } from 'store/modal-store';
import { useT } from 'store/language-store';
import { usePageTitle } from 'hooks/use-page-title';
import { useMountOnce } from 'hooks/use-mount-once';
import type { LandAsset } from 'model/asset.model';
import { Pagination } from 'component/shared/pagination/pagination';
import { LandAssetForm } from './land-asset-form/land-asset-form';
import { getApiErrorMessage } from 'util/api-util';
import { customFormattedDate, formatNumber } from 'util/time-util';
import { GlobalMessages } from 'component/shared/global-constants';

// All page styles are global in src/scss/page.scss and src/scss/table.scss.
import './land-assets.scss';

/**
 * Ported from Angular's LandAssets: paged table with page-scoped bulk-select
 * delete (selection cleared on every (re)load) and a create/edit form modal
 * mounted fresh per open (`showForm` conditional — a null `editing` means
 * "create").
 */
export function LandAssets() {
  usePageTitle('Land Assets | Asset Manager');
  const t = useT();

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [rows, setRows] = useState<LandAsset[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Row selection for bulk delete — page-scoped, cleared on every (re)load
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<number>>(new Set());
  const selectedCount = selectedIds.size;
  const allSelected = rows.length > 0 && rows.every((row) => selectedIds.has(row.id));

  // Form modal state — editing null means "create"
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<LandAsset | null>(null);

  // Angular's signals were always-current; refs let the stable load() read the
  // live page/size at call time (pagination jumps arrive via callbacks).
  const pageRef = useRef(page);
  const sizeRef = useRef(pageSize);
  pageRef.current = page;
  sizeRef.current = pageSize;

  const load = useCallback((targetPage?: number, targetSize?: number): void => {
    const nextPage = targetPage ?? pageRef.current;
    const nextSize = targetSize ?? sizeRef.current;
    setSelectedIds(new Set());
    setLoading(true);
    setErrorMessage('');
    getAll(nextPage, nextSize).then(
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
  }, []);

  useMountOnce(() => {
    load();
  });

  // Page indexes are size-dependent — a new size always restarts at page 0
  const onPageSizeChange = (size: number): void => {
    load(0, size);
  };

  const openCreate = (): void => {
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (row: LandAsset): void => {
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

  const deleteAsset = (id: number): void => {
    remove(id).then(
      () => load(),
      (error: unknown) => setErrorMessage(getApiErrorMessage(error, GlobalMessages.genericError)),
    );
  };

  const confirmDelete = (row: LandAsset): void => {
    useModalStore.getState().openConfirmation({
      title: 'Delete land asset',
      message: `Delete the land at "${row.location}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => deleteAsset(row.id),
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
      title: 'Delete land assets',
      message: `Delete ${count} selected land asset${count === 1 ? '' : 's'}? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: deleteSelected,
    });
  };

  return (
    <>
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">{t('menu.landAssets')}</h1>
          <p className="page-subtitle">Manage land holdings, purchases and sales.</p>
        </div>

        <div className="page-toolbar">
          {selectedCount > 0 && (
            <button
              type="button"
              className="table-button table-button--danger bulk-delete-button"
              onClick={confirmBulkDelete}
            >
              Delete selected ({selectedCount})
            </button>
          )}
          <button type="button" className="submit-button" onClick={openCreate}>
            Add Land Asset
          </button>
        </div>

        {loading ? (
          <p className="loading-text">Loading…</p>
        ) : errorMessage ? (
          <p className="error-banner">{errorMessage}</p>
        ) : rows.length === 0 ? (
          <p className="empty-state">No land assets yet. Click "Add Land Asset" to create one.</p>
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
                    <th>Location</th>
                    <th>Area (m²)</th>
                    <th>Purchase Date</th>
                    <th>Sale Date</th>
                    <th>{t('common.created')}</th>
                    <th>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
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
                      <td>{row.location}</td>
                      <td>{formatNumber(row.area)}</td>
                      <td>{customFormattedDate(row.purchaseDate)}</td>
                      <td>{row.saleDate ? customFormattedDate(row.saleDate) : '—'}</td>
                      <td>{customFormattedDate(row.createdAt)}</td>
                      <td>
                        <div className="table-actions">
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

      {showForm && <LandAssetForm asset={editing} onSaved={onSaved} onClosed={closeForm} />}
    </>
  );
}

export default LandAssets;
