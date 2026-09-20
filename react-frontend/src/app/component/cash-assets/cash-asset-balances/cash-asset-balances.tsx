import { useState, type FormEvent } from 'react';
import { adjust, create, remove, setAmount as setBalanceAmount } from 'service/cash-balance.service';
import { useModalStore } from 'store/modal-store';
import { useT } from 'store/language-store';
import type { CashAsset, CashBalance } from 'model/asset.model';
import type { Currency } from 'model/currency.model';
import { getApiErrorMessage } from 'util/api-util';
import { formatNumber } from 'util/time-util';
import { GlobalMessages } from 'component/shared/global-constants';
import { useAutoHideScrollbar } from 'hooks/use-auto-hide-scrollbar';

import './cash-asset-balances.scss';

type BalanceModalMode = 'add' | 'adjust' | 'set';

/**
 * Per-wallet balance management (ported from Angular's CashAssetBalances),
 * rendered inside the expanded detail row of the cash-assets table. Mutations
 * go through the cash-balance service and call `onChanged` so the page
 * refetches the wallet (balances only come back from getById, not the paged
 * list).
 *
 * Backend rules: a wallet holds at most one balance per currency (duplicates
 * are already filtered out of the add dropdown); "adjust" adds a signed
 * amount and must repeat the balance's currencyCode; "set" writes an absolute
 * amount >= 0.
 */
export interface CashAssetBalancesProps {
  wallet: CashAsset;
  currencies: Currency[];
  onChanged: () => void;
}

