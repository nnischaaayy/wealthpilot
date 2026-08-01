import { useSyncExternalStore } from "react";

function subscribe() {
  return () => {};
}

/** True only after client hydration — avoids SSR/client markup mismatches. */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
