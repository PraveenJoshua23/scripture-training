/**
 * A tiny localStorage-backed store shaped for `useSyncExternalStore`.
 *
 * Reading localStorage during render would break server rendering, and reading
 * it in an effect means a setState cascade on every mount. An external store
 * sidesteps both: React renders `serverValue` on the server and during
 * hydration, then swaps to the persisted value on the client.
 */
export interface PersistentStore<T> {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => T;
  getServerSnapshot: () => T;
  set: (next: T) => void;
  update: (patch: (prev: T) => T) => void;
}

export function createPersistentStore<T>(options: {
  load: () => T;
  save: (value: T) => void;
  /** Must be a stable reference — React compares snapshots by identity. */
  serverValue: T;
}): PersistentStore<T> {
  const { load, save, serverValue } = options;
  const listeners = new Set<() => void>();
  let value: T = serverValue;
  let hydrated = false;

  const hydrate = () => {
    if (hydrated || typeof window === 'undefined') return;
    value = load();
    hydrated = true;
  };

  const emit = () => {
    for (const listener of listeners) listener();
  };

  return {
    subscribe(listener) {
      hydrate();
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot() {
      hydrate();
      return value;
    },
    getServerSnapshot() {
      return serverValue;
    },
    set(next) {
      hydrated = true;
      value = next;
      save(next);
      emit();
    },
    update(patch) {
      hydrate();
      this.set(patch(value));
    },
  };
}