export function CashAssetBalances({ wallet, currencies, onChanged }: CashAssetBalancesProps) {
  const t = useT();

  const balances = wallet.balances ?? [];

  /** Currencies not yet held — the (cashAsset, currency) pair is unique server-side. */
  const heldCodes = new Set(balances.map((balance) => balance.currencyCode));
  const availableCurrencies = currencies.filter((currency) => !heldCodes.has(currency.code));

  // Modal state — one small modal serves add/adjust/set
  const [mode, setMode] = useState<BalanceModalMode | null>(null);
  const [target, setTarget] = useState<CashBalance | null>(null);
  const [currencyCode, setCurrencyCode] = useState('');
  const [amount, setAmount] = useState<number | null>(null);
  const [direction, setDirection] = useState<'add' | 'subtract'>('add');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const isAmountValid = (() => {
    if (amount === null) {
      return false;
    }
    return mode === 'adjust' ? amount > 0 : amount >= 0;
  })();

  const canSubmit =
    isAmountValid && (mode === 'add' ? currencyCode !== '' : target !== null);

  const containerRef = useAutoHideScrollbar<HTMLDivElement>();

  const currencyFor = (code: string): Currency | undefined => {
    return currencies.find((currency) => currency.code === code);
  };

  const currencyLabel = (code: string): string => {
    const currency = currencyFor(code);
    return currency ? `${code} (${currency.symbol})` : code;
  };

  const openAdd = (): void => {
    setMode('add');
    setTarget(null);
    setCurrencyCode(availableCurrencies[0]?.code ?? '');
    setAmount(null);
    setDirection('add');
    setErrorMessage('');
  };

  const openAdjust = (balance: CashBalance): void => {
    setMode('adjust');
    setTarget(balance);
    setAmount(null);
    setDirection('add');
    setErrorMessage('');
  };

  const openSet = (balance: CashBalance): void => {
    setMode('set');
    setTarget(balance);
    setAmount(null);
    setErrorMessage('');
  };

  const closeModal = (): void => {
    setMode(null);
    setTarget(null);
    setSubmitting(false);
    setErrorMessage('');
  };

  const confirmDelete = (balance: CashBalance): void => {
    useModalStore.getState().openConfirmation({
      title: 'Delete balance',
      message: `Delete the ${balance.currencyCode} balance from this wallet?`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => deleteBalance(balance.id),
    });
  };

  const submit = (event: FormEvent): void => {
    // Angular's ngSubmit prevented the browser default natively; React does not.
    event.preventDefault();
    if (!canSubmit || submitting || mode === null || amount === null) {
      return;
    }
    setSubmitting(true);
    setErrorMessage('');

    const walletId = wallet.id;
    // canSubmit guarantees a target in adjust/set mode; the null arm below is
    // only for TypeScript's benefit.
    const targetBalance = target;

    let call: Promise<CashBalance>;
    if (mode === 'add') {
      call = create({
        cashAssetId: walletId,
        currencyCode,
        amount,
      });
    } else if (targetBalance !== null) {
      call =
        mode === 'adjust'
          ? adjust(targetBalance.id, {
              currencyCode: targetBalance.currencyCode,
              amount: direction === 'subtract' ? -amount : amount,
            })
          : setBalanceAmount(targetBalance.id, amount);
    } else {
      return;
    }

    call.then(
      () => {
        closeModal();
        onChanged();
      },
      (error: unknown) => {
        setSubmitting(false);
        setErrorMessage(getApiErrorMessage(error, GlobalMessages.genericError));
      },
    );
  };

  const deleteBalance = (id: number): void => {
    remove(id).then(
      () => onChanged(),
      (error: unknown) => setErrorMessage(getApiErrorMessage(error, GlobalMessages.genericError)),
    );
  };

  return (
    <div className="balances">
      <div className="balances__header">
        <h3 className="balances__title">Balances</h3>
        <button type="button" className="table-button" onClick={openAdd} disabled={!availableCurrencies.length}>
          Add Balance
        </button>
      </div>

      {!balances.length ? (
        <p className="empty-state">No balances in this wallet yet.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th></th>
              <th>Currency</th>
              <th>Amount</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {balances.map((balance, index) => (
              <tr key={balance.id}>
                <td>{index + 1}</td>
                <td>{currencyLabel(balance.currencyCode)}</td>
                <td>{formatNumber(balance.amount)}</td>
                <td>
                  <div className="table-actions">
                    <button type="button" className="table-button" onClick={() => openAdjust(balance)}>
                      Adjust
                    </button>
                    <button type="button" className="table-button" onClick={() => openSet(balance)}>
                      Set Amount
                    </button>
                    <button
                      type="button"
                      title="Delete"
                      className="table-button table-button--danger"
                      onClick={() => confirmDelete(balance)}
                    >
                      <i className="icon-18 trash"></i>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {errorMessage && <p className="error-banner">{errorMessage}</p>}

      {mode && (
        <>
          {/* Backdrop */}
          <div className="modal-backdrop" onClick={closeModal}></div>

          {/* Modal Content */}
          <div
            className="modal-container modal-container--sm"
            ref={containerRef}
            role="dialog"
            aria-modal="true"
            aria-label={mode === 'add' ? 'Add balance' : mode === 'adjust' ? 'Adjust balance' : 'Set balance'}
          >
            <div className="modal-header form-header">
              <h2 className="modal-title">
                {mode === 'add' ? 'Add Balance' : mode === 'adjust' ? 'Adjust Balance' : 'Set Balance Amount'}
              </h2>
              <button className="close-button" type="button" onClick={closeModal} aria-label="Close">
                <span className="close-icon">&times;</span>
              </button>
            </div>

            <div className="modal-content form-content">
              <form className="modal-form" onSubmit={submit}>
                {mode === 'add' ? (
                  <div className="form-group">
                    <label htmlFor="balance-currency">Currency</label>
                    <select
                      id="balance-currency"
                      name="currencyCode"
                      value={currencyCode}
                      onChange={(event) => setCurrencyCode(event.target.value)}
                      required
                    >
                      {availableCurrencies.map((currency) => (
                        <option key={currency.code} value={currency.code}>
                          {currency.code} — {currency.name}
                        </option>
                      ))}
                    </select>
                    {!availableCurrencies.length && (
                      <p className="form-hint">Every known currency is already in this wallet.</p>
                    )}
                  </div>
                ) : (
                  <p className="form-hint">
                    {target?.currencyCode} balance — current amount {target ? formatNumber(target.amount) : ''}.
                  </p>
                )}

                {mode === 'adjust' && (
                  <div className="form-group">
                    <label htmlFor="balance-direction">Direction</label>
                    <select
                      id="balance-direction"
                      name="direction"
                      value={direction}
                      onChange={(event) => setDirection(event.target.value as 'add' | 'subtract')}
                    >
                      <option value="add">Add</option>
                      <option value="subtract">Subtract</option>
                    </select>
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="balance-amount">{mode === 'set' ? 'New Amount' : 'Amount'}</label>
                  <input
                    type="number"
                    id="balance-amount"
                    name="amount"
                    value={amount ?? ''}
                    onChange={(event) => setAmount(event.target.value === '' ? null : Number(event.target.value))}
                    required
                    min={0}
                    className={isAmountValid || amount === null ? '' : 'error'}
                  />
                  {!isAmountValid && amount !== null && (
                    <p className="error-message">
                      {mode === 'adjust' ? 'Amount must be greater than 0' : 'Amount must be 0 or more'}
                    </p>
                  )}
                </div>

                {errorMessage && <p className="error-message">{errorMessage}</p>}

                <div className="modal-actions">
                  <button type="button" className="secondary-button" onClick={closeModal}>
                    Cancel
                  </button>
                  <button type="submit" className="submit-button" disabled={!canSubmit || submitting}>
                    {submitting ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
