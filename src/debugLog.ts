/**
 * An in-memory activity log of MCP calls, for a site's debug panel.
 *
 * A ring buffer with subscribers, so the one `callTool` can push and any panel
 * can listen. It survives route changes and is gone on reload. Arguments are
 * logged only as the wrapper's own parameters — the npub/proof envelope is
 * added after logging, so no proof ever lands here.
 */

export interface DebugEntry {
  ts: string;
  type: "info" | "call" | "result" | "error";
  message: string;
}

const log: DebugEntry[] = [];
const listeners = new Set<() => void>();
const MAX = 60;

export function debugPush(type: DebugEntry["type"], message: string): void {
  log.unshift({ ts: new Date().toLocaleTimeString(), type, message });
  if (log.length > MAX) log.length = MAX;
  listeners.forEach((fn) => fn());
}

export function clearDebug(): void {
  log.length = 0;
  listeners.forEach((fn) => fn());
}

export function debugEntries(): readonly DebugEntry[] {
  return log;
}

/** Subscribe to changes. Returns an unsubscribe function. */
export function onDebug(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
