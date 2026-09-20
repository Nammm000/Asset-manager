import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { jsonResponse } from '../../../test/helpers';
import type { OtherAssets as OtherAssetsComponent } from 'component/other-assets/other-assets';
import type { useModalStore as ModalStore } from 'store/modal-store';
import type { OtherAsset } from 'model/asset.model';

// Ported from other-assets.spec.ts: TestBed → RTL render (list loads on mount),
// HttpTestingController → stubbed fetch, ModalService.confirmation → the modal
// store's confirmation request. Component-method drives become DOM controls.
const LIST_URL = 'http://localhost:8082/other-assets';

const row = (id: number): OtherAsset => ({
  id,
  userId: 1,
  name: `Asset ${id}`,
  amount: 3,
  pricePerUnit: 1500,
  assetType: 'OTHER',
  createdAt: '2026-01-15T10:00:00',
});

const paged = (content: OtherAsset[], overrides: Partial<Record<string, unknown>> = {}) => ({
  content,
  page: 0,
  size: 10,
  totalElements: content.length,
  totalPages: 1,
  first: true,
  last: true,
  ...overrides,
});

let OtherAssets: typeof OtherAssetsComponent;
let modalStore: typeof ModalStore;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  localStorage.clear();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.resetModules();
  ({ OtherAssets } = await import('component/other-assets/other-assets'));
  ({ useModalStore: modalStore } = await import('store/modal-store'));
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('OtherAssets', () => {
  it('loads the first page on init', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(paged([row(1), row(2)])));
    render(<OtherAssets />);

    expect(await screen.findByText('Asset 1')).toBeInTheDocument();
    expect(screen.getByText('Asset 2')).toBeInTheDocument();
    const listCall = new URL(String(fetchMock.mock.calls[0]![0]));
    expect(listCall.pathname).toBe('/other-assets');
    expect(listCall.searchParams.get('page')).toBe('0');
    expect(listCall.searchParams.get('size')).toBe('10');
    expect(screen.queryByText('Loading…')).toBeNull();
    expect(document.querySelector('.error-banner')).toBeNull();
  });

  it('loads the requested page', async () => {
    // Angular called component.load(1) directly; the React page has no
    // imperative handle — the pagination button is the reachable trigger, so
    // the initial page must contain a row and advertise a second page.
    fetchMock.mockResolvedValueOnce(jsonResponse(paged([row(1)], { totalPages: 2 })));
    render(<OtherAssets />);
    await screen.findByText('Asset 1');

    fetchMock.mockResolvedValueOnce(
      jsonResponse(paged([row(2)], { page: 1, first: false, last: true, totalPages: 2 })),
    );
    await userEvent.click(screen.getByRole('button', { name: '2' }));

    expect(await screen.findByText('Asset 2')).toBeInTheDocument();
    const pageCall = new URL(String(fetchMock.mock.calls[1]![0]));
    expect(pageCall.pathname).toBe('/other-assets');
    expect(pageCall.searchParams.get('page')).toBe('1');
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument(); // page() === 1
  });

  it('shows an error banner when loading fails', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ status: 500, message: 'Boom', timeStamp: 0 }, 500),
    );
    render(<OtherAssets />);

    expect(await screen.findByText('Boom')).toBeInTheDocument();
    expect(screen.queryByText('Loading…')).toBeNull();
  });

  it('surfaces delete errors on the page banner', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(paged([row(1)])));
    render(<OtherAssets />);
    await screen.findByText('Asset 1');

    await userEvent.click(screen.getByTitle('Delete'));
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ status: 500, message: 'Nope', timeStamp: 0 }, 500),
    );
    await act(async () => {
      modalStore.getState().confirmation!.onConfirm();
    });

    expect(await screen.findByText('Nope')).toBeInTheDocument();
  });

  it('deletes after confirmation and reloads', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(paged([row(1)])));
    render(<OtherAssets />);
    await screen.findByText('Asset 1');

    await userEvent.click(screen.getByTitle('Delete'));
    const request = modalStore.getState().confirmation!;
    expect(request.danger).toBe(true);

    fetchMock
      .mockResolvedValueOnce(jsonResponse({ messag: 'Deleted' })) // DELETE
      .mockResolvedValueOnce(jsonResponse(paged([]))); // reload
    await act(async () => {
      request.onConfirm();
    });

    expect(await screen.findByText(/No other assets yet/)).toBeInTheDocument();
    const del = fetchMock.mock.calls.find(([, init]) => init.method === 'DELETE')!;
    expect(String(del[0])).toBe(`${LIST_URL}/1`);
  });

  it('bulk-deletes the selection after confirmation and clears it', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(paged([row(1), row(2), row(3)])));
    render(<OtherAssets />);
    await screen.findByText('Asset 1');

    await userEvent.click(screen.getByLabelText('Select row 1'));
    await userEvent.click(screen.getByLabelText('Select row 3'));
    expect(screen.getByRole('button', { name: 'Delete selected (2)' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Delete selected (2)' }));
    const request = modalStore.getState().confirmation!;
    expect(request.danger).toBe(true);

    fetchMock
      .mockResolvedValueOnce(jsonResponse({ messag: 'Deleted' })) // DELETE bulk
      .mockResolvedValueOnce(jsonResponse(paged([row(2)]))); // reload
    await act(async () => {
      request.onConfirm();
    });

    await waitFor(() => expect(screen.getByText('Asset 2')).toBeInTheDocument());
    expect(screen.queryByText('Asset 1')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete selected (2)' })).toBeNull(); // selection cleared
    const bulk = fetchMock.mock.calls.find(([, init]) => init.method === 'DELETE')!;
    expect(String(bulk[0])).toBe(`${LIST_URL}/bulk`);
    expect(JSON.parse(bulk[1].body as string)).toEqual({ ids: [1, 3] });
  });

  it('toggles the whole page via select-all', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(paged([row(1), row(2)])));
    render(<OtherAssets />);
    await screen.findByText('Asset 1');

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
});
