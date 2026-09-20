import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { jsonResponse } from '../../../test/helpers';
import type { CashAssets as CashAssetsComponent } from 'component/cash-assets/cash-assets';
import type {
  CashAssetBalances as CashAssetBalancesComponent,
} from 'component/cash-assets/cash-asset-balances/cash-asset-balances';
import type { useModalStore as ModalStore } from 'store/modal-store';
import type { CashAsset, CashBalance } from 'model/asset.model';
import type { Currency } from 'model/currency.model';

// Ported from cash-assets.spec.ts (CashAssets page + CashAssetBalances child):
// TestBed → RTL render, HttpTestingController → stubbed fetch, the balances
// child rendered directly with its props. The page's mount effect fires the
// wallet list and the currency list, in that order — responses queue in order.
const BASE_URL = 'http://localhost:8082';
const WALLETS_URL = `${BASE_URL}/cash-assets`;

const currencies: Currency[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$', decimalPlaces: 2 },
  { code: 'VND', name: 'Vietnamese Dong', symbol: '₫', decimalPlaces: 0 },
];

const walletRow = (id: number): CashAsset => ({
  id,
  userId: 1,
  assetType: 'CASH',
  createdAt: '2026-02-01T10:00:00',
});

const balance = (id: number, code: string, amount: number): CashBalance => ({
  id,
  cashAssetId: 7,
  currencyCode: code,
  amount,
});

const paged = (content: CashAsset[]) => ({
  content,
  page: 0,
  size: 10,
  totalElements: content.length,
  totalPages: 1,
  first: true,
  last: true,
});

let CashAssets: typeof CashAssetsComponent;
let CashAssetBalances: typeof CashAssetBalancesComponent;
let modalStore: typeof ModalStore;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  localStorage.clear();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.resetModules();
  ({ CashAssets } = await import('component/cash-assets/cash-assets'));
  ({ CashAssetBalances } = await import('component/cash-assets/cash-asset-balances/cash-asset-balances'));
  ({ useModalStore: modalStore } = await import('store/modal-store'));
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

/** GET /cash-assets/{id} calls (the balances detail fetch). */
function detailCalls(): unknown[][] {
  return fetchMock.mock.calls.filter(([url, init]) => {
    const path = new URL(String(url)).pathname;
    return init.method === 'GET' && /^\/cash-assets\/\d+$/.test(path);
  });
}

