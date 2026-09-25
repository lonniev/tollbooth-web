/**
 * The debug log's entries, newest first, re-rendering whenever they change.
 * Entries are already scrubbed of secrets by `debugPush`.
 */

import { useSyncExternalStore } from "react";
import { debugEntries, onDebug, type DebugEntry } from "../debugLog.ts";

export function useDebugLog(): readonly DebugEntry[] {
  return useSyncExternalStore(onDebug, debugEntries, debugEntries);
}
