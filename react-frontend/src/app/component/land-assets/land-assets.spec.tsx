import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { jsonResponse } from '../../../test/helpers';
import type { LandAssets as LandAssetsComponent } from 'component/land-assets/land-assets';
import type { LandAssetForm as LandAssetFormComponent } from 'component/land-assets/land-asset-form/land-asset-form';
import type { useModalStore as ModalStore } from 'store/modal-store';
import type { LandAsset } from 'model/asset.model';

// Ported from land-assets.spec.ts: TestBed → RTL render (list loads on mount),
// HttpTestingController → stubbed fetch. The Angular spec drove component
// methods (openEdit/toggleSelected/confirmBulkDelete); the React port reaches
// them through their DOM controls.
const LIST_URL = 'http://localhost:8082/land-assets';

const row = (id: number): LandAsset => ({
  id,
  userId: 1,
  location: `Plot ${id}`,
  area: 120,
  purchaseDate: '2025-06-01T00:00:00.000Z',
  assetType: 'LAND',
  createdAt: '2025-06-01T10:00:00',
});

const paged = (content: LandAsset[]) => ({
  content,
  page: 0,
  size: 10,
  totalElements: content.length,
  totalPages: 1,
  first: true,
  last: true,
});

let LandAssets: typeof LandAssetsComponent;
let LandAssetForm: typeof LandAssetFormComponent;
let modalStore: typeof ModalStore;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  localStorage.clear();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.resetModules();
  ({ LandAssets } = await import('component/land-assets/land-assets'));
  ({ LandAssetForm } = await import('component/land-assets/land-asset-form/land-asset-form'));
  ({ useModalStore: modalStore } = await import('store/modal-store'));
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('LandAssets', () => {
  it('loads the first page on init', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(paged([row(1)])));
    render(<LandAssets />);

    expect(await screen.findByText('Plot 1')).toBeInTheDocument();
    expect(screen.queryByText('Loading…')).toBeNull();
  });

  it('seeds the edit form from the row and converts dates to ISO on submit', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(paged([row(1)])));
    const page = render(<LandAssets />);
    await page.findByText('Plot 1');

    // openEdit seeds the modal from the clicked row.
    await userEvent.click(page.getByTitle('Edit'));
    expect(await page.findByRole('dialog', { name: 'Edit land asset' })).toBeInTheDocument();
    page.unmount();

    // The Angular spec used a second fixture for the form; render it directly.
    const onSaved = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse(row(1)));
    render(<LandAssetForm asset={row(1)} onSaved={onSaved} onClosed={vi.fn()} />);

    expect(screen.getByLabelText('Location')).toHaveValue('Plot 1');
    expect(screen.getByLabelText('Purchase Date')).toHaveValue('2025-06-01'); // ISO → yyyy-MM-dd input

    await userEvent.clear(screen.getByLabelText('Location'));
    await userEvent.type(screen.getByLabelText('Location'), 'Updated Plot');
    await userEvent.clear(screen.getByLabelText('Area (m²)'));
    await userEvent.type(screen.getByLabelText('Area (m²)'), '200');
    fireEvent.change(screen.getByLabelText('Purchase Date'), { target: { value: '2026-01-31' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const put = fetchMock.mock.calls.find(([, init]) => init.method === 'PUT')!;
    expect(String(put[0])).toBe(`${LIST_URL}/1`);
    const body = JSON.parse(put[1].body as string);
    expect(body.location).toBe('Updated Plot');
    expect(body.area).toBe(200);
    // date input value -> ISO datetime string on the wire
    expect(String(body.purchaseDate)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(body.saleDate).toBeUndefined();
  });

  it('bulk-deletes the selection after confirmation and clears it', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(paged([row(1), row(2), row(3)])));
    render(<LandAssets />);
    await screen.findByText('Plot 1');

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

    await waitFor(() => expect(screen.getByText('Plot 2')).toBeInTheDocument());
    expect(screen.queryByText('Plot 1')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete selected (2)' })).toBeNull(); // selection cleared
    const bulk = fetchMock.mock.calls.find(([, init]) => init.method === 'DELETE')!;
    expect(String(bulk[0])).toBe(`${LIST_URL}/bulk`);
    expect(JSON.parse(bulk[1].body as string)).toEqual({ ids: [1, 3] });
  });

  it('toggles the whole page via select-all', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(paged([row(1), row(2)])));
    render(<LandAssets />);
    await screen.findByText('Plot 1');

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
