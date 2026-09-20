import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { jsonResponse, makeToken } from '../../../test/helpers';
import type { SavingsPassbooks as SavingsPassbooksComponent } from 'component/savings-passbooks/savings-passbooks';
import type {
  AdditionalDepositForm as AdditionalDepositFormComponent,
} from 'component/savings-passbooks/additional-deposit-form/additional-deposit-form';
import type { useAuthStore as AuthStore } from 'store/auth-store';
import type { useModalStore as ModalStore } from 'store/modal-store';
import type { SavingsPassbook } from 'model/asset.model';

// Ported from savings-passbooks.spec.ts (SavingsPassbooks + AdditionalDepositForm
// suites): TestBed → RTL render (list loads on mount), HttpTestingController →
// stubbed fetch, AuthService/ModalService → zustand stores. Component-method
// drives (filterDraft.set/applyFilters/load/toggleSelected/…) become the filter
// panel inputs, the pagination controls and the row checkboxes.
const BASE_URL = 'http://localhost:8082';
const LIST_URL = `${BASE_URL}/savings-passbooks`;
const SEARCH_URL = `${LIST_URL}/search`;

const row = (id: number): SavingsPassbook => ({
  id,
  userId: 1,
  savingsPassbookName: 'Main passbook',
  principalAmount: 10_000_000,
  savingsPassbookNumber: 'SP-001',
  depositTerm: 360,
  interestRate: 5.5,
  maturityDate: '2027-01-01T00:00:00.000Z',
  assetType: 'SAVINGS_PASSBOOK',
  createdAt: '2026-01-10T10:00:00',
});

const paged = (content: SavingsPassbook[], overrides: Partial<Record<string, unknown>> = {}) => ({
  content,
  page: 0,
  size: 10,
  totalElements: content.length,
  totalPages: 1,
  first: true,
  last: true,
  ...overrides,
});

const currentUser = {
  id: 1,
  name: 'Saver',
  email: 'saver@test.com',
  phone: '0123456789',
  status: 'true',
  role: 'ROLE_USER',
  accountNumber: 'ACC-7',
};

