import { useState } from 'react';
import { getAll, remove } from 'service/currency.service';
import { useModalStore } from 'store/modal-store';
import { useT } from 'store/language-store';
import { getApiErrorMessage } from 'util/api-util';
import { GlobalMessages } from 'component/shared/global-constants';
import { CurrencyForm } from 'component/currencies/currency-form/currency-form';
import type { Currency } from 'model/currency.model';
import { usePageTitle } from 'hooks/use-page-title';
import { useMountOnce } from 'hooks/use-mount-once';

// All page styles are global in src/scss/page.scss and src/scss/table.scss.
import './currencies.scss';

/**
 * Ported from Angular's Currencies: admin page — currency writes are ADMIN-only
 * on the backend; list is a plain array. Create/edit live in the CurrencyForm
 * modal child, mounted fresh per open (editing null means "create").
 */
export function Currencies() {
  usePageTitle('Currencies | Asset Manager');

  const t = useT();

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [rows, setRows] = useState<Currency[]>([]);

  // Form modal state — editing null means "create"
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Currency | null>(null);

  useMountOnce(() => {
    load();
  });

  const load = (): void => {
    setLoading(true);
    setErrorMessage('');
    getAll().then(
      (currencies) => {
        setRows(currencies);
        setLoading(false);
      },
      (error: unknown) => {
        setErrorMessage(getApiErrorMessage(error, GlobalMessages.genericError));
        setLoading(false);
      },
    );
  };

  const openCreate = (): void => {
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (row: Currency): void => {
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

  const confirmDelete = (row: Currency): void => {
    useModalStore.getState().openConfirmation({
      title: 'Delete currency',
      message: `Delete ${row.code}? Balances using it will keep their raw codes.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => deleteCurrency(row.code),
    });
  };

  const deleteCurrency = (code: string): void => {
    remove(code).then(
      () => load(),
      // A currency referenced by cash balances is rejected server-side.
      (error: unknown) =>
        setErrorMessage(getApiErrorMessage(error, GlobalMessages.genericError)),
    );
  };

  return (
    <>
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">{t('menu.currencies')}</h1>
          <p className="page-subtitle">
            Define the currencies used across cash balances.
          </p>
        </div>

        <div className="page-toolbar">
          <button type="button" className="submit-button" onClick={openCreate}>
            Add Currency
          </button>
        </div>

        {loading ? (
          <p className="loading-text">Loading…</p>
        ) : errorMessage ? (
          <p className="error-banner">{errorMessage}</p>
        ) : rows.length === 0 ? (
          <p className="empty-state">
            No currencies yet. Click &quot;Add Currency&quot; to create one.
          </p>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Symbol</th>
                  <th>Decimal Places</th>
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.code}>
                    <td>{row.code}</td>
                    <td>{row.name}</td>
                    <td>{row.symbol}</td>
                    <td>{row.decimalPlaces}</td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          title="Edit"
                          className="table-button"
                          onClick={() => openEdit(row)}
                        >
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
        )}
      </div>

      {showForm && (
        <CurrencyForm
          currency={editing}
          onSaved={onSaved}
          onClosed={closeForm}
        />
      )}
    </>
  );
}

export default Currencies;
