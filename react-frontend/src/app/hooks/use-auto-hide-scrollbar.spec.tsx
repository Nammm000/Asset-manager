import { render } from '@testing-library/react';
import { vi } from 'vitest';
import { useAutoHideScrollbar } from 'hooks/use-auto-hide-scrollbar';

// Ported from auto-hide-scrollbar.spec.ts (directive → hook): .is-scrolling is
// added on scroll and removed 500 ms after the last one. The callback ref
// feeds both the hook's ref and the test's element handle.
function Probe(props: { onElement: (element: HTMLDivElement | null) => void }) {
  const ref = useAutoHideScrollbar<HTMLDivElement>();
  return <div ref={(element) => { ref.current = element; props.onElement(element); }} />;
}

describe('useAutoHideScrollbar', () => {
  it('adds .is-scrolling on scroll and removes it 500ms after the last scroll', async () => {
    vi.useFakeTimers();
    let element: HTMLDivElement | null = null;
    render(<Probe onElement={(el) => { if (el) element = el; }} />);

    element!.dispatchEvent(new Event('scroll'));
    expect(element!.classList.contains('is-scrolling')).toBe(true);

    // Still present just before the deadline, gone after it.
    vi.advanceTimersByTime(400);
    element!.dispatchEvent(new Event('scroll')); // resets the timer
    vi.advanceTimersByTime(400);
    expect(element!.classList.contains('is-scrolling')).toBe(true);
    vi.advanceTimersByTime(200);
    expect(element!.classList.contains('is-scrolling')).toBe(false);

    vi.useRealTimers();
  });

  it('cleans up on unmount', () => {
    vi.useFakeTimers();
    let element: HTMLDivElement | null = null;
    const { unmount } = render(<Probe onElement={(el) => { if (el) element = el; }} />);

    element!.dispatchEvent(new Event('scroll'));
    unmount();
    expect(element!.classList.contains('is-scrolling')).toBe(false);

    vi.useRealTimers();
  });
});
