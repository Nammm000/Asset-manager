import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { jsonResponse } from '../../../test/helpers';
import type { Currencies as CurrenciesComponent } from 'component/currencies/currencies';
import type { CurrencyForm as CurrencyFormComponent } from 'component/currencies/currency-form/currency-form';
import type { Currency } from 'model/currency.model';

// Ported from currencies.spec.ts (Currencies + CurrencyForm suites): TestBed →
// RTL render, HttpTestingController → stubbed fetch. The page loads on mount
// (useEffect ngOnInit); the form is rendered directly with its props.
const CURRENCIES_URL = 'http://localhost:8082/currencies';

const usd: Currency = { code: 'USD', name: 'US Dollar', symbol: '$', decimalPlaces: 2 };

let Currencies: typeof CurrenciesComponent;
let CurrencyForm: typeof CurrencyFormComponent;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  localStorage.clear();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.resetModules();
  ({ Currencies } = await import('component/currencies/currencies'));
  ({ CurrencyForm } = await import('component/currencies/currency-form/currency-form'));
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('Currencies', () => {
  it('loads the plain (non-paged) list on init', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([usd]));
    render(<Currencies />);

    expect(await screen.findByText('US Dollar')).toBeInTheDocument();
    expect(screen.getByText('USD')).toBeInTheDocument();
    expect(screen.getByText('$')).toBeInTheDocument();
    expect(screen.queryByText('Loading…')).toBeNull();
  });

  it('shows an error banner when the list fails', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ status: 500, message: 'Boom', timeStamp: 0 }, 500),
    );
    render(<Currencies />);

    expect(await screen.findByText('Boom')).toBeInTheDocument();
  });
});

describe('CurrencyForm', () => {
  it('blocks submit while the form is invalid and uppercases the code on input', async () => {
    render(<CurrencyForm currency={null} onSaved={vi.fn()} onClosed={vi.fn()} />);

    const submit = screen.getByRole('button', { name: 'Add Currency' });
    expect(submit).toBeDisabled(); // everything empty

    await userEvent.type(screen.getByLabelText('Name'), 'US Dollar');
    await userEvent.type(screen.getByLabelText('Symbol'), '$');
    await userEvent.type(screen.getByLabelText('Decimal Places'), '2');
    expect(submit).toBeDisabled(); // still no code

    await userEvent.type(screen.getByLabelText('Code'), 'usd');
    expect(screen.getByLabelText('Code')).toHaveValue('USD'); // uppercased on input
    expect(submit).toBeEnabled();
  });

  it('seeds from the currency when editing and PUTs to the code path', async () => {
    const onSaved = vi.fn();
    render(<CurrencyForm currency={usd} onSaved={onSaved} onClosed={vi.fn()} />);

    expect(screen.getByText('Edit Currency')).toBeInTheDocument();
    const code = screen.getByLabelText('Code') as HTMLInputElement;
    expect(code).toHaveValue('USD');
    expect(code).toBeDisabled(); // the code is the path key — locked while editing

    await userEvent.clear(screen.getByLabelText('Name'));
    await userEvent.type(screen.getByLabelText('Name'), 'American Dollar');
    fetchMock.mockResolvedValueOnce(jsonResponse({ messag: 'Updated' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const call = fetchMock.mock.calls[0]!;
    expect(String(call[0])).toBe(`${CURRENCIES_URL}/USD`);
    expect(call[1].method).toBe('PUT');
    expect(JSON.parse(call[1].body as string)).toEqual({
      code: 'USD',
      name: 'American Dollar',
      symbol: '$',
      decimalPlaces: 2,
    });
  });

  it('POSTs a new currency on create', async () => {
    const onSaved = vi.fn();
    render(<CurrencyForm currency={null} onSaved={onSaved} onClosed={vi.fn()} />);

    await userEvent.type(screen.getByLabelText('Code'), 'vnd');
    await userEvent.type(screen.getByLabelText('Name'), 'Vietnamese Dong');
    await userEvent.type(screen.getByLabelText('Symbol'), '₫');
    await userEvent.type(screen.getByLabelText('Decimal Places'), '0');
    fetchMock.mockResolvedValueOnce(jsonResponse({ messag: 'Created' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add Currency' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const call = fetchMock.mock.calls[0]!;
    expect(String(call[0])).toBe(CURRENCIES_URL);
    expect(call[1].method).toBe('POST');
    expect(JSON.parse(call[1].body as string)).toEqual({
      code: 'VND',
      name: 'Vietnamese Dong',
      symbol: '₫',
      decimalPlaces: 0,
    });
  });
});
