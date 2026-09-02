import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pagination } from './pagination';

describe('Pagination', () => {
  let component: Pagination;
  let fixture: ComponentFixture<Pagination>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Pagination],
    }).compileComponents();

    fixture = TestBed.createComponent(Pagination);
    component = fixture.componentInstance;
    // page/totalPages are input.required — seed before the first render
    fixture.componentRef.setInput('page', 0);
    fixture.componentRef.setInput('totalPages', 1);
    await fixture.whenStable();
  });

  function render(page: number, totalPages: number): void {
    fixture.componentRef.setInput('page', page);
    fixture.componentRef.setInput('totalPages', totalPages);
    fixture.detectChanges();
  }

  it('renders nothing when there is a single page', () => {
    render(0, 1);
    expect((fixture.nativeElement as HTMLElement).querySelector('.pagination')).toBeFalsy();
  });

  it('renders every page number when there are few pages', () => {
    render(1, 3);
    const element = fixture.nativeElement as HTMLElement;
    const buttons = Array.from(element.querySelectorAll<HTMLButtonElement>('.pagination__btn'));
    // prev + 3 numbered + next
    expect(buttons.map((b) => b.textContent?.trim())).toEqual(['‹', '1', '2', '3', '›']);
    expect(buttons[2].classList.contains('pagination__btn--active')).toBe(true);
  });

  it('collapses long ranges to first/last plus a window with ellipses', () => {
    render(5, 12); // 0-based → labels are 1-based
    const element = fixture.nativeElement as HTMLElement;
    const slots = Array.from(
      element.querySelectorAll<HTMLElement>('.pagination__btn, .pagination__ellipsis'),
    );
    const numbers = slots.slice(1, -1).map((s) => s.textContent?.trim()); // drop prev/next
    expect(numbers).toEqual(['1', '…', '5', '6', '7', '…', '12']);
    expect(element.querySelector('.pagination__label')?.textContent?.trim()).toBe('Page 6 of 12');
  });

  it('clamps the window at both ends', () => {
    render(0, 12);
    expect(component.window()).toEqual([0, 1, -1, 11]);

    render(11, 12);
    expect(component.window()).toEqual([0, -1, 10, 11]);
  });

  it('disables prev on the first page and next on the last page', () => {
    render(0, 5);
    const buttons = () =>
      Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.pagination__btn'));
    expect(buttons()[0].disabled).toBe(true);
    expect(buttons().at(-1)?.disabled).toBe(false);

    render(4, 5);
    expect(buttons()[0].disabled).toBe(false);
    expect(buttons().at(-1)?.disabled).toBe(true);
  });

  it('emits pageChange only for a different, in-range page', () => {
    render(2, 5);
    const emitted: number[] = [];
    component.pageChange.subscribe((p) => emitted.push(p));

    component.go(2); // same page — no emission
    component.go(-3); // clamps to 0
    component.go(99); // clamps to 4
    component.go(3);

    expect(emitted).toEqual([0, 4, 3]);
  });
});