describe('CashAssets (page)', () => {
  it('loads wallets and currencies on init', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(paged([walletRow(7)])))
      .mockResolvedValueOnce(jsonResponse(currencies));
    render(<CashAssets />);

    expect(await screen.findByText(/Wallet:/)).toBeInTheDocument();
    // currencies() is only observable through the balances child: expanding the
    // wallet renders the symbol label from the fetched currency metadata.
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ ...walletRow(7), balances: [balance(1, 'USD', 100)] }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Balances' }));
    expect(await screen.findByText('USD ($)')).toBeInTheDocument();
  });

  it('survives a currency-list failure', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(paged([walletRow(7)])))
      .mockResolvedValueOnce(jsonResponse({ status: 500, message: 'Boom', timeStamp: 0 }, 500));
    render(<CashAssets />);

    expect(await screen.findByText(/Wallet:/)).toBeInTheDocument();
    expect(screen.queryByText('Boom')).toBeNull(); // non-fatal by design
    expect(screen.queryByText(/Something went wrong/)).toBeNull();
  });

  it('fetches and caches balances when a wallet is expanded', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(paged([walletRow(7)])))
      .mockResolvedValueOnce(jsonResponse(currencies));
    render(<CashAssets />);
    await screen.findByText(/Wallet:/);

    fetchMock.mockResolvedValueOnce(
      jsonResponse({ ...walletRow(7), balances: [balance(1, 'USD', 100)] }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Balances' }));
    // expandedId() === 7 — the toggle flips to "Hide Balances" and the fetch fires.
    expect(await screen.findByText('USD ($)')).toBeInTheDocument();
    expect(detailCalls()).toHaveLength(1);

    // Collapsing and re-expanding reuses the cache — no second getById.
    await userEvent.click(screen.getByRole('button', { name: 'Hide Balances' }));
    expect(screen.queryByText('USD ($)')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Balances' }));
    expect(await screen.findByText('USD ($)')).toBeInTheDocument();
    expect(detailCalls()).toHaveLength(1);
  });

  it('deletes a wallet after confirmation', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(paged([walletRow(7)])))
      .mockResolvedValueOnce(jsonResponse(currencies));
    render(<CashAssets />);
    await screen.findByText(/Wallet:/);

    await userEvent.click(screen.getByTitle('Delete'));
    const request = modalStore.getState().confirmation!;
    expect(request.danger).toBe(true);

    fetchMock
      .mockResolvedValueOnce(jsonResponse({ messag: 'Deleted' })) // DELETE
      .mockResolvedValueOnce(jsonResponse(paged([]))); // reload
    await act(async () => {
      request.onConfirm();
    });

    expect(await screen.findByText(/No cash wallets yet/)).toBeInTheDocument();
    const del = fetchMock.mock.calls.find(([, init]) => init.method === 'DELETE')!;
    expect(String(del[0])).toBe(`${WALLETS_URL}/7`);
  });

  it('bulk-deletes wallets, collapsing the expanded one and evicting its cache', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(paged([walletRow(7), walletRow(8), walletRow(9)])))
      .mockResolvedValueOnce(jsonResponse(currencies));
    render(<CashAssets />);
    expect(await screen.findAllByText(/Wallet:/)).toHaveLength(3);

    // Expand 7 so its detail row and balances cache exist, then select 7 and 9.
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ ...walletRow(7), balances: [balance(1, 'USD', 100)] }),
    );
    await userEvent.click(screen.getAllByRole('button', { name: 'Balances' })[0]!);
    expect(await screen.findByText('USD ($)')).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Select row 7'));
    await userEvent.click(screen.getByLabelText('Select row 9'));
    await userEvent.click(screen.getByRole('button', { name: 'Delete selected (2)' }));
    const request = modalStore.getState().confirmation!;
    expect(request.danger).toBe(true);

    fetchMock
      .mockResolvedValueOnce(jsonResponse({ messag: 'Deleted' })) // DELETE bulk
      .mockResolvedValueOnce(jsonResponse(paged([walletRow(8)]))); // reload
    await act(async () => {
      request.onConfirm();
    });

    await waitFor(() => expect(screen.getAllByText(/Wallet:/)).toHaveLength(1));
    expect(screen.queryByRole('button', { name: 'Delete selected (2)' })).toBeNull(); // selection cleared
    expect(screen.queryByText('USD ($)')).toBeNull(); // the expanded wallet was deleted
    expect(screen.queryByRole('button', { name: 'Hide Balances' })).toBeNull(); // expandedId() reset
    // detailFor(7) === null: the Angular spec asserted the cache eviction
    // directly; the visible mirror is the detail row vanishing with the row.
    const bulk = fetchMock.mock.calls.find(([, init]) => init.method === 'DELETE')!;
    expect(String(bulk[0])).toBe(`${WALLETS_URL}/bulk`);
    expect(JSON.parse(bulk[1].body as string)).toEqual({ ids: [7, 9] });
  });

  it('toggles the whole page via select-all', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(paged([walletRow(7), walletRow(8)])))
      .mockResolvedValueOnce(jsonResponse(currencies));
    render(<CashAssets />);
    await screen.findAllByText(/Wallet:/);

    const selectAll = screen.getByLabelText('Select all rows on this page');
    await userEvent.click(selectAll);
    expect(selectAll).toBeChecked();
    expect(screen.getByLabelText('Select row 7')).toBeChecked();
    expect(screen.getByLabelText('Select row 8')).toBeChecked();
    expect(screen.getByRole('button', { name: 'Delete selected (2)' })).toBeInTheDocument();

    await userEvent.click(selectAll);
    expect(selectAll).not.toBeChecked();
    expect(screen.getByLabelText('Select row 7')).not.toBeChecked();
    expect(screen.getByLabelText('Select row 8')).not.toBeChecked();
    expect(screen.queryByRole('button', { name: 'Delete selected (2)' })).toBeNull();
  });
});

