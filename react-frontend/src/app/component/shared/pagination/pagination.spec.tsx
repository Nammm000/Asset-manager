import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { Pagination, type PaginationProps } from './pagination';

// Ported from pagination.spec.ts: input.required + setInput → controlled props
// (render + rerender), OutputEmitters → callback props (vi.fn() spies).
// component.window() has no exported equivalent here — the window tests assert
// the rendered number slots instead, and go()'s clamp (go(-3)/go(99)) is not
// reachable through the UI (the component only renders in-range buttons), so
// the emissions test drives the same expected sequence via button clicks.
describe('Pagination', () => {
  function renderPagination(page: number, totalPages: number, pageSize = 10) {
    const onPageChange = vi.fn();
    const onPageSizeChange = vi.fn();
    const props: PaginationProps = { page, totalPages, pageSize, onPageChange, onPageSizeChange };
    const view = render(<Pagination {...props} />);
    return {
      onPageChange,
      onPageSizeChange,
      rerender(next: Partial<PaginationProps>): void {
        view.rerender(<Pagination {...props} {...next} />);
      },
    };
  }

  const pageButtons = (): HTMLButtonElement[] =>
    Array.from(document.querySelectorAll<HTMLButtonElement>('.pagination__btn'));

  // The middle slots (drop prev/next) as trimmed text — the observable form of
  // the Angular component.window() assertion.
  const numberSlots = (): (string | undefined)[] =>
    Array.from(document.querySelectorAll<HTMLElement>('.pagination__btn, .pagination__ellipsis'))
      .slice(1, -1)
      .map((slot) => slot.textContent?.trim());

  it('renders only the rows-per-page selector when there is a single page', () => {
    renderPagination(0, 1);

    expect(document.querySelector('.pagination')).not.toBeNull();
    expect(document.querySelector('.pagination__btn')).toBeNull(); // no page buttons
    expect(document.querySelector('.pagination__label')).toBeNull();
  });

  it('renders every page number when there are few pages', () => {
    renderPagination(1, 3);

    expect(pageButtons().map((b) => b.textContent?.trim())).toEqual(['‹', '1', '2', '3', '›']);
    expect(pageButtons()[2]!.classList.contains('pagination__btn--active')).toBe(true);
  });

  it('collapses long ranges to first/last plus a window with ellipses', () => {
    renderPagination(5, 12); // 0-based → labels are 1-based

    expect(numberSlots()).toEqual(['1', '…', '5', '6', '7', '…', '12']);
    expect(document.querySelector('.pagination__label')?.textContent?.trim()).toBe('Page 6 of 12');
  });

  it('clamps the window at both ends', () => {
    const { rerender } = renderPagination(0, 12);
    expect(numberSlots()).toEqual(['1', '2', '…', '12']);

    rerender({ page: 11 });
    expect(numberSlots()).toEqual(['1', '…', '11', '12']);
  });

  it('disables prev on the first page and next on the last page', () => {
    const { rerender } = renderPagination(0, 5);
    expect(pageButtons()[0]!.disabled).toBe(true);
    expect(pageButtons().at(-1)!.disabled).toBe(false);

    rerender({ page: 4 });
    expect(pageButtons()[0]!.disabled).toBe(false);
    expect(pageButtons().at(-1)!.disabled).toBe(true);
  });

  it('emits pageChange only for a different, in-range page', async () => {
    const { onPageChange } = renderPagination(2, 5);

    await userEvent.click(screen.getByRole('button', { name: '3' })); // same page — no emission
    await userEvent.click(screen.getByRole('button', { name: '1' })); // → 0 (Angular: go(-3) clamped to 0)
    await userEvent.click(screen.getByRole('button', { name: '5' })); // → 4 (Angular: go(99) clamped to 4)
    await userEvent.click(screen.getByRole('button', { name: '4' })); // → 3

    expect(onPageChange.mock.calls.map((call) => call[0])).toEqual([0, 4, 3]);
  });

  it('offers the size options with the current pageSize selected', () => {
    renderPagination(0, 3);

    const select = document.querySelector<HTMLSelectElement>('.pagination__size');
    const options = Array.from(select?.options ?? []);

    expect(options.map((o) => o.value)).toEqual(['5', '10', '20', '50']);
    expect(select?.value).toBe('10');
  });

  it('follows a pageSize prop change back into the selector', () => {
    const { rerender } = renderPagination(0, 3);

    rerender({ pageSize: 20 });

    expect(document.querySelector<HTMLSelectElement>('.pagination__size')?.value).toBe('20');
  });

  it('emits pageSizeChange for a newly chosen size, not for re-picking the current one', async () => {
    const { onPageSizeChange } = renderPagination(2, 5);
    const select = document.querySelector<HTMLSelectElement>('.pagination__size')!;

    await userEvent.selectOptions(select, '10'); // already the current size — no emission
    await userEvent.selectOptions(select, '20');

    expect(onPageSizeChange.mock.calls.map((call) => call[0])).toEqual([20]);
  });
});
