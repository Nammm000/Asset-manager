import { StrictMode } from 'react';
import { render } from '@testing-library/react';
import { vi } from 'vitest';
import { useMountOnce } from 'hooks/use-mount-once';

// The regression this hook exists for: dev StrictMode runs mount effects
// twice (setup → simulated-unmount cleanup → setup) while PRESERVING state
// and refs, which used to double-fire every page's initial API load.
function Probe({ onRun }: { onRun: () => void }) {
  useMountOnce(onRun);
  return <div />;
}

describe('useMountOnce', () => {
  it('runs exactly once per mount even under StrictMode', () => {
    const onRun = vi.fn();
    render(
      <StrictMode>
        <Probe onRun={onRun} />
      </StrictMode>,
    );
    expect(onRun).toHaveBeenCalledTimes(1);
  });

  it('runs again on a real remount', () => {
    const onRun = vi.fn();
    const { unmount } = render(<Probe onRun={onRun} />);
    expect(onRun).toHaveBeenCalledTimes(1);

    unmount();
    render(<Probe onRun={onRun} />);
    expect(onRun).toHaveBeenCalledTimes(2);
  });

  it('does not re-run when the callback identity changes without a remount', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<Probe onRun={first} />);

    rerender(<Probe onRun={second} />);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });
});
