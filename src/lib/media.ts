'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Subscribes to a media query without reading it during render, so the server
 * and the hydrating client agree on `false` and then swap once mounted. Same
 * reasoning as the persistent stores: matchMedia does not exist on the server,
 * and an effect-plus-setState would flash the wrong layout.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (listener: () => void) => {
      if (typeof window === 'undefined') return () => {};
      const list = window.matchMedia(query);
      list.addEventListener('change', listener);
      return () => list.removeEventListener('change', listener);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Phone and small-tablet widths, where drag-and-drop replaces typed blanks. */
export const COMPACT_QUERY = '(max-width: 768px)';

export function useIsCompact(): boolean {
  return useMediaQuery(COMPACT_QUERY);
}
