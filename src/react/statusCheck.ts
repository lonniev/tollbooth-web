/**
 * The shell's `service_status` check as three states a site can tell apart:
 * still connecting, answered, or failed. Before this a failed check read as
 * "no answer yet", so a banner said "Connecting…" through a whole outage.
 *
 * Pure: `AppShell` feeds it events, and the tests feed it the same ones.
 */

import { redact } from "../debugLog.ts";
import { isNetworkError } from "../networkError.ts";
import type { ServiceStatus } from "../standardTools.ts";

export type StatusState = "connecting" | "ready" | "failed";

export interface StatusCheck {
  state: StatusState;
  /** The last `service_status` answer; kept through a retry. */
  status: ServiceStatus | null;
  /** Why the last check failed — short, human, scrubbed — or null. */
  error: string | null;
}

export type StatusEvent =
  | { type: "start" }
  | { type: "ok"; status: ServiceStatus }
  | { type: "fail"; error: unknown };

export const STATUS_CONNECTING: StatusCheck = { state: "connecting", status: null, error: null };

/** The longest `statusError` a banner is handed. */
export const STATUS_ERROR_MAX = 140;

/**
 * A failed check as one short line: scrubbed of secrets, the runtime tool
 * name dropped, whitespace collapsed, cut at `STATUS_ERROR_MAX`.
 */
export function statusErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const why = redact(raw)
    .replace(/^[a-z0-9_]*service_status:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const line = isNetworkError(error)
    ? why
      ? `Could not reach the service — ${why}`
      : "Could not reach the service"
    : why || "The service did not answer";
  return line.length > STATUS_ERROR_MAX ? `${line.slice(0, STATUS_ERROR_MAX - 1)}…` : line;
}

export function statusReducer(check: StatusCheck, event: StatusEvent): StatusCheck {
  switch (event.type) {
    case "start":
      return { state: "connecting", status: check.status, error: null };
    case "ok":
      return { state: "ready", status: event.status, error: null };
    case "fail":
      return { state: "failed", status: check.status, error: statusErrorMessage(event.error) };
  }
}
