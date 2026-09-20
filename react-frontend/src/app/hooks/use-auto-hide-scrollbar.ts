import { useEffect, useRef } from 'react';

/**
 * Ported from the appAutoHideScrollbar directive: adds `.is-scrolling` to the
 * host element while it scrolls and removes it 500 ms after the last scroll
 * event. Pairs with the `.modal-container` scrollbar-color rules in
 * src/scss/modal.scss. Attach to any scrolling modal container:
 *   const ref = useAutoHideScrollbar<HTMLDivElement>();
 *   <div className="modal-container" ref={ref}>
 */
export function useAutoHideScrollbar<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    let timer: ReturnType<typeof setTimeout> | null = null;

    const onScroll = (): void => {
      element.classList.add('is-scrolling');
      if (timer !== null) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => element.classList.remove('is-scrolling'), 500);
    };

    element.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      element.removeEventListener('scroll', onScroll);
      if (timer !== null) {
        clearTimeout(timer);
      }
      element.classList.remove('is-scrolling');
    };
  }, []);

  return ref;
}