let SavingsPassbooks: typeof SavingsPassbooksComponent;
let AdditionalDepositForm: typeof AdditionalDepositFormComponent;
let authStore: typeof AuthStore;
let modalStore: typeof ModalStore;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  localStorage.clear();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.resetModules();
  ({ SavingsPassbooks } = await import('component/savings-passbooks/savings-passbooks'));
  ({ AdditionalDepositForm } = await import(
    'component/savings-passbooks/additional-deposit-form/additional-deposit-form'
  ));
  ({ useAuthStore: authStore } = await import('store/auth-store'));
  ({ useModalStore: modalStore } = await import('store/modal-store'));
  // Seed the in-memory session before the components read it (tokens are never persisted).
  authStore.getState().applyAuthenticationResponse({
    accessToken: makeToken({ sub: 'saver@test.com', role: 'ROLE_USER' }),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

function searchCalls(): URL[] {
  return fetchMock.mock.calls
    .map(([url]) => new URL(String(url)))
    .filter((url) => url.pathname === '/savings-passbooks/search');
}

function lastSearchCall(): URL {
  return searchCalls()[searchCalls().length - 1]!;
}

describe('SavingsPassbooks', () => {
  it('loads the first page on init', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(paged([row(1), row(2)])));
    render(<SavingsPassbooks />);

    expect(await screen.findAllByText('Main passbook')).toHaveLength(2);
    expect(screen.queryByText('Loading…')).toBeNull();
  });

  it('reloads from the first page when the page size changes', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(paged([row(1)], { page: 2, totalPages: 3 })));
    render(<SavingsPassbooks />);
    await screen.findByText('Main passbook');

    fetchMock.mockResolvedValueOnce(jsonResponse(paged([row(1)], { size: 20, totalPages: 3 })));
    await userEvent.selectOptions(screen.getByLabelText('Rows per page'), '20');

    await waitFor(() => expect(screen.getByLabelText('Rows per page')).toHaveValue('20'));
    const reload = new URL(String(fetchMock.mock.calls[1]![0]));
    expect(reload.pathname).toBe('/savings-passbooks');
    expect(reload.searchParams.get('page')).toBe('0');
    expect(reload.searchParams.get('size')).toBe('20');
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument(); // page() === 0
  });

  it('deletes after confirmation and reloads', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(paged([row(1)])));
    render(<SavingsPassbooks />);
    await screen.findByText('Main passbook');

    await userEvent.click(screen.getByTitle('Delete'));
    const request = modalStore.getState().confirmation!;
    expect(request.danger).toBe(true);

    fetchMock
      .mockResolvedValueOnce(jsonResponse({ messag: 'Deleted' })) // DELETE
      .mockResolvedValueOnce(jsonResponse(paged([]))); // reload
    await act(async () => {
      request.onConfirm();
    });

    expect(await screen.findByText(/No savings passbooks yet/)).toBeInTheDocument();
    const del = fetchMock.mock.calls.find(([, init]) => init.method === 'DELETE')!;
    expect(String(del[0])).toBe(`${LIST_URL}/1`);
  });

  it('bulk-deletes the selection after confirmation and clears it', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(paged([row(1), row(2), row(3)])));
    render(<SavingsPassbooks />);
    await screen.findAllByText('Main passbook');

    await userEvent.click(screen.getByLabelText('Select row 1'));
    await userEvent.click(screen.getByLabelText('Select row 3'));
    expect(screen.getByRole('button', { name: 'Delete selected (2)' })).toBeInTheDocument();
    expect(screen.getByLabelText('Select all rows on this page')).not.toBeChecked(); // allSelected() === false

    await userEvent.click(screen.getByRole('button', { name: 'Delete selected (2)' }));
    const request = modalStore.getState().confirmation!;
    expect(request.danger).toBe(true);

    fetchMock
      .mockResolvedValueOnce(jsonResponse({ messag: 'Deleted' })) // DELETE bulk
      .mockResolvedValueOnce(jsonResponse(paged([row(2)]))); // reload
    await act(async () => {
      request.onConfirm();
    });

    await waitFor(() => expect(screen.getAllByText('Main passbook')).toHaveLength(1));
    expect(screen.queryByRole('button', { name: 'Delete selected (2)' })).toBeNull(); // selection cleared
    const bulk = fetchMock.mock.calls.find(([, init]) => init.method === 'DELETE')!;
    expect(String(bulk[0])).toBe(`${LIST_URL}/bulk`);
    expect(JSON.parse(bulk[1].body as string)).toEqual({ ids: [1, 3] });
  });

  it('toggles the whole page via select-all', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(paged([row(1), row(2)])));
    render(<SavingsPassbooks />);
    await screen.findAllByText('Main passbook');

    const selectAll = screen.getByLabelText('Select all rows on this page');
    await userEvent.click(selectAll);
    expect(selectAll).toBeChecked();
    expect(screen.getByLabelText('Select row 1')).toBeChecked();
    expect(screen.getByLabelText('Select row 2')).toBeChecked();
    expect(screen.getByRole('button', { name: 'Delete selected (2)' })).toBeInTheDocument();

    await userEvent.click(selectAll);
    expect(selectAll).not.toBeChecked();
    expect(screen.getByLabelText('Select row 1')).not.toBeChecked();
    expect(screen.getByLabelText('Select row 2')).not.toBeChecked();
    expect(screen.queryByRole('button', { name: 'Delete selected (2)' })).toBeNull();
  });

  it('opens the deposit modal from a row', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(paged([row(1)]))); // ngOnInit list
    render(<SavingsPassbooks />);
    await screen.findByText('Main passbook');

    fetchMock.mockResolvedValueOnce(jsonResponse(currentUser)); // profile prefill in the modal
    await userEvent.click(screen.getByTitle('Additional Deposit'));
    // depositing()?.id === 1 — the modal seeds the row's passbook number.
    const dialog = await screen.findByRole('dialog', { name: 'Additional deposit' });
    expect(within(dialog).getByLabelText('Savings Passbook Number')).toHaveValue('SP-001');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Additional deposit' })).toBeNull(),
    );
  });

  /** Opens the filter panel and applies name + principal(>=) — the shared prologue of the filter tests. */
  async function applyNameAndPrincipalFilters(): Promise<void> {
    await userEvent.click(screen.getByRole('button', { name: 'Filters' }));
    await userEvent.type(screen.getByLabelText('Name'), 'Main passbook');
    await userEvent.selectOptions(screen.getByLabelText('Principal amount operator'), '>=');
    await userEvent.type(screen.getByLabelText('Principal Amount'), '1000000');
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(searchCalls()).toHaveLength(1));
  }

  it('applies filters and sends operator-prefixed search params', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(paged([row(1)])));
    render(<SavingsPassbooks />);
    await screen.findByText('Main passbook');

    await userEvent.click(screen.getByRole('button', { name: 'Filters' }));
    await userEvent.type(screen.getByLabelText('Name'), 'Main passbook');
    await userEvent.selectOptions(screen.getByLabelText('Principal amount operator'), '>=');
    await userEvent.type(screen.getByLabelText('Principal Amount'), '1000000');
    await userEvent.selectOptions(screen.getByLabelText('Maturity date operator'), '<=');
    fireEvent.change(screen.getByLabelText('Maturity Date'), { target: { value: '2027-06-30' } });
    await userEvent.type(screen.getByLabelText('Deposit Term'), '360'); // op stays '='
    fetchMock.mockResolvedValueOnce(jsonResponse(paged([row(1)])));
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => expect(searchCalls()).toHaveLength(1));
    const request = lastSearchCall();
    expect(request.searchParams.get('savingsPassbookName')).toBe('Main passbook');
    expect(request.searchParams.get('principalAmount')).toBe('>=1000000');
    expect(request.searchParams.get('maturityDate')).toBe('<=2027-06-30');
    expect(request.searchParams.get('depositTerm')).toBe('360'); // "=" sends the bare value
    expect(request.searchParams.get('interestRate')).toBeNull(); // empty filters are omitted
    expect(request.searchParams.get('page')).toBe('0');
    expect(request.searchParams.get('size')).toBe('10');
    // hasActiveFilters() + activeFilterCount() === 4 — the Filters button carries a badge.
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(await screen.findAllByText('Main passbook')).toHaveLength(1);
  });

  it('paginates and resizes with the applied filters intact', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(paged([row(1)])));
    render(<SavingsPassbooks />);
    await screen.findByText('Main passbook');

    fetchMock.mockResolvedValueOnce(jsonResponse(paged([row(1)], { totalPages: 2 })));
    await applyNameAndPrincipalFilters();

    // load(1): the second page button is the reachable trigger (totalPages 2).
    fetchMock.mockResolvedValueOnce(jsonResponse(paged([row(1)], { page: 1, totalPages: 2 })));
    await userEvent.click(screen.getByRole('button', { name: '2' }));
    await screen.findByText('Page 2 of 2');
    const pageRequest = lastSearchCall();
    expect(pageRequest.searchParams.get('page')).toBe('1');
    expect(pageRequest.searchParams.get('savingsPassbookName')).toBe('Main passbook');

    // onPageSizeChange(20): restarts at page 0, filters preserved.
    fetchMock.mockResolvedValueOnce(jsonResponse(paged([row(1)], { size: 20, totalPages: 2 })));
    await userEvent.selectOptions(screen.getByLabelText('Rows per page'), '20');
    await waitFor(() => expect(screen.getByLabelText('Rows per page')).toHaveValue('20'));
    const sizeRequest = lastSearchCall();
    expect(sizeRequest.searchParams.get('page')).toBe('0');
    expect(sizeRequest.searchParams.get('size')).toBe('20');
    expect(sizeRequest.searchParams.get('principalAmount')).toBe('>=1000000');
  });

  it('keeps pagination on the applied filters while the draft is edited', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(paged([row(1)])));
    render(<SavingsPassbooks />);
    await screen.findByText('Main passbook');

    fetchMock.mockResolvedValueOnce(jsonResponse(paged([row(1)], { totalPages: 2 })));
    await applyNameAndPrincipalFilters();

    // onNameFilterChange('Other') — draft only, not applied.
    await userEvent.clear(screen.getByLabelText('Name'));
    await userEvent.type(screen.getByLabelText('Name'), 'Other');

    fetchMock.mockResolvedValueOnce(jsonResponse(paged([row(1)], { page: 1, totalPages: 2 })));
    await userEvent.click(screen.getByRole('button', { name: '2' }));
    await waitFor(() => expect(searchCalls()).toHaveLength(2));
    const request = lastSearchCall();
    expect(request.searchParams.get('savingsPassbookName')).toBe('Main passbook'); // applied, not the draft
    expect(screen.getByLabelText('Name')).toHaveValue('Other'); // the draft survives in the panel
  });

  it('clears filters and reloads the unfiltered list', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(paged([row(1)])));
    render(<SavingsPassbooks />);
    await screen.findByText('Main passbook');

    fetchMock.mockResolvedValueOnce(jsonResponse(paged([row(1)])));
    await applyNameAndPrincipalFilters();

    fetchMock.mockResolvedValueOnce(jsonResponse(paged([row(1)]))); // back on the plain list
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));

    await waitFor(() => expect(searchCalls()).toHaveLength(1));
    const reload = new URL(
      String(fetchMock.mock.calls[fetchMock.mock.calls.length - 1]![0]),
    );
    expect(reload.pathname).toBe('/savings-passbooks');
    expect(reload.searchParams.get('savingsPassbookName')).toBeNull();
    await screen.findAllByText('Main passbook');
    // hasActiveFilters() === false — the Filters badge is gone and the draft reset.
    expect(screen.getByRole('button', { name: 'Filters' }).querySelector('.filter-badge')).toBeNull();
    expect(screen.getByLabelText('Name')).toHaveValue('');
  });

  it('surfaces a 400 from the search endpoint as the error message', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(paged([row(1)])));
    render(<SavingsPassbooks />);
    await screen.findByText('Main passbook');

    await userEvent.click(screen.getByRole('button', { name: 'Filters' }));
    await userEvent.type(screen.getByLabelText('Principal Amount'), 'abc'); // op stays '='
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ status: 400, message: 'Invalid Data.', timeStamp: '2026-09-11T00:00:00' }, 400),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(await screen.findByText('Invalid Data.')).toBeInTheDocument();
    expect(screen.queryByText('Loading…')).toBeNull();
  });

  it('shows the filter-aware empty state when the search returns nothing', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(paged([row(1)])));
    render(<SavingsPassbooks />);
    await screen.findByText('Main passbook');

    await userEvent.click(screen.getByRole('button', { name: 'Filters' }));
    await userEvent.type(screen.getByLabelText('Name'), 'Main passbook');
    fetchMock.mockResolvedValueOnce(jsonResponse(paged([])));
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(
      await screen.findByText('No savings passbooks match the current filters.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
  });

  it('preserves the applied filters when reloading after a delete', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(paged([row(1)])));
    render(<SavingsPassbooks />);
    await screen.findByText('Main passbook');

    fetchMock.mockResolvedValueOnce(jsonResponse(paged([row(1)])));
    await applyNameAndPrincipalFilters();

    await userEvent.click(screen.getByTitle('Delete'));
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ messag: 'Deleted' })) // DELETE
      .mockResolvedValueOnce(jsonResponse(paged([]))); // reload — still filtered
    await act(async () => {
      modalStore.getState().confirmation!.onConfirm();
    });

    await screen.findByText('No savings passbooks match the current filters.');
    const reload = lastSearchCall();
    expect(reload.searchParams.get('savingsPassbookName')).toBe('Main passbook');
  });
});

