import { useEffect, useRef } from 'react';

/**
 * Runs `run` exactly once per real mount (the Angular ngOnInit the page
 * comments describe). React 19 StrictMode runs mount effects twice in dev
 * (setup → simulated-unmount cleanup → setup) while PRESERVING state and
 * refs, so the ref guard holds across the simulation and the initial API
 * load is not double-fired. A real remount (navigate away and back) starts
 * with a fresh ref and loads again. `runRef` is kept current so callers can
 * pass an unstable closure (e.g. a `load` whose identity tracks page state)
 * without the effect ever re-running.
 */
export function useMountOnce(run: () => void): void {
  const doneRef = useRef(false);
  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    if (doneRef.current) {
      return;
    }
    doneRef.current = true;
    runRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