describe('CashAssetBalances (child)', () => {
  const walletWithUsd: CashAsset = {
    ...walletRow(7),
    balances: [balance(1, 'USD', 100)],
  };

  function renderBalances(wallet: CashAsset = walletWithUsd, onChanged: () => void = vi.fn()): void {
    render(<CashAssetBalances wallet={wallet} currencies={currencies} onChanged={onChanged} />);
  }

  it('hides already-held currencies from the add dropdown', async () => {
    renderBalances();

    await userEvent.click(screen.getByRole('button', { name: 'Add Balance' }));
    const select = screen.getByLabelText('Currency') as HTMLSelectElement;
    expect(Array.from(select.options).map((option) => option.value)).toEqual(['VND']); // USD is held
  });

  it('labels held currencies with their symbol', () => {
    // The Angular spec called currencyLabel() directly; the DOM equivalent renders
    // one held code and one unknown code side by side.
    renderBalances({ ...walletRow(7), balances: [balance(1, 'USD', 100), balance(3, 'XXX', 5)] });

    expect(screen.getByText('USD ($)')).toBeInTheDocument();
    expect(screen.getByText('XXX')).toBeInTheDocument(); // unknown code falls back to the bare code
  });

  it('adds a balance with the wallet id and chosen currency', async () => {
    const onChanged = vi.fn();
    renderBalances(walletWithUsd, onChanged);

    await userEvent.click(screen.getByRole('button', { name: 'Add Balance' }));
    await userEvent.selectOptions(screen.getByLabelText('Currency'), 'VND');
    await userEvent.type(screen.getByLabelText('Amount'), '250000');
    fetchMock.mockResolvedValueOnce(jsonResponse(balance(2, 'VND', 250_000)));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onChanged).toHaveBeenCalled()); // the page refetches the wallet
    const post = fetchMock.mock.calls.find(([, init]) => init.method === 'POST')!;
    expect(String(post[0])).toBe(`${BASE_URL}/cash-balances`);
    expect(JSON.parse(post[1].body as string)).toEqual({
      cashAssetId: 7,
      currencyCode: 'VND',
      amount: 250_000,
    });
    expect(screen.queryByRole('dialog')).toBeNull(); // modal closed on success
  });

  it('adjusts with a negative amount when subtracting', async () => {
    const onChanged = vi.fn();
    renderBalances(walletWithUsd, onChanged);

    await userEvent.click(screen.getByRole('button', { name: 'Adjust' }));
    await userEvent.type(screen.getByLabelText('Amount'), '30');
    await userEvent.selectOptions(screen.getByLabelText('Direction'), 'subtract');
    fetchMock.mockResolvedValueOnce(jsonResponse(balance(1, 'USD', 70)));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    const post = fetchMock.mock.calls.find(([, init]) => init.method === 'POST')!;
    expect(String(post[0])).toBe(`${BASE_URL}/cash-balances/1`);
    expect(JSON.parse(post[1].body as string)).toEqual({ currencyCode: 'USD', amount: -30 });
  });

  it('sets the absolute amount via PUT', async () => {
    const onChanged = vi.fn();
    renderBalances(walletWithUsd, onChanged);

    await userEvent.click(screen.getByRole('button', { name: 'Set Amount' }));
    await userEvent.type(screen.getByLabelText('New Amount'), '500');
    fetchMock.mockResolvedValueOnce(jsonResponse(balance(1, 'USD', 500)));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    const put = fetchMock.mock.calls.find(([, init]) => init.method === 'PUT')!;
    expect(String(put[0])).toBe(`${BASE_URL}/cash-balances/1`);
    expect(JSON.parse(put[1].body as string)).toEqual({ amount: 500 });
  });

  it('deletes a balance after confirmation', async () => {
    const onChanged = vi.fn();
    renderBalances(walletWithUsd, onChanged);

    await userEvent.click(screen.getByTitle('Delete'));
    const request = modalStore.getState().confirmation!;
    expect(request.danger).toBe(true);

    fetchMock.mockResolvedValueOnce(jsonResponse({ messag: 'Deleted' }));
    await act(async () => {
      request.onConfirm();
    });

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    const del = fetchMock.mock.calls.find(([, init]) => init.method === 'DELETE')!;
    expect(String(del[0])).toBe(`${BASE_URL}/cash-balances/1`);
  });
});
