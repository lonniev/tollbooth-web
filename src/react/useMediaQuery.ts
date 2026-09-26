/** True while `query` matches; false on the server, and when `query` is false. */

import { useCallback, useSyncExternalStore } from "react";

export function useMediaQuery(query: string | false): boolean {
  const subscribe = useCallback(
    (changed: () => void) => {
      if (!query || typeof globalThis.matchMedia !== "function") return () => {};
      const mq = globalThis.matchMedia(query);
      mq.addEventListener("change", changed);
      return () => mq.removeEventListener("change", changed);
    },
    [query],
  );
  const read = useCallback(
    () => Boolean(query) && typeof globalThis.matchMedia === "function" && globalThis.matchMedia(query as string).matches,
    [query],
  );
  return useSyncExternalStore(subscribe, read, () => false);
}