describe('AdditionalDepositForm', () => {
  function renderForm(passbookNumber: string | null): { onDeposited: ReturnType<typeof vi.fn>; onClosed: ReturnType<typeof vi.fn> } {
    const onDeposited = vi.fn();
    const onClosed = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse(currentUser)); // ngOnInit prefill fetch
    render(
      <AdditionalDepositForm
        passbookNumber={passbookNumber}
        onDeposited={onDeposited}
        onClosed={onClosed}
      />,
    );
    return { onDeposited, onClosed };
  }

  it('prefills email and account number, blocks submit until complete', async () => {
    renderForm(null);

    expect(screen.getByLabelText('Email')).toHaveValue('saver@test.com'); // from the session JWT
    await waitFor(() => expect(screen.getByLabelText('Account Number')).toHaveValue('ACC-7'));
    expect(screen.getByRole('button', { name: 'Deposit' })).toBeDisabled(); // no passbook/amount yet

    await userEvent.type(screen.getByLabelText('Savings Passbook Number'), 'PBN-1');
    await userEvent.type(screen.getByLabelText('Amount'), '500000');
    expect(screen.getByRole('button', { name: 'Deposit' })).toBeEnabled(); // email alone is enough contact
  });

  it('prefills the passbook number from the row input', async () => {
    renderForm('PBN-row');

    // The passbook number seeds from the prop synchronously (mount, before the
    // profile fetch resolves) — exactly the Angular setInput timing.
    expect(screen.getByLabelText('Savings Passbook Number')).toHaveValue('PBN-row');
    await waitFor(() => expect(screen.getByLabelText('Account Number')).toHaveValue('ACC-7'));
  });

  it('posts the exact deposit body and reports the returned passbook', async () => {
    renderForm(null);
    await waitFor(() => expect(screen.getByLabelText('Account Number')).toHaveValue('ACC-7'));

    await userEvent.clear(screen.getByLabelText('Account Number'));
    await userEvent.type(screen.getByLabelText('Account Number'), 'ACC-1');
    await userEvent.type(screen.getByLabelText('Savings Passbook Number'), 'PBN-abc');
    await userEvent.type(screen.getByLabelText('Amount'), '500000');
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ ...row(1), savingsPassbookNumber: 'PBN-abc', principalAmount: 10_500_000 }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Deposit' }));

    const success = await screen.findByText(/Deposited successfully/);
    const post = fetchMock.mock.calls.find(([, init]) => init.method === 'POST')!;
    expect(String(post[0])).toBe(`${BASE_URL}/additional-deposits`);
    expect(JSON.parse(post[1].body as string)).toEqual({
      email: 'saver@test.com',
      phone: '',
      accountNumber: 'ACC-1',
      savingsPassbookNumber: 'PBN-abc',
      amount: 500_000,
    });
    expect(success.textContent).toContain('PBN-abc');
    expect(success.textContent).toContain('10.500.000');
  });

  it('requires a contact field to be filled when both are empty', async () => {
    renderForm(null);
    await waitFor(() => expect(screen.getByLabelText('Account Number')).toHaveValue('ACC-7'));

    await userEvent.type(screen.getByLabelText('Savings Passbook Number'), 'PBN-1');
    await userEvent.type(screen.getByLabelText('Amount'), '1');
    // Angular emptied email then re-enabled via the phone field; the React port
    // comments the phone input out, so email is the only reachable contact.
    await userEvent.clear(screen.getByLabelText('Email'));
    expect(screen.getByRole('button', { name: 'Deposit' })).toBeDisabled(); // hasContact() === false

    await userEvent.type(screen.getByLabelText('Email'), 'saver@test.com');
    expect(screen.getByRole('button', { name: 'Deposit' })).toBeEnabled();
  });
});
