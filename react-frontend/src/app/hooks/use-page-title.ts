import { useEffect } from 'react';

/** Replaces the Angular router's per-route `title` ('Dashboard | Asset Manager'). */
export function usePageTitle(title: string): void {
  useEffect(() => {
    document.title = title;
  }, [title]);
}
