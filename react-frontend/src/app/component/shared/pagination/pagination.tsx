import { useMemo, type ChangeEvent } from 'react';

/**
 * Shared pager for the paged asset lists (ported from Angular's Pagination).
 * `page` is 0-based (the backend's PagedResponse.page). Emits the new page
 * only when it actually changes. Also hosts the rows-per-page selector: it
 * renders even on single-page lists and the host is expected to reload from
 * the first page (page indexes are size-dependent).
 * Styles are global in src/scss/table.scss (.pagination*).
 */
export interface PaginationProps {
  page: number;
  totalPages: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const SIZE_OPTIONS = [5, 10, 20, 50];

/** Page numbers to render: every page when there are few, otherwise the first and last page plus a window around the current one. A `-1` slot renders as an ellipsis where there is a gap. */
function pageWindow(total: number, current: number): (number | -1)[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i);
  }
  const pages = [...new Set([0, total - 1, current - 1, current, current + 1])]
    .filter((p) => p >= 0 && p < total)
    .sort((a, b) => a - b);
  const result: (number | -1)[] = [];
  let previous = -2;
  for (const p of pages) {
    if (result.length > 0 && p - previous > 1) {
      result.push(-1);
    }
    result.push(p);
    previous = p;
  }
  return result;
}

export function Pagination({ page, totalPages, pageSize, onPageChange, onPageSizeChange }: PaginationProps) {
  const canPrev = page > 0;
  const canNext = page < totalPages - 1;
  const windowPages = useMemo(() => pageWindow(totalPages, page), [totalPages, page]);

  const go = (target: number): void => {
    const clamped = Math.min(Math.max(target, 0), totalPages - 1);
    if (clamped !== page) {
      onPageChange(clamped);
    }
  };

  const onSizeChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    const size = Number(event.target.value);
    if (size !== pageSize) {
      onPageSizeChange(size);
    }
  };

  return (
    <nav className="pagination" aria-label="Pagination">
      <label className="pagination__size-label">
        Rows per page
        <select className="pagination__size" value={pageSize} onChange={onSizeChange}>
          {SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
      {totalPages > 1 && (
        <>
          <button
            type="button"
            className="pagination__btn"
            disabled={!canPrev}
            onClick={() => go(page - 1)}
            aria-label="Previous page"
          >
            &lsaquo;
          </button>
          {windowPages.map((p, index) =>
            p === -1 ? (
              <span key={`ellipsis-${index}`} className="pagination__ellipsis">
                &hellip;
              </span>
            ) : (
              <button
                key={p}
                type="button"
                className={`pagination__btn${p === page ? ' pagination__btn--active' : ''}`}
                aria-current={p === page ? 'page' : undefined}
                onClick={() => go(p)}
              >
                {p + 1}
              </button>
            ),
          )}
          <button
            type="button"
            className="pagination__btn"
            disabled={!canNext}
            onClick={() => go(page + 1)}
            aria-label="Next page"
          >
            &rsaquo;
          </button>
          <span className="pagination__label">
            Page {page + 1} of {totalPages}
          </span>
        </>
      )}
    </nav>
  );
}
